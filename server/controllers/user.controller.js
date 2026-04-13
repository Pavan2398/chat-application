import { generateToken } from "../lib/utils.js";
import User from "../models/User.model.js";
import bcrypt from "bcryptjs"
import cloudinary from "../lib/cloudinary.js"
import jwt from "jsonwebtoken"


//Signup new user
export const Signup = async (req, res)=>{
    const {fullName, email, password, bio} = req.body;

    try {
        if(!fullName || !email || !password ){
            return res.json({success: false, message: "Missing Details"})
        }
        const user = await User.findOne({email});

        if(user){
             return res.json({success: false, message: "Account already exists"})
        }

const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt)

const newUser = await User.create({
    fullName, email, password: hashedPassword, bio
});

const token = generateToken(newUser._id)

res.json({success: true, userData: newUser, token,
     message: "Account created successfully"})

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: "failed to create account"})
        
    }
}


//user login controller

export const login = async (req, res)=>{
    try {

        const {email, password} = req.body;

        const userData = await User.findOne({email})

         if (!userData) {
    return res.json({success: false, message: "User does not exist"});
  }
        
        const isPasswordCorrect = await bcrypt.compare(password, userData.password);


        if(!isPasswordCorrect){
            return res.json({success: false, message: "password incorrect"});
        }

        const token = generateToken(userData._id)

        res.json({success: true, userData, token, 
            message: "logged In successfully"
        })
        
    } catch (error) {

          console.log(error.message);
        res.json({success: false, message: "failed to log in"})
        
    }
}

// user auth controller
export const checkAuth = (req, res)=>{
    res.json({success: true, user: req.user});
}

//controller to update user profile details
export const updateProfile = async (req, res)=>{
    try{
        const { profilePic, bio, fullName } = req.body;

        const userId = req.user._id;
        let updatedUser;

        if (!profilePic) {
            updatedUser = await User.findByIdAndUpdate(userId, {bio, fullName},
                {new: true}
            );
        } else {
            const upload = await cloudinary.uploader.upload(profilePic);

            updatedUser = await User.findByIdAndUpdate(userId, {profilePic: upload.secure_url, bio, fullName},
                {new: true}
            )
        }

        res.json({success: true, user: updatedUser})

    } catch(error){
        console.log(error.message);
        

        res.json({success: false, message: error.message})
    }
}

export const refreshToken = async (req, res) => {
    try {
        const token = req.headers.token;
        
        if (!token) {
            return res.json({ success: false, message: "No token provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        const newToken = generateToken(user._id);

        res.json({ 
            success: true, 
            token: newToken,
            userData: user
        });
    } catch (error) {
        console.log("Token refresh error:", error.message);
        res.json({ success: false, message: "Invalid token" });
    }
}

export const getUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId).select("status lastSeen fullName profilePic");
        
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        res.json({ 
            success: true, 
            user: {
                _id: user._id,
                status: user.status,
                lastSeen: user.lastSeen,
                fullName: user.fullName,
                profilePic: user.profilePic
            }
        });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}