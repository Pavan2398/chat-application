import ChatRoom from "../models/ChatRoom.model.js";
import User from "../models/User.model.js";
import { io } from "../lib/socket.js";
import checkMessageRate from "../middleware/rateLimiter.js";

// Helper function to sanitize input - prevents XSS attacks
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .trim();
};

// Helper function to validate text (for messages and group names)
const validateText = (text, maxLength = 1000, fieldName = "Text") => {
    if (!text || typeof text !== 'string') {
        return { valid: false, message: `${fieldName} is required` };
    }
    
    const trimmed = text.trim();
    
    if (trimmed.length === 0) {
        return { valid: false, message: `${fieldName} cannot be empty` };
    }
    
    if (trimmed.length > maxLength) {
        return { valid: false, message: `${fieldName} is too long (max ${maxLength} characters)` };
    }
    
    // Check for potential malicious patterns
    const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
    ];
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(trimmed)) {
            return { valid: false, message: `${fieldName} contains invalid content` };
        }
    }
    
    return { valid: true, text: trimmed };
};

export const createGroup = async (req, res) => {
    try {
        const { name, groupPic, participantIds } = req.body;
        const adminId = req.user._id;

        // Validate group name
        const nameValidation = validateText(name, 100, "Group name");
        if (!nameValidation.valid) {
            return res.json({ success: false, message: nameValidation.message });
        }

        if (!participantIds || participantIds.length < 2) {
            return res.json({ success: false, message: "Add at least 2 participants" });
        }

        const uniqueParticipants = [...new Set([...participantIds, adminId.toString()])];
        
        const existingGroup = await ChatRoom.findOne({
            name: nameValidation.text,
            participants: { $all: uniqueParticipants.map(id => id) }
        });

        if (existingGroup) {
            return res.json({ success: false, message: "Group with same name and participants already exists" });
        }

        // Sanitize group name and groupPic
        const sanitizedName = sanitizeInput(nameValidation.text);
        const sanitizedGroupPic = groupPic ? sanitizeInput(groupPic) : "";

        const newGroup = await ChatRoom.create({
            name: sanitizedName,
            groupPic: sanitizedGroupPic,
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
        const { text, image, clientMessageId } = req.body;
        const senderId = req.user._id;

        // Validate message text
        if (text) {
            const textValidation = validateText(text, 10000, "Message");
            if (!textValidation.valid) {
                return res.json({ success: false, message: textValidation.message });
            }
        }

        // Rate limiting check
        const rateCheck = checkMessageRate(senderId.toString());
        if (!rateCheck.allowed) {
            return res.status(429).json({ 
                success: false, 
                message: "Rate limit exceeded",
                retryAfter: rateCheck.retryAfter 
            });
        }

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

        // Sanitize text
        const sanitizedText = text ? sanitizeInput(text) : null;

        let newMessage;
        try {
            newMessage = await Message.create({
                senderId,
                text: sanitizedText,
                image: imageUrl,
                groupId,
                clientMessageId: clientMessageId || null,
                status: "sent"
            });
        } catch (createErr) {
            if (createErr.code === 11000 && createErr.keyPattern?.clientMessageId) {
                return res.json({
                    success: true,
                    clientMessageId,
                    isDuplicate: true
                });
            }
            throw createErr;
        }

        const populatedMessage = await Message.findById(newMessage._id)
            .populate("senderId", "_id fullName profilePic");

        // Emit ACK to sender via user room (works across all servers)
        io.to(`user:${senderId.toString()}`).emit("messageAck", {
            clientMessageId,
            serverMessageId: newMessage._id,
            status: "sent",
            isGroup: true,
            groupId
        });

        await ChatRoom.findByIdAndUpdate(groupId, {
            lastMessage: newMessage._id,
            lastMessageText: text || (image ? "📷 Image" : ""),
            lastMessageAt: new Date()
        });

        // Emit to all participants' user rooms (multi-server support)
        group.participants.forEach(participantId => {
            io.to(`user:${participantId}`).emit("newGroupMessage", populatedMessage);
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
        const { userId, userIds } = req.body;
        const adminId = req.user._id;

        const group = await ChatRoom.findById(groupId);
        
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        if (group.admin.toString() !== adminId.toString()) {
            return res.status(403).json({ success: false, message: "Only admin can add participants" });
        }

        const idsToAdd = userIds || (userId ? [userId] : []);
        
        for (const id of idsToAdd) {
            // Convert to string for comparison
            const idStr = id.toString();
            if (!group.participants.some(p => p.toString() === idStr)) {
                group.participants.push(id);
            }
        }
        
        await group.save();

        const updatedGroup = await ChatRoom.findById(groupId)
            .populate("participants", "_id fullName profilePic")
            .populate("admin", "_id fullName profilePic");

        res.json({ success: true, group: updatedGroup });
    } catch (error) {
        console.log("Add participant error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const removeParticipant = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;
        const adminId = req.user._id;

        const group = await ChatRoom.findById(groupId);
        
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        if (group.admin.toString() !== adminId.toString()) {
            return res.status(403).json({ success: false, message: "Only admin can remove participants" });
        }

        if (userId === group.admin.toString()) {
            return res.status(400).json({ success: false, message: "Cannot remove admin" });
        }

        group.participants = group.participants.filter(p => p.toString() !== userId);
        await group.save();

        const updatedGroup = await ChatRoom.findById(groupId)
            .populate("participants", "_id fullName profilePic")
            .populate("admin", "_id fullName profilePic");

        res.json({ success: true, group: updatedGroup });
    } catch (error) {
        console.log("Remove participant error:", error.message);
        res.status(500).json({ success: false, message: error.message });
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

        // Validate group name if provided
        if (name) {
            const nameValidation = validateText(name, 100, "Group name");
            if (!nameValidation.valid) {
                return res.json({ success: false, message: nameValidation.message });
            }
        }

        const group = await ChatRoom.findById(groupId);
        
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        if (group.admin.toString() !== adminId.toString()) {
            return res.status(403).json({ success: false, message: "Only admin can update group" });
        }

        // Sanitize inputs
        if (name) group.name = sanitizeInput(name.trim());
        if (groupPic !== undefined) group.groupPic = groupPic ? sanitizeInput(groupPic) : "";
        
        await group.save();

        const updatedGroup = await ChatRoom.findById(groupId)
            .populate("participants", "_id fullName profilePic")
            .populate("admin", "_id fullName profilePic");

        res.json({ success: true, group: updatedGroup });
    } catch (error) {
        console.log("Update group error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};