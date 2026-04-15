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

// initialize socket.io server
import { initIO, getIO } from "./lib/socket.js";
export const io = initIO(server);

// store online users
export const userSocketMap = {};   // {userId: socketId}

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
            return next(new Error("Token expired"));
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

    if(userId) {
        userSocketMap[userId] = socket.id;
        
        await User.findByIdAndUpdate(userId, { 
            status: "online",
            lastSeen: new Date()
        });
    }

    // emit online users to all connected clients
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    // broadcast status update
    io.emit("userStatusUpdate", { userId, status: "online" });

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
            delete userSocketMap[userId];
            
            await User.findByIdAndUpdate(userId, { 
                status: "offline",
                lastSeen: lastSeen
            });
            
            io.emit("userStatusUpdate", { 
                userId, 
                status: "offline",
                lastSeen: lastSeen.toISOString()
            });
        }
        
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    })

    // typing indicator events
    socket.on('typing', ({ from, to }) => {
        const receiverSocketId = userSocketMap[to];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('userTyping', { from });
        }
    });

    socket.on('stopTyping', ({ from, to }) => {
        const receiverSocketId = userSocketMap[to];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('userStopTyping', { from });
        }
    });

    socket.on("messageDelivered", async ({ messageId, to }) => {
        try {
            const updatedMessage = await Message.findByIdAndUpdate(
                messageId,
                { status: "delivered" },
                { new: true }
            );
            if (updatedMessage && userSocketMap[to]) {
                io.to(userSocketMap[to]).emit("messageStatusUpdate", {
                    messageIds: [updatedMessage._id],
                    status: "delivered",
                });
                
                // Emit delivery ACK to sender
                const senderSocketId = userSocketMap[updatedMessage.senderId.toString()];
                if (senderSocketId) {
                    io.to(senderSocketId).emit("messageAck", {
                        clientMessageId: updatedMessage.clientMessageId,
                        serverMessageId: updatedMessage._id,
                        status: "delivered"
                    });
                }
            }
        } catch (error) {
            console.log(error.message);
        }
    });

    socket.on("messageRead", async ({ messageId, to }) => {
        try {
            const updatedMessage = await Message.findByIdAndUpdate(
                messageId,
                { status: "read" },
                { new: true }
            );
            if (updatedMessage && userSocketMap[to]) {
                io.to(userSocketMap[to]).emit("messageStatusUpdate", {
                    messageIds: [updatedMessage._id],
                    status: "read",
                });
                
                // Emit read ACK to sender
                const senderSocketId = userSocketMap[updatedMessage.senderId.toString()];
                if (senderSocketId) {
                    io.to(senderSocketId).emit("messageAck", {
                        clientMessageId: updatedMessage.clientMessageId,
                        serverMessageId: updatedMessage._id,
                        status: "read"
                    });
                }
            }
        } catch (error) {
            console.log(error.message);
        }
    });

    // Sync missed messages on reconnect
    socket.on("syncMessages", async ({ lastMessageId, lastMessageTimestamp }) => {
        try {
            const userIdStr = userId.toString();
            const messages = await Message.find({
                _id: { $gt: lastMessageId },
                $or: [
                    { senderId: userIdStr, receiverId: { $exists: true } },
                    { receiverId: userIdStr, senderId: { $exists: true } }
                ]
            }).sort({ createdAt: 1 }).limit(100);

            if (messages.length > 0) {
                socket.emit("syncResponse", {
                    messages,
                    syncTimestamp: Date.now()
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
