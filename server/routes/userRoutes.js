import { Router } from "express";
import { checkAuth, login, Signup, updateProfile, refreshToken, getUserStatus } from "../controllers/user.controller.js";
import { protectRoute } from "../middleware/auth.js";



const router = Router();

router.post("/signup", Signup)
router.post("/login", login)
router.put("/update-profile", protectRoute, updateProfile)
router.get("/check", protectRoute, checkAuth)
router.post("/refresh-token", refreshToken)
router.get("/status/:userId", protectRoute, getUserStatus)

export default router;