import express from "express"
import "dotenv/config"
import cors from "cors"
import http from "http"
import { connectDB } from "./lib/db.js";
import router from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import groupRouter from "./routes/groupRoutes.js";
import Message from "./models/Message.model.js";
import User from "./models/User.model.js";
import jwt from "jsonwebtoken";

const app = express();
const server = http.createServer(app)

// initialize socket.io server with Redis adapter for multi-server support
import { initIO, getIO } from "./lib/socket.js";
export const io = await initIO(server);

// Import rate limiter with backpressure
import checkMessageRate, { checkEventRate, checkServerLoad } from "./middleware/rateLimiter.js";

// Track online users in memory (for quick lookups)
const onlineUsers = new Set();

// Socket authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token || 
                  socket.handshake.query.token;
    
    if (!token) {
        return next(new Error("Authentication required"));
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
    } catch (err) {
        console.log("Socket auth failed:", err.message);
        if (err.name === 'TokenExpiredError') {
            return next(new Error("TOKEN_EXPIRED"));
        }
        return next(new Error("Invalid token"));
    }
});

// socket.io connection handler
io.on("connection", async (socket)=>{
    const userId = socket.user?.userId || socket.handshake.query.userId;
    
    if (!userId) {
        socket.disconnect();
        return;
    }
    
    console.log("User Connected", userId);

    // Join user-specific room for multi-device/multi-server support
    socket.join(`user:${userId}`);
    onlineUsers.add(userId);

    await User.findByIdAndUpdate(userId, { 
        status: "online",
        lastSeen: new Date()
    });

    // emit online users to all connected clients - broadcast to ALL
    io.emit("getOnlineUsers", Array.from(onlineUsers));

    // broadcast status update to everyone
    io.emit("userStatusUpdate", { userId, status: "online" });
    
    // Also emit to specific user rooms for better reliability
    io.emit("userOnline", { userId });

    // Join group room
    socket.on("joinGroup", ({ groupId }) => {
        socket.join(`group:${groupId}`);
        console.log(`User ${userId} joined group ${groupId}`);
    });

    // Leave group room
    socket.on("leaveGroup", ({ groupId }) => {
        socket.leave(`group:${groupId}`);
        console.log(`User ${userId} left group ${groupId}`);
    });

    // Group typing indicator
    socket.on('groupTyping', ({ groupId, userId: senderId, userName }) => {
        socket.to(`group:${groupId}`).emit('groupUserTyping', { groupId, userId: senderId, userName });
    });

    socket.on('groupStopTyping', ({ groupId, userId }) => {
        socket.to(`group:${groupId}`).emit('groupUserStopTyping', { groupId, userId });
    });

    socket.on("disconnect", async ()=>{
        console.log("User Disconnected", userId);
        const lastSeen = new Date();
        
        if(userId) {
            onlineUsers.delete(userId);
            
            await User.findByIdAndUpdate(userId, { 
                status: "offline",
                lastSeen: lastSeen
            });
            
            // Emit userStatusUpdate to all clients
            io.emit("userStatusUpdate", { 
                userId, 
                status: "offline",
                lastSeen: lastSeen.toISOString()
            });
            
            // Also emit userOffline for redundancy
            io.emit("userOffline", { 
                userId, 
                lastSeen: lastSeen.toISOString()
            });
        }
        
        // Broadcast updated online users list
        io.emit("getOnlineUsers", Array.from(onlineUsers));
    })

    // typing indicator events - with backpressure
    socket.on('typing', ({ from, to }) => {
        const loadCheck = checkServerLoad();
        
        // Drop typing indicators under high load
        if (!loadCheck.allowed) {
            return;
        }
        
        io.to(`user:${to}`).emit('userTyping', { from });
    });

    socket.on('stopTyping', ({ from, to }) => {
        const loadCheck = checkServerLoad();
        
        if (!loadCheck.allowed) {
            return;
        }
        
        io.to(`user:${to}`).emit('userStopTyping', { from });
    });

    socket.on("messageDelivered", async ({ messageId, to }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;
            
            // Check if already delivered
            if (message.deliveredTo && message.deliveredTo.includes(to)) {
                return;
            }
            
            // Update to delivered
            const updatedMessage = await Message.findByIdAndUpdate(
                messageId,
                { 
                    status: "delivered",
                    $addToSet: { deliveredTo: to }
                },
                { new: true }
            );
            
            // Broadcast to receiver's room
            if (updatedMessage && to) {
                io.to(`user:${to}`).emit("messageStatusUpdate", {
                    messageIds: [updatedMessage._id],
                    status: "delivered",
                });
            }
            
            // Emit delivery ACK to sender
            io.to(`user:${updatedMessage.senderId.toString()}`).emit("messageAck", {
                clientMessageId: updatedMessage.clientMessageId,
                serverMessageId: updatedMessage._id,
                status: "delivered"
            });
        } catch (error) {
            console.log(error.message);
        }
    });

    socket.on("messageRead", async ({ messageId, to }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;
            
            // Check if already read by this user
            if (message.readBy && message.readBy.includes(to)) {
                return;
            }
            
            // Update to read
            const updatedMessage = await Message.findByIdAndUpdate(
                messageId,
                { 
                    status: "read",
                    $addToSet: { readBy: to }
                },
                { new: true }
            );
            
            // Broadcast to receiver (sender) about read status
            if (updatedMessage && to) {
                io.to(`user:${updatedMessage.senderId.toString()}`).emit("messageStatusUpdate", {
                    messageIds: [updatedMessage._id],
                    status: "read",
                    readBy: updatedMessage.readBy
                });
            }
        } catch (error) {
            console.log(error.message);
        }
    });

    // Sync missed messages on reconnect with pagination support
    socket.on("syncMessages", async ({ lastMessageId, lastMessageTimestamp, limit = 50 }) => {
        try {
            const userIdStr = userId.toString();
            const query = {
                $or: [
                    { senderId: userIdStr, receiverId: { $exists: true } },
                    { receiverId: userIdStr, senderId: { $exists: true } }
                ]
            };
            
            if (lastMessageTimestamp) {
                query.createdAt = { $lt: new Date(lastMessageTimestamp) };
            }
            
            const messages = await Message.find(query)
                .sort({ createdAt: -1 })
                .limit(limit);
            
            const hasMore = messages.length === limit;
            
            if (messages.length > 0) {
                socket.emit("syncResponse", {
                    messages: messages.reverse(),
                    hasMore,
                    syncTimestamp: messages[0]?.createdAt
                });
            } else {
                socket.emit("syncResponse", {
                    messages: [],
                    hasMore: false
                });
            }
        } catch (error) {
            console.log("Sync error:", error.message);
        }
    });
    
})

//middleware setup
app.use(express.json({limit: "4mb"}));
app.use(cors());

//routes setup
app.use("/api/status", (req, res)=> res.send("server is live"));
app.use("/api/auth", router)
app.use("/api/messages", messageRouter)
app.use("/api/groups", groupRouter)

// DB connect

await connectDB();

const PORT = process.env.PORT || 5000;
server.listen(PORT, ()=> console.log("server is running on PORT: " +  PORT));