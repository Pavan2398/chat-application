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


export default messageRouter;

