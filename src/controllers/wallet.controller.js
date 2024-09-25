'use strict'
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Wallet } from "../models/wallet.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const depositAmount = asyncHandler(async (req, res) => {
	try {
		const { deposit_amount: depositAmount } = req.body;
		const userId = global?.logged_in_user?.userId || null;
		if (!depositAmount || !userId) {
			throw new ApiError(400, 'Something went wrong');
		}

		const walletResponse = await Wallet.create({
			walletAmount: parseInt(depositAmount),
			userId
		});

		(walletResponse) && (new ApiError(400, 'Something went wrong while adding amount in wallet'));

		const walletDetails = await Wallet.findById(walletResponse._id).select();

		return res.status(200).json(new ApiResponse(200, walletDetails, 'Amount is added successfully'))
	} catch (error) {
		throw new ApiError(400, error);

	}
});

export {
	depositAmount
}

