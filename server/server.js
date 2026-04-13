import express from "express"
import "dotenv/config"
import cors from "cors"
import http from "http"
import { connectDB } from "./lib/db.js";
import router from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import groupRouter from "./routes/groupRoutes.js";
import { Server } from "socket.io";
import Message from "./models/Message.model.js";
import User from "./models/User.model.js";

const app = express();
const server = http.createServer(app)

// initialize socket.io server
export const io = new Server(server, {
    cors: {origin: "*"}
})

// store online users
export const userSocketMap = {};   // {userId: socketId}

// socket.io connection handler
io.on("connection", async (socket)=>{
    const userId = socket.handshake.query.userId;
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
            }
        } catch (error) {
            console.log(error.message);
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
