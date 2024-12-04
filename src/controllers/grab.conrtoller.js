"use strict";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product, Plan } from "../models/admin.model.js";
import { Wallet, ShareCount, Level } from "../models/wallet.model.js";
import { WalletTransaction } from "../models/wallet.model.js";
import { CustomerProductReport } from "../models/product.model.js";
import { User } from "../models/user.model.js";
import moment from "moment";

// @desc Create a new level
// @route POST /api/levels
// @access Private

const grabProduct = asyncHandler(async (req, res) => {
	try {
		const userId = req.user.userId || req.query.user_id;
		const sharedId = req.user.sharedId || req.query.shared_id;

		const productList = await Product.find({});
		let countDetails = await ShareCount.findOne({ userId });
		const lastTransaction = await WalletTransaction.findOne({ userId }).sort({
			_id: -1,
		});
		// const PlanDetails = await Plan.find({});
		// console.log("countDetails", countDetails);

		const maxCallsPerDay = req?.user?.activePlan?.grabNo || parseInt(global?.activePlan?.grabNo) || 10,
			directCommissionPercentage = (req?.user?.activePlan?.commission || global?.activePlan?.commission) / maxCallsPerDay;

		const today = moment().startOf("day");

		// Check if the user's call count needs resetting (if the last call was not today)
		if (
			!countDetails?.callDate || moment(countDetails?.callDate).isBefore(today)
		) {
			countDetails.grabCount = 0; // Reset call count
		}

		const filteredProduct = productList?.filter((itm) => itm?.level == req?.user?.activePlan?.title || global?.activePlan?.title);
		// Access the random product from the array
		const product = filteredProduct?.[Math.floor(Math.random() * filteredProduct?.length)];
		let savedProduct = null;
		if (countDetails?.grabCount < maxCallsPerDay) {
			if (lastTransaction) {
				try {
					const commission = lastTransaction?.balance * (directCommissionPercentage / 100);
					const transaction = new WalletTransaction({
						userId: userId,
						transactionId: `${Math.floor(Math.random() * 100000)}${Date.now()}`,
						credit: commission,
						balance: lastTransaction ? lastTransaction.balance + commission : commission,
						transactionType: "Direct Grab Commission",
						reference: "Daily Grab",
					});
					await transaction.save();
					await handleLevelCommission(sharedId, commission);
					savedProduct = await updateUserCustomerProduct(
						product,
						commission,
						userId
					);
					// Increment the user's call count
					countDetails.grabCount += 1;
					countDetails.callDate = new Date();
					await countDetails.save();
				} catch (error) {
					throw new ApiError(400, error);
				}
			}
		} else {
			return res
				.status(200)
				.json(
					new ApiResponse(
						200,
						{},
						"You have reached the maximum number of calls for today."
					)
				);
		}
		return res
			.status(200)
			.json(new ApiResponse(200, savedProduct, "product fetched successfully"));
	} catch (error) {
		throw new ApiError(400, error.message);
	}
});

async function updateUserCustomerProduct(product, grabCommission, userId) {
	try {
		const productDtl = await CustomerProductReport.create({
			userId: userId,
			productId: product?.productId,
			buyStatus: "BUY",
			productName: product?.productName,
			productPrice: product?.price,
			grabCommission: grabCommission,
			productImg: product?.productImg,
			buyDate: new Date(),
		});
		return productDtl;
	} catch (error) {
		throw error;
	}
}

async function handleLevelCommission(sharedId, commissionLevel) {
	// Logic for level 1, 2, and 3 commissions
	let level1 = await User.findOne({ userId: sharedId });
	let level2, level3;

	if (level1) level2 = await User.findOne({ userId: level1.sharedId });
	if (level2) level3 = await User.findOne({ userId: level2.sharedId });

	const levels = [level1, level2, level3];

	const levelsCommissions = await Level.find({});
	const levelCommissions = [
		levelsCommissions[0]?.levelFirst || 16,
		levelsCommissions[0]?.levelSecond || 8,
		levelsCommissions[0]?.levelThird || 4,
	];

	for (let i = 0; i < levels.length; i++) {
		if (levels[i]) {
			const commission = commissionLevel * (parseInt(levelCommissions[i]) / 100);
			const lastTransaction = await WalletTransaction.findOne({ userId: levels[i].userId, }).sort({ _id: -1 });
			// console.log("commission", commission);
			const transaction = new WalletTransaction({
				userId: levels[i].userId,
				transactionId: `${Math.floor(Math.random() * 100000)}${Date.now()}`,
				credit: commission,
				balance: lastTransaction ? lastTransaction.balance + commission : commission,
				transactionType: "Level Commission",
				reference: `Level ${i + 1}`,
				referenceId: levels[i].userId,
			});
			await transaction.save();
		}
	}
	return true;
}

