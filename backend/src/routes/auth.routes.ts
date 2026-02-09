import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth";
import { asyncHandler } from "../middlewares/errorHandler";

const router = Router();

// Public routes
router.post("/signup", asyncHandler(authController.signup.bind(authController)));
router.post("/login", asyncHandler(authController.login.bind(authController)));
router.post("/refresh", asyncHandler(authController.refresh.bind(authController)));

// Protected routes
router.get("/me", authenticate, asyncHandler(authController.me.bind(authController)));
router.put("/profile", authenticate, asyncHandler(authController.updateProfile.bind(authController)));

export default router;
