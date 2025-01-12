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

		if (!userId) {
			return res.status(404).json({
				success: false,
				message: "userId not found",
			});
		}

		const [relatedUserIds, userLastTransaction, plans, productList, countDetails] = await Promise.all([
			User.find({ sharedId: userId }, 'userId').then(users => users.map(user => user.userId)),
			WalletTransaction.findOne({ userId }).sort({ _id: -1 }),
			Plan.find({}),
			Product.find({}),
			ShareCount.findOne({ userId }).sort({ _id: -1 })
		]);

		const sharedUserWalletBalances = await Promise.all(
			relatedUserIds?.map(async (id) => {
				const walletDetails = await WalletTransaction.findOne({ userId: id }).sort({ _id: -1 });
				return { userId: id, walletBalance: walletDetails?.balance || 0, };
			})
		);

		const shareCount = sharedUserWalletBalances?.filter((wallet) => wallet?.walletBalance > 100)?.length;
		const activePlan = plans?.filter((plan) => (plan?.price <= (userLastTransaction?.balance || 0) && plan?.shareLimit <= shareCount))?.sort((a, b) => b?.price - a?.price)?.[0] || null;

		const maxCallsPerDay = parseInt(activePlan?.grabNo),
			directCommissionPercentage = (activePlan?.commission) / maxCallsPerDay;

		const today = moment().startOf("day");

		// Check if the user's call count needs resetting (if the last call was not today)
		if (!countDetails?.callDate || moment(countDetails?.callDate).isBefore(today)) {
			countDetails.grabCount = 0; // Reset call count
		}

		if (!countDetails?.grabCount && moment(countDetails?.callDate).isBefore(today)) {
			countDetails.grabCountLeft = maxCallsPerDay; // Reset grabs left to plan limit
			await countDetails.save();
		}

		// Check if it's a new day or dailyInitialBalance is not set
		if (!countDetails?.dailyInitialBalance || moment(countDetails?.callDate).isBefore(today)) {
			countDetails.dailyInitialBalance = userLastTransaction?.balance || 0; // Initialize with last transaction balance
			countDetails.callDate = new Date(); // Update to today's date
			await countDetails.save(); // Save the updated countDetails
		}

		let product = null;
		// Define a tolerance range for near balance
		const TOLERANCE = 15;

		// Determine the affordable products based on balance
		const affordableProducts = productList?.filter(product => {
			const balance = userLastTransaction?.balance || 0;
			if (parseInt(balance) >= 500) {
				return product.price <= balance && product.price >= 500;
			}
			const balanceThreshold = balance - 10;
			return product.price < balanceThreshold && product.price >= balanceThreshold - TOLERANCE;
		});

		// Randomly pick a product from the filtered list
		if (affordableProducts?.length) {
			product = affordableProducts[Math.floor(Math.random() * affordableProducts.length)];
		}

		if (!product) {
			return res
				.status(200)
				.json(
					new ApiResponse(
						200,
						{},
						"No product found in at this price range"
					)
				);
		}

		let savedProduct = null;
		if (countDetails?.grabCount < maxCallsPerDay) {
			if (userLastTransaction) {
				try {
					// Use dailyInitialBalance for commission calculation
					const commission = countDetails.dailyInitialBalance * (directCommissionPercentage / 100),
						// const commission = lastTransaction?.balance * (directCommissionPercentage / 100),
						totalProfit = commission;
					const transaction = new WalletTransaction({
						userId: userId,
						transactionId: `${Math.floor(Math.random() * 100000)}${Date.now()}`,
						credit: commission,
						commission: userLastTransaction ? userLastTransaction?.commission + commission : commission,
						balance: userLastTransaction ? userLastTransaction?.balance + commission : commission,
						totalProfit: userLastTransaction ? userLastTransaction?.totalProfit + totalProfit : totalProfit,
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
					countDetails.grabCountLeft -= 1;
					countDetails.callDate = new Date();
					await countDetails.save();
					var grabCountDtl = await ShareCount.findOne({ userId }).sort({
						_id: -1,
					});
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
			.json(new ApiResponse(200, savedProduct, grabCountDtl, "product fetched successfully"));
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
			const commission = commissionLevel * (parseInt(levelCommissions[i]) / 100),
				totalProfit = commission;
			const lastTransaction = await WalletTransaction.findOne({ userId: levels[i].userId, }).sort({ _id: -1 });
			// console.log("commission", commission);
			const transaction = new WalletTransaction({
				userId: levels[i].userId,
				transactionId: `${Math.floor(Math.random() * 100000)}${Date.now()}`,
				credit: commission,
				balance: lastTransaction ? lastTransaction.balance + commission : commission,
				totalProfit: lastTransaction ? lastTransaction.totalProfit + totalProfit : totalProfit,
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
			const grabCountDtl = await ShareCount.findOne({ userId }).sort({
				_id: -1,
			});
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
