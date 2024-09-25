import { Router } from "express";
import {
	depositAmount
} from "../controllers/wallet.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"; // Middleware for verifying JWT

const router = Router(); // Initialize express router

router.route("/depositAmount").post(verifyJWT, depositAmount);

export default router; // Export the router for use in the app
