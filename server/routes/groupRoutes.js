import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { 
    createGroup, 
    getGroups, 
    getGroupMessages, 
    sendGroupMessage, 
    addParticipant, 
    removeParticipant, 
    leaveGroup,
    updateGroup
} from "../controllers/groupController.js";

const groupRouter = express.Router();

groupRouter.post("/create", protectRoute, createGroup);
groupRouter.get("/all", protectRoute, getGroups);
groupRouter.get("/:groupId/messages", protectRoute, getGroupMessages);
groupRouter.post("/:groupId/messages", protectRoute, sendGroupMessage);
groupRouter.post("/:groupId/add", protectRoute, addParticipant);
groupRouter.post("/:groupId/remove", protectRoute, removeParticipant);
groupRouter.post("/:groupId/leave", protectRoute, leaveGroup);
groupRouter.put("/:groupId", protectRoute, updateGroup);

export default groupRouter;