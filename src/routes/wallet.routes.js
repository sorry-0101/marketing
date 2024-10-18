import { Router } from "express";
import {
  depositAmount,
  generateQr,
  //   handleRequestMoney,
  addDepositAmountAdmin,
  getWalletBalanceUser,
  //   getUserRecordsWithTransactions,
  getAllWalletTransactions,
  handleRequestMoneyTest,
  allPaymentRequestOfUser,
} from "../controllers/wallet.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"; // Middleware for verifying JWT

const router = Router(); // Initialize express router

router.route("/depositAmount").post(verifyJWT, depositAmount);
router.route("/sendQRForPayment").post(verifyJWT, generateQr);
// router.route("/checkmoney").post(verifyJWT, handleRequestMoney);
router.route("/depositAmountAdmin").post(verifyJWT, addDepositAmountAdmin);
router.route("/allWalletTransaction").get(verifyJWT, getAllWalletTransactions);
router.route("/payment-requests").post(verifyJWT, allPaymentRequestOfUser);
// router.route("/getAllTransaction") .post(verifyJWT, getUserRecordsWithTransactions);
router.route("/balanceUser").get(getWalletBalanceUser);

router.post("/check-payment-status", (req, res) => {
  const { trackId, userId } = req.body;

  if (!trackId || !userId) {
    return res.status(400).json({ message: "trackId and userId are required" });
  }

  // Invoke handleRequestMoney
  handleRequestMoneyTest(req, res, { trackId, userId });
});
router.route("/payment-requests").post(verifyJWT, allPaymentRequestOfUser);

export default router;
