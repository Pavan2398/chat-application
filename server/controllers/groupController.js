import ChatRoom from "../models/ChatRoom.model.js";
import User from "../models/User.model.js";
import { io, userSocketMap } from "../server.js";

export const createGroup = async (req, res) => {
    try {
        const { name, groupPic, participantIds } = req.body;
        const adminId = req.user._id;

        if (!name || !name.trim()) {
            return res.json({ success: false, message: "Group name is required" });
        }

        if (!participantIds || participantIds.length < 2) {
            return res.json({ success: false, message: "Add at least 2 participants" });
        }

        const uniqueParticipants = [...new Set([...participantIds, adminId.toString()])];
        
        const existingGroup = await ChatRoom.findOne({
            name: name.trim(),
            participants: { $all: uniqueParticipants.map(id => id) }
        });

        if (existingGroup) {
            return res.json({ success: false, message: "Group with same name and participants already exists" });
        }

        const newGroup = await ChatRoom.create({
            name: name.trim(),
            groupPic: groupPic || "",
            participants: uniqueParticipants,
            admin: adminId
        });

        const groupWithDetails = await ChatRoom.findById(newGroup._id)
            .populate("participants", "_id fullName profilePic")
            .populate("admin", "_id fullName profilePic");

        res.json({ 
            success: true, 
            group: groupWithDetails,
            message: "Group created successfully" 
        });
    } catch (error) {
        console.log("Create group error:", error.message);
        res.json({ success: false, message: error.message });
    }
};

export const getGroups = async (req, res) => {
    try {
        const userId = req.user._id;
        
        const groups = await ChatRoom.find({ 
            participants: userId 
        })
        .populate("participants", "_id fullName profilePic")
        .populate("admin", "_id fullName profilePic")
        .sort({ updatedAt: -1 });

        res.json({ success: true, groups });
    } catch (error) {
        console.log("Get groups error:", error.message);
        res.json({ success: false, message: error.message });
    }
};

export const getGroupMessages = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;
        const limit = Math.max(Number(req.query.limit) || 20);
        const page = Math.max(Number(req.query.page) || 1);

        const group = await ChatRoom.findById(groupId);
        
        if (!group) {
            return res.json({ success: false, message: "Group not found" });
        }

        if (!group.participants.some(p => p.toString() === userId.toString())) {
            return res.json({ success: false, message: "You're not a member of this group" });
        }

        const Message = (await import("../models/Message.model.js")).default;
        
        const query = { groupId };
        
        const messages = await Message.find(query)
            .populate("senderId", "_id fullName profilePic")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ 
            success: true, 
            messages: messages.reverse(),
            group: {
                _id: group._id,
                name: group.name,
                groupPic: group.groupPic,
                participants: group.participants,
                admin: group.admin
            }
        });
    } catch (error) {
        console.log("Get group messages error:", error.message);
        res.json({ success: false, message: error.message });
    }
};

export const sendGroupMessage = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { text, image } = req.body;
        const senderId = req.user._id;

        const group = await ChatRoom.findById(groupId);
        
        if (!group) {
            return res.json({ success: false, message: "Group not found" });
        }

        if (!group.participants.some(p => p.toString() === senderId.toString())) {
            return res.json({ success: false, message: "You're not a member of this group" });
        }

        const Message = (await import("../models/Message.model.js")).default;
        
        let imageUrl;
        if (image) {
            const cloudinary = (await import("../lib/cloudinary.js")).default;
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = await Message.create({
            senderId,
            text,
            image: imageUrl,
            groupId
        });

        const populatedMessage = await Message.findById(newMessage._id)
            .populate("senderId", "_id fullName profilePic");

        await ChatRoom.findByIdAndUpdate(groupId, {
            lastMessage: newMessage._id,
            lastMessageText: text || (image ? "📷 Image" : ""),
            lastMessageAt: new Date()
        });

        group.participants.forEach(participantId => {
            const socketId = userSocketMap[participantId];
            if (socketId) {
                io.to(socketId).emit("newGroupMessage", populatedMessage);
            }
        });

        res.json({ success: true, newMessage: populatedMessage });
    } catch (error) {
        console.log("Send group message error:", error.message);
        res.json({ success: false, message: error.message });
    }
};