const createLevel = asyncHandler(async (req, res) => {
	const { levelFirst, levelSecond, levelThird, firstPartyCommission, secondPartyCommission } = req.body;

	const newLevel = new Level({ levelFirst, levelSecond, levelThird, firstPartyCommission, secondPartyCommission });

	const createdLevel = await newLevel.save();
	res.status(201).json(createdLevel);
});

const getLevels = asyncHandler(async (req, res) => {
	const levels = await Level.find();
	res.json(levels);
});

const getLevelById = asyncHandler(async (req, res) => {
	const level = await Level.findById(req.params.id);
	if (level) {
		res.json(level);
	} else {
		res.status(404);
		throw new Error("Level not found");
	}
});

const updateLevel = asyncHandler(async (req, res) => {
	const { id, levelFirst, levelSecond, levelThird, firstPartyCommission, secondPartyCommission, } = req.body;

	const level = await Level.findById(id);

	if (level) {
		level.levelFirst = levelFirst || level.levelFirst;
		level.levelSecond = levelSecond || level.levelSecond;
		level.levelThird = levelThird || level.levelThird;
		level.firstPartyCommission = firstPartyCommission || level.firstPartyCommission;
		level.secondPartyCommission = secondPartyCommission || level.secondPartyCommission;

		const updatedLevel = await level.save();
		res.json(updatedLevel);
	} else {
		res.status(404);
		throw new Error("Level not found");
	}
});

const deleteLevel = asyncHandler(async (req, res) => {
	const { id } = req.body;

	const level = await Level.findById(id);

	if (level) {
		await Level.deleteOne({ _id: id }); // Use deleteOne instead of remove
		res.json({ message: "Level removed" });
	} else {
		res.status(404);
		throw new Error("Level not found");
	}
});

// Function to retrieve all users registered with a specific sharedId along with their wallet balances
const userShareCount = asyncHandler(async (req, res) => {
	try {
		const sharedId = req.query.sharedId; // Get sharedId from query params

		if (!sharedId) {
			throw new ApiError(400, "SharedId not found");
		}

		// Find all users with the provided sharedId
		const userRecords = await User.find({ sharedId });

		// If no users found, respond accordingly
		if (userRecords.length === 0) {
			return res
				.status(404)
				.json(
					new ApiResponse(404, null, "No users found for the provided sharedId")
				);
		}

		// Map user userId to match with WalletTransaction's userId field
		const userIds = userRecords.map((user) => user.userId);

		// Fetch latest transaction balance for each user using aggregation
		const transactions = await WalletTransaction.aggregate([
			{ $match: { userId: { $in: userIds } } },
			{ $sort: { _id: -1 } },
			{
				$group: {
					_id: "$userId",
					latestBalance: { $first: "$balance" },
				},
			},
		]);

		// Map user records to include wallet balances
		const userRecordsWithBalance = userRecords.map((user) => {
			// Find transaction based on user.userId
			const transaction = transactions.find((t) => t._id === user.userId);
			return {
				...user.toObject(),
				walletBalance: transaction ? transaction.latestBalance : 0,
			};
		});

		// Calculate share count based on wallet balance
		const shareCount = userRecordsWithBalance.filter(
			(user) => user.walletBalance > 100
		).length;

		// Check if a ShareCount record exists for this sharedId and update or create it
		const existingRecord = await ShareCount.findOne({ userId: sharedId });

		if (existingRecord) {
			// Update the existing record
			existingRecord.shareCount = shareCount;
			existingRecord.callDate = new Date();
			await existingRecord.save();
		} else {
			// Create a new record for this sharedId
			await ShareCount.create({
				userId: sharedId,
				shareCount,
				callDate: new Date(),
			});
		}

		// Return the response with users, their balances, and share count
		return res.status(200).json({
			statusCode: 200,
			data: userRecordsWithBalance,
			shareCount,
			message:
				"Users with balances retrieved and share count saved successfully",
			success: true,
		});
	} catch (error) {
		throw new ApiError(500, error.message);
	}
});

//get product grab  by user id
const getProductsByUserId = asyncHandler(async (req, res) => {
	const userId = req.query.user_id; // Get user ID from query parameters

	if (!userId) {
		throw new ApiError(400, "User ID is required");
	}

	const products = await CustomerProductReport.find({ userId: userId });

	(!products.length) ? res.status(200).json('No product found') : res.status(200).json(products);
});

//get product grab  by user id
const getGrabCount = asyncHandler(async (req, res) => {
	try {
		const userId = req?.user?.userId || req?.query?.user_id;
		if (!userId) {
			res.status(200).json("user Id not Found ");
		} else {
			const grabCountDtl = await ShareCount.findOne({ userId });
			res.status(200).json({ grabCountDtl: grabCountDtl });
		}
	} catch (error) {
		throw new ApiError(500, error);
	}
});

export {
	grabProduct,
	createLevel,
	getLevels,
	updateLevel,
	deleteLevel,
	userShareCount,
	getProductsByUserId,
	getGrabCount
};
