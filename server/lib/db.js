import mongoose from "mongoose";

const moongose = mongoose

export const connectDB = async ()=>{
    try {
        moongose.connection.on('connected', ()=> console.log('Database Connected'));
        moongose.connection.on('error', (err) => console.log('Database error:', err));
        moongose.connection.on('disconnected', () => console.log('Database disconnected - reconnecting...'));
        
        await mongoose.connect(`${process.env.MONGODB_URI}/chat-app`, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
        });
    } catch (error) {
        console.log("MONGODB CONNECTION ERROR", error.message);
        // Retry connection after 5 seconds
        setTimeout(() => connectDB(), 5000);
    }
}