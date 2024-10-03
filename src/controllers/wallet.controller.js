"use strict";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Wallet } from "../models/wallet.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import axios from "axios";

const depositAmount = asyncHandler(async (req, res) => {
  try {
    const { deposit_amount: depositAmount } = req.body;
    const userId = global?.logged_in_user?.userId || null;
    if (!depositAmount || !userId) {
      throw new ApiError(400, "Something went wrong");
    }

    const walletResponse = await Wallet.create({
      walletAmount: parseInt(depositAmount),
      userId,
    });

    walletResponse &&
      new ApiError(400, "Something went wrong while adding amount in wallet");

    const walletDetails = await Wallet.findById(walletResponse._id).select();

    return res
      .status(200)
      .json(
        new ApiResponse(200, walletDetails, "Amount is added successfully")
      );
  } catch (error) {
    throw new ApiError(400, error);
  }
});

const generateQr = asyncHandler(async (req, res) => {
  const { currencyName, email, amount, mobileNo, blockchain } = req.body;

  const userId = global?.logged_in_user?.userId || null; // Retrieve userId
  // Validate required fields
  if (!currencyName) {
    throw new ApiError(
      400,
      "currencyName is required (currencyName and blockchain)"
    );
  }
  if (!email) {
    throw new ApiError(400, "Email is required");
  }
  if (!amount) {
    throw new ApiError(400, "Amount is required");
  }
  if (!mobileNo) {
    throw new ApiError(400, "Phone is required");
  }
  if (!blockchain) {
    throw new ApiError(400, "Blockchain is required");
  }

  try {
    const response = await axios.post(
      "https://api.oxapay.com/merchants/request/whitelabel",
      {
        merchant: "NCV36N-GTMR3L-6XHTHD-62W176",
        currency: currencyName,
        payCurrency: currencyName,
        amount: amount,
        email: email,
        description: mobileNo,
        network: blockchain,
      }
    );

    if (response.data.result === 100) {
      const trackId = response.data.trackId;
      // Pass userId to handleRequestMoney
      handleRequestMoney(req, res, _, trackId);
      res
        .status(200)
        .json(
          new ApiResponse(200, response.data, "Payment request successful")
        );
    } else {
      throw new ApiError(400, `API Error: ${response.data.message}`);
    }
  } catch (error) {
    console.error("API Error:", error);
    throw new ApiError(500, "Something went wrong with the payment request");
  }
});

const handleRequestMoney = asyncHandler(async (req, res, _, trackId) => {
  try {
    const trackId = trackId || req.body.trackId || null; // Get trackId and userId from the request body
    const userId = req.body.userId || null; // Get trackId and userId from the request body

    if (!trackId) {
      return res.status(400).json({ message: "trackId is required" });
    }

    console.log("trackId:", trackId);
    console.log("userId:", userId); // Log userId for debugging

    const response = await axios.post(
      "https://api.oxapay.com/merchants/inquiry",
      {
        merchant: "NCV36N-GTMR3L-6XHTHD-62W176",
        trackId: trackId,
      }
    );

    if (response.data.status === "Paid") {
      return res.status(200).json({
        message: "Transaction is successful.",
        status: "Paid",
        amount: reponse.data.payAmount,
        transactionDetils: response,
      });
    } else if (response.data.status === "Waiting") {
      handleRequestMoney(req, res, _, trackId);
    }
  } catch (error) {
    console.error("API Error:", error.message);
    return res.status(500).json({
      message: error.message,
      error: error,
    });
  }
});

export { depositAmount, handleRequestMoney, generateQr };