export const addParticipant = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;
        const adminId = req.user._id;

        const group = await ChatRoom.findById(groupId);
        
        if (!group) {
            return res.json({ success: false, message: "Group not found" });
        }

        if (group.admin.toString() !== adminId.toString()) {
            return res.json({ success: false, message: "Only admin can add participants" });
        }

        if (group.participants.includes(userId)) {
            return res.json({ success: false, message: "User already in group" });
        }

        group.participants.push(userId);
        await group.save();

        const updatedGroup = await ChatRoom.findById(groupId)
            .populate("participants", "_id fullName profilePic")
            .populate("admin", "_id fullName profilePic");

        res.json({ success: true, group: updatedGroup });
    } catch (error) {
        console.log("Add participant error:", error.message);
        res.json({ success: false, message: error.message });
    }
};

export const removeParticipant = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;
        const adminId = req.user._id;

        const group = await ChatRoom.findById(groupId);
        
        if (!group) {
            return res.json({ success: false, message: "Group not found" });
        }

        if (group.admin.toString() !== adminId.toString()) {
            return res.json({ success: false, message: "Only admin can remove participants" });
        }

        if (userId === group.admin.toString()) {
            return res.json({ success: false, message: "Cannot remove admin" });
        }

        group.participants = group.participants.filter(p => p.toString() !== userId);
        await group.save();

        const updatedGroup = await ChatRoom.findById(groupId)
            .populate("participants", "_id fullName profilePic")
            .populate("admin", "_id fullName profilePic");

        res.json({ success: true, group: updatedGroup });
    } catch (error) {
        console.log("Remove participant error:", error.message);
        res.json({ success: false, message: error.message });
    }
};

export const leaveGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await ChatRoom.findById(groupId);
        
        if (!group) {
            return res.json({ success: false, message: "Group not found" });
        }

        if (group.admin.toString() === userId.toString()) {
            if (group.participants.length === 1) {
                await ChatRoom.findByIdAndDelete(groupId);
                return res.json({ success: true, message: "Group deleted" });
            }
            
            const newAdmin = group.participants.find(p => p.toString() !== userId.toString());
            group.admin = newAdmin;
        }

        group.participants = group.participants.filter(p => p.toString() !== userId.toString());
        
        if (group.participants.length < 3) {
            await ChatRoom.findByIdAndDelete(groupId);
            return res.json({ success: true, message: "Group deleted (less than 3 members)" });
        }
        
        await group.save();

        const updatedGroup = await ChatRoom.findById(groupId)
            .populate("participants", "_id fullName profilePic")
            .populate("admin", "_id fullName profilePic");

        res.json({ success: true, group: updatedGroup, message: "Left group successfully" });
    } catch (error) {
        console.log("Leave group error:", error.message);
        res.json({ success: false, message: error.message });
    }
};

export const updateGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, groupPic } = req.body;
        const adminId = req.user._id;

        const group = await ChatRoom.findById(groupId);
        
        if (!group) {
            return res.json({ success: false, message: "Group not found" });
        }

        if (group.admin.toString() !== adminId.toString()) {
            return res.json({ success: false, message: "Only admin can update group" });
        }

        if (name) group.name = name.trim();
        if (groupPic !== undefined) group.groupPic = groupPic;
        
        await group.save();

        const updatedGroup = await ChatRoom.findById(groupId)
            .populate("participants", "_id fullName profilePic")
            .populate("admin", "_id fullName profilePic");

        res.json({ success: true, group: updatedGroup });
    } catch (error) {
        console.log("Update group error:", error.message);
        res.json({ success: false, message: error.message });
    }
};