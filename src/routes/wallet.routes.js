import { Router } from "express";
import {
  depositAmount,
  generateQr,
  handleRequestMoney,
} from "../controllers/wallet.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"; // Middleware for verifying JWT

const router = Router(); // Initialize express router

router.route("/depositAmount").post(verifyJWT, depositAmount);
router.route("/sendQRForPayment").post(verifyJWT, generateQr);
router.route("/checkmoney").post(verifyJWT, handleRequestMoney);

export default router; // Export the router for use in the app
