import mongoose, { Schema } from "mongoose"

const messageSchema = new Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ChatRoom"
    },
    text: {
        type: String
    },
    image: {
        type: String
    },
    status: {
        type: String,
        enum: ["sent", "delivered", "read"],
        default: "sent"
    },
    edited: {
        type: Boolean,
        default: false
    },
    deleted: {
        type: Boolean,
        default: false
    },
    reactions: {
        type: Map,
        of: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            emoji: String
        }],
        default: {}
    }

}, {timestamps: true});

messageSchema.index({ groupId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;