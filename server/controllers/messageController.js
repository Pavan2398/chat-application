import cloudinary from "../lib/cloudinary.js";
import Message from "../models/Message.model.js";
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

// Helper function to validate message text
const validateMessageText = (text) => {
    if (!text || typeof text !== 'string') {
        return { valid: false, message: "Message text is required" };
    }
    
    const trimmed = text.trim();
    
    if (trimmed.length === 0) {
        return { valid: false, message: "Message cannot be empty" };
    }
    
    if (trimmed.length > 10000) {
        return { valid: false, message: "Message is too long (max 10000 characters)" };
    }
    
    // Check for potential malicious patterns
    const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
    ];
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(trimmed)) {
            return { valid: false, message: "Message contains invalid content" };
        }
    }
    
    return { valid: true, text: trimmed };
};


// Get all users except the logged in user



export const getUsersForSidebar = async (req, res)=>{
    try {
        const userId = req.user._id;
        const filteredUsers = await User.find({_id: {$ne: userId}}).select("-password");

        // count number of messages not seen

        const unseenMessages = {}
        const promises = filteredUsers.map(async (user)=>{
            const messages = await Message.find({
                senderId: user._id,
                receiverId: userId,
                status: {$ne: "read"}
            })
            if(messages.length > 0){
                unseenMessages[user._id] = messages.length;
            }
        })
        await Promise.all(promises);
        res.json({success: true, users: filteredUsers, unseenMessages})  
        
    } catch (error) {
        console.log(error.Message);
        res.json({success: false, message: error.Message})
        
        
    }
}

// Get all messages for selected user
export const getMessages = async (req, res)=>{
    try {
        const { id: selectedUserId } = req.params;
        const myId = req.user._id;
        const limit = Math.max(Number(req.query.limit) || 20, 1);
        const page = Math.max(Number(req.query.page) || 1, 1);

        const query = {
            $or: [
                { senderId: myId, receiverId: selectedUserId },
                { senderId: selectedUserId, receiverId: myId },
            ],
        };

        const totalMessages = await Message.countDocuments(query);
        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const unreadMessages = await Message.find({
            senderId: selectedUserId,
            receiverId: myId,
            status: { $ne: "read" },
        });

        if (unreadMessages.length > 0) {
            const unreadIds = unreadMessages.map((msg) => msg._id);
            await Message.updateMany({ _id: { $in: unreadIds } }, { status: "read" });

            io.to(`user:${selectedUserId}`).emit("messageStatusUpdate", {
                messageIds: unreadIds,
                status: "read",
            });
        }

        res.json({
            success: true,
            messages: messages.reverse(),
            page,
            limit,
            totalMessages,
            hasMore: page * limit < totalMessages,
        });
    } catch (error) {
        console.log(error.Message);
        res.json({ success: false, message: error.Message });
    }
}

// api to mark message as seen using message id
export const markMessageAsSeen = async (req, res)=>{

    try {
        const { id } = req.params;
        const updatedMessage = await Message.findByIdAndUpdate(
            id,
            {status: "read"},
            {new: true}
        );

        if(updatedMessage){
            io.to(`user:${updatedMessage.senderId}`).emit("messageStatusUpdate", {
                messageIds: [updatedMessage._id],
                status: "read"
            });
        }

        res.json({success: true})
        
    } catch (error) {
        console.log(error.Message);
        res.json({success: false, message: error.Message})
    }

}

export const updateMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    
    // Validate message text
    if (text) {
        const validation = validateMessageText(text);
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: validation.message });
        }
    }
    
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "You can only edit your own messages" });
    }

    if (message.deleted) {
      return res.status(400).json({ success: false, message: "Cannot edit a deleted message" });
    }

    // Sanitize the text
    const sanitizedText = text ? sanitizeInput(text.trim()) : message.text;

    const updatedMessage = await Message.findByIdAndUpdate(
      id,
      { text: sanitizedText, edited: true },
      { new: true }
    );

    io.to(`user:${updatedMessage.receiverId}`).emit("messageUpdated", updatedMessage);
    io.to(`user:${updatedMessage.senderId}`).emit("messageUpdated", updatedMessage);

    res.json({ success: true, updatedMessage });
  } catch (error) {
    console.log(error.Message);
    res.status(500).json({ success: false, message: error.Message });
  }
}

export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "You can only delete your own messages" });
    }

    const updatedMessage = await Message.findByIdAndUpdate(
      id,
      {
        deleted: true,
        text: "This message was deleted",
        image: null,
        edited: false,
      },
      { new: true }
    );

    io.to(`user:${updatedMessage.receiverId}`).emit("messageDeleted", updatedMessage);
    io.to(`user:${updatedMessage.senderId}`).emit("messageDeleted", updatedMessage);

    res.json({ success: true, deletedMessage: updatedMessage });
  } catch (error) {
    console.log(error.Message);
    res.status(500).json({ success: false, message: error.Message });
  }
}

// send message to selected user
export const sendMessage = async (req, res)=>{
    try {
        const {text, image, clientMessageId} = req.body;
        const receiverId = req.params.id;
        const senderId = req.user._id;

        // Validate message text
        if (text) {
            const validation = validateMessageText(text);
            if (!validation.valid) {
                return res.json({ success: false, message: validation.message });
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

        // Authorization: Check if receiver exists and is valid
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.json({ success: false, message: "Receiver not found" });
        }

        let imageUrl;
        if(image){
            const uploadResponse = await cloudinary.uploader.upload(image)
            imageUrl = uploadResponse.secure_url;
        }

        // Sanitize text before saving
        const sanitizedText = text ? sanitizeInput(text) : null;

        let newMessage;
        try {
            newMessage = await Message.create({
                senderId,
                receiverId,
                text: sanitizedText,
                image: imageUrl,
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

        // Emit ACK to sender via user room (works across all servers)
        io.to(`user:${senderId.toString()}`).emit("messageAck", {
            clientMessageId,
            serverMessageId: newMessage._id,
            status: "sent"
        });

        // Emit new message to receiver's user room (multi-server + multi-device)
        io.to(`user:${receiverId}`).emit("newMessage", newMessage);

        res.json({success: true, newMessage});
        
    } catch (error) {
         console.log(error.Message);
        res.json({success: false, message: error.Message})
    }
}