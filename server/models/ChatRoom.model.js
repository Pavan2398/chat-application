import mongoose, { Schema } from "mongoose";

const chatRoomSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    groupPic: {
        type: String,
        default: ""
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message"
    },
    lastMessageText: {
        type: String,
        default: ""
    },
    lastMessageAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ updatedAt: -1 });

const ChatRoom = mongoose.model("ChatRoom", chatRoomSchema);

export default ChatRoom;