import cloudinary from "../lib/cloudinary.js";
import Message from "../models/Message.model.js";
import User from "../models/User.model.js";
import { io, userSocketMap } from "../server.js";


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

            const senderSocketId = userSocketMap[selectedUserId];
            if (senderSocketId) {
                io.to(senderSocketId).emit("messageStatusUpdate", {
                    messageIds: unreadIds,
                    status: "read",
                });
            }
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
            const senderSocketId = userSocketMap[updatedMessage.senderId];
            if(senderSocketId){
                io.to(senderSocketId).emit("messageStatusUpdate", {
                    messageIds: [updatedMessage._id],
                    status: "read"
                });
            }
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

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Message text is required for editing" });
    }

    const updatedMessage = await Message.findByIdAndUpdate(
      id,
      { text: text.trim(), edited: true },
      { new: true }
    );

    const receiverSocketId = userSocketMap[updatedMessage.receiverId];
    const senderSocketId = userSocketMap[updatedMessage.senderId];

    [receiverSocketId, senderSocketId].forEach((socketId) => {
      if (socketId) {
        io.to(socketId).emit("messageUpdated", updatedMessage);
      }
    });

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

    const receiverSocketId = userSocketMap[updatedMessage.receiverId];
    const senderSocketId = userSocketMap[updatedMessage.senderId];

    [receiverSocketId, senderSocketId].forEach((socketId) => {
      if (socketId) {
        io.to(socketId).emit("messageDeleted", updatedMessage);
      }
    });

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

        let newMessage;
        try {
            newMessage = await Message.create({
                senderId,
                receiverId,
                text,
                image: imageUrl,
                clientMessageId: clientMessageId || null,
                status: "sent"
            });
        } catch (createErr) {
            if (createErr.code === 11000 && createErr.keyPattern?.clientMessageId) {
                const existing = await Message.findOne({ clientMessageId });
                return res.json({
                    success: true,
                    newMessage: existing,
                    isDuplicate: true
                });
            }
            throw createErr;
        }

        // Emit ACK to sender via socket
        const senderSocketId = userSocketMap[senderId.toString()];
        if (senderSocketId) {
            io.to(senderSocketId).emit("messageAck", {
                clientMessageId,
                serverMessageId: newMessage._id,
                status: "sent"
            });
        }

        // emit the new message to the receivers socket
        const receiverSocketId = userSocketMap[receiverId];
        if(receiverSocketId){
            io.to(receiverSocketId).emit("newMessage", newMessage)                                                                                                                                                                               
        }

        res.json({success: true, newMessage});
        
    } catch (error) {
         console.log(error.Message);
        res.json({success: false, message: error.Message})
    }
}