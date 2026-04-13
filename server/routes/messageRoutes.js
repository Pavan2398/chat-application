import  express from "express";
import { protectRoute } from "../middleware/auth.js";
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
        
        const reactions = message.reactions || new Map();
        
        if (!reactions.has(userId.toString())) {
            reactions.set(userId.toString(), { userId, emoji });
        } else {
            const existing = reactions.get(userId.toString());
            existing.emoji = emoji;
            reactions.set(userId.toString(), existing);
        }
        
        const updatedMessage = await Message.findByIdAndUpdate(
            id,
            { reactions: Object.fromEntries(reactions) },
            { new: true }
        ).populate("senderId", "_id fullName profilePic");
        
        res.json({ success: true, updatedMessage });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});


export default messageRouter;

