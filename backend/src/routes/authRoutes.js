import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  signup,
  signin,
  getMe,
  updateProfile,
  changePassword,
  logout,
} from "../controllers/Authcontroller.js";

const router = express.Router();

// Public routes
router.post("/signup", signup);
router.post("/signin", signin);

// Protected routes
router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateProfile);
router.put("/change-password", requireAuth, changePassword);
router.post("/logout", requireAuth, logout);

export default router;
