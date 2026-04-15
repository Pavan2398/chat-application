import  express from "express";
import { protectRoute } from "../middleware/auth.js";
import Message from "../models/Message.model.js";
import { getMessages, getUsersForSidebar, markMessageAsSeen, sendMessage, updateMessage, deleteMessage } from "../controllers/messageController.js";

const messageRouter = express.Router();

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.get("/:id", protectRoute, getMessages);
messageRouter.put("/mark/:id", protectRoute, markMessageAsSeen);
messageRouter.patch("/:id", protectRoute, updateMessage);
messageRouter.delete("/:id", protectRoute, deleteMessage);
messageRouter.post("/send/:id", protectRoute, sendMessage);
messageRouter.patch("/:id/react", protectRoute, async (req, res) => {
    try {
        const { id } = req.params;
        const { emoji } = req.body;
        const userId = req.user._id;
        
        const message = await Message.findById(id);
        if (!message) {
            return res.json({ success: false, message: "Message not found" });
        }
        
        let reactions = message.reactions || {};
        
        if (emoji) {
            reactions[userId.toString()] = emoji;
        }
        
        const updatedMessage = await Message.findByIdAndUpdate(
            id,
            { reactions },
            { new: true }
        ).populate("senderId", "_id fullName profilePic");
        
        const { getIO } = await import("../lib/socket.js");
        const io = getIO();
        if (io) {
            io.emit("messageUpdated", updatedMessage);
        }
        
        res.json({ success: true, updatedMessage });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

messageRouter.patch("/:id/react/remove", protectRoute, async (req, res) => {
    try {
        const { id } = req.params;
        const { emoji } = req.body;
        const userId = req.user._id;
        
        const message = await Message.findById(id);
        if (!message) {
            return res.json({ success: false, message: "Message not found" });
        }
        
        let reactions = message.reactions || {};
        delete reactions[userId.toString()];
        
        const updatedMessage = await Message.findByIdAndUpdate(
            id,
            { reactions },
            { new: true }
        ).populate("senderId", "_id fullName profilePic");
        
        const { getIO } = await import("../lib/socket.js");
        const io = getIO();
        if (io) {
            io.emit("messageUpdated", updatedMessage);
        }
        
        res.json({ success: true, updatedMessage });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

messageRouter.post("/reconcile", protectRoute, async (req, res) => {
    try {
        const { clientMessageIds } = req.body;
        
        if (!clientMessageIds || !Array.isArray(clientMessageIds)) {
            return res.json({ success: false, message: "Invalid request" });
        }
        
        const messages = await Message.find({ 
            clientMessageId: { $in: clientMessageIds } 
        }).populate("senderId", "_id fullName profilePic");
        
        const results = clientMessageIds.map(clientId => {
            const msg = messages.find(m => m.clientMessageId === clientId);
            return {
                clientMessageId: clientId,
                exists: !!msg,
                serverMessageId: msg?._id,
                message: msg,
                isDuplicate: msg?.clientMessageId !== clientId
            };
        });
        
        res.json({ success: true, results });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});


export default messageRouter;

