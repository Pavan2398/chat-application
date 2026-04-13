import mongoose, { Schema } from "mongoose";


const userSchema = new Schema({

    email: {
        type: String,
        required: true,
        unique: true
    },
    fullName: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    profilePic: {
        type: String,
        default: ""
    },
    bio: {
        type: String,
        default: ""
    },
    lastSeen: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ["online", "offline", "away", "busy"],
        default: "offline"
    },

},
{timestamps: true})

const User =  mongoose.model("User", userSchema);

export default User;