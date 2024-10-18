"use strict";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/admin.model.js";
import { Wallet, ShareCount, Level } from "../models/wallet.model.js";
import { Plan } from "../models/admin.model.js";
// import { ShareCount } from "../models/wallet.model.js";
// import { LevelSchema } from "../models/wallet.model.js";

const grabProduct = asyncHandler(async (req, res) => {
  try {
    const { user_id: userId } = req.body || req.query;

    const productList = await Product.find({});
    const countDetails = await ShareCount.findOne({ userId });
    const walletDetails = await Wallet.findOne({ userId });
    const PlanDetails = await Plan.find({ userId });
    console.log("countDetails", countDetails);

    const planCount = PlanDetails?.shareLimit,
      planBalance = PlanDetails?.price,
      userTotalShareCount = countDetails.totalShareCount,
      userRemainingCount = countDetails.shareCount,
      userWalletBalance = walletDetails?.walletAmount;

    // Get today's date without time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (countDetails) {
      // If the user already called this function today, check the count
      if (countDetails.grabCount >= 10) {
        // User exceeded the limit
        return res
          .status(200)
          .json(
            new ApiResponse(
              400,
              {},
              "You have reached the maximum limit of 10 calls for today."
            )
          );
      }

      // Increment the call count
      countDetails.grabCount += 1;
      await countDetails.save();
    } else {
      // If no record exists for today, create a new one
      countDetails.grabCount = 1;
      countDetails.callDate = today;
      await countDetails.save();
    }

    let filteredProduct = null;
    if (userWalletBalance >= planBalance && userTotalShareCount >= planCount) {
      if (userWalletBalance >= 100 && userTotalShareCount >= 3) {
        filteredProduct = productList.filter((itm) => itm.level == level);
      }
      if (userWalletBalance >= 500 && userTotalShareCount >= 5) {
        filteredProduct = productList.filter((itm) => itm.level == level1);
      }
      if (userWalletBalance >= 900 && userTotalShareCount >= 10) {
        filteredProduct = productList.filter((itm) => itm.level == level2);
      }
    }

    // Access the random value from the array
    const product =
      filteredProduct?.[Math.floor(Math.random() * filteredProduct?.length)];

    return res
      .status(200)
      .json(new ApiResponse(200, product, "product fetched successfully"));
  } catch (error) {
    throw new ApiError(400, error);
  }
});

// @desc Create a new level
// @route POST /api/levels
// @access Private
const createLevel = asyncHandler(async (req, res) => {
  const {
    levelFirst,
    levelSecond,
    levelThird,
    firstPartyCommission,
    secondPartyCommission,
  } = req.body;

  const newLevel = new Level({
    levelFirst,
    levelSecond,
    levelThird,
    firstPartyCommission,
    secondPartyCommission,
  });

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
  const {
    id,
    levelFirst,
    levelSecond,
    levelThird,
    firstPartyCommission,
    secondPartyCommission,
  } = req.body;

  const level = await Level.findById(id);

  if (level) {
    level.levelFirst = levelFirst || level.levelFirst;
    level.levelSecond = levelSecond || level.levelSecond;
    level.levelThird = levelThird || level.levelThird;
    level.firstPartyCommission =
      firstPartyCommission || level.firstPartyCommission;
    level.secondPartyCommission =
      secondPartyCommission || level.secondPartyCommission;

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

export { grabProduct, createLevel, getLevels, updateLevel, deleteLevel };

// TODO: Reference code for grab product

// const FunctionCall = require('./models/functionCall'); // import the schema

// const limitFunctionCalls = async (userId) => {
//     // Get today's date without time
//     const today = new Date();
//     today.setHours(0, 0, 0, 0); // Set to midnight

//     // Check if a record exists for today's date and the user
//     let callRecord = await FunctionCall.findOne({ userId, callDate: today });

//     if (callRecord) {
//         // If the user already called this function today, check the count
//         if (callRecord.count >= 10) {
//             // User exceeded the limit
//             return {
//                 status: 400,
//                 message: "You have reached the maximum limit of 10 calls for today.",
//             };
//         }

//         // Increment the call count
//         callRecord.count += 1;
//         await callRecord.save();
//     } else {
//         // If no record exists for today, create a new one
//         callRecord = new FunctionCall({
//             userId,
//             callDate: today,
//             count: 1,
//         });
//         await callRecord.save();
//     }

//     // Proceed with the function if the user hasn't reached the limit
//     return {
//         status: 200,
//         message: "Function call successful.",
//     };
// };

// exports.userSellProduct = async (req, res) => {
// 	try {
// 		const { product_id } = req.body;

// 		// Validate input
// 		if (!product_id) {
// 			return res.status(400).json({
// 				status: 400,
// 				message: "Product ID is required.",
// 			});
// 		}

// 		// Time validation (simulating PHP logic)
// 		const date1 = new Date();
// 		const date2 = new Date();
// 		date2.setHours(17, 0, 0);
// 		const date3 = new Date();
// 		date3.setHours(23, 59, 30);

// 		if (!(date1 > date2 && date1 < date3)) {
// 			return res.status(400).json({
// 				status: 400,
// 				message: "You cannot sell. Selling time is closed.",
// 			});
// 		}

// 		// Simulating logic for multiple products
// 		for (let i = 0; i < product_id.length; i++) {
// 			const productReport = await CustomerProductReport.findOne({
// 				customerId: req.user.id,
// 				productId: product_id[i],
// 				sellDate: null,
// 			});

// 			if (!productReport) {
// 				return res.status(400).json({
// 					status: 400,
// 					message: "Please buy the product first before selling.",
// 				});
// 			}

// 			// Update sell status
// 			productReport.sellDate = new Date();
// 			productReport.buySellStatus = "SELL";
// 			await productReport.save();

// 			// Add wallet transaction for product sell
// 			const productData = await Product.findById(product_id[i]);
// 			const lastTransaction = await WalletTransaction.findOne({ userId: req.user.id }).sort({ _id: -1 });

// 			const transactionData = {
// 				userId: req.user.id,
// 				transactionId: `${Math.floor(Math.random() * 100000)}${Date.now()}`,
// 				credit: productData.price,
// 				balance: lastTransaction ? lastTransaction.balance + productData.price : productData.price,
// 				transactionType: "Product Sell",
// 				reference: "user self",
// 				reportId: product_id[i],
// 			};

// 			const transaction = new WalletTransaction(transactionData);
// 			await transaction.save();

// 			// Direct commission logic and update wallet balance
// 			const plan = await Plan.findOne({
// 				price: { $lte: transactionData.balance },
// 				shareCount: { $lte: await getShareCount(req.user.my_share_id) },
// 			}).sort({ price: -1 });

// 			if (plan) {
// 				req.user.planId = plan._id;
// 				await req.user.save();

// 				const commission = (productData.price * plan.commission) / 100;
// 				const commissionTransaction = new WalletTransaction({
// 					...transactionData,
// 					credit: commission,
// 					balance: lastTransaction ? lastTransaction.balance + commission : commission,
// 					transactionType: "Direct Commission",
// 				});

// 				await commissionTransaction.save();
// 			}

// 			// Handle level commissions (levels 1, 2, 3)
// 			await handleLevelCommission(req.user, product_id[i], productData.price);
// 		}

// 		return res.status(200).json({ status: 200, message: "Data inserted successfully." });
// 	} catch (error) {
// 		console.error(error);
// 		return res.status(500).json({ status: 500, message: "Server error." });
// 	}
// };

// async function getShareCount(shareId) {
// 	// Logic to count number of shares
// 	const result = await WalletTransaction.aggregate([
// 		{ $match: { transactionType: "Deposit", balance: { $gte: 100 } } },
// 		{
// 			$lookup: {
// 				from: "users",
// 				localField: "userId",
// 				foreignField: "_id",
// 				as: "users",
// 			},
// 		},
// 		{ $match: { "users.my_share_id": shareId } },
// 		{ $count: "shareCount" },
// 	]);

// 	return result.length > 0 ? result[0].shareCount : 0;
// }

// async function handleLevelCommission(user, productId, productPrice) {
// 	// Logic for level 1, 2, and 3 commissions
// 	const levelSettings = await Setting.findOne();
// 	let level1 = await User.findOne({ my_share_id: user.responser_id });
// 	let level2, level3;

// 	if (level1) level2 = await User.findOne({ my_share_id: level1.responser_id });
// 	if (level2) level3 = await User.findOne({ my_share_id: level2.responser_id });

// 	const levels = [level1, level2, level3];
// 	const levelCommissions = [levelSettings.label_1, levelSettings.label_2, levelSettings.label_3];

// 	for (let i = 0; i < levels.length; i++) {
// 		if (levels[i]) {
// 			const commission = (productPrice * levelCommissions[i]) / 100;
// 			const lastTransaction = await WalletTransaction.findOne({ userId: levels[i]._id }).sort({ _id: -1 });

// 			const transaction = new WalletTransaction({
// 				userId: levels[i]._id,
// 				transactionId: `${Math.floor(Math.random() * 100000)}${Date.now()}`,
// 				credit: commission,
// 				balance: lastTransaction ? lastTransaction.balance + commission : commission,
// 				transactionType: "Level Commission",
// 				reference: `Level ${i + 1}`,
// 				referenceId: user._id,
// 				reportId: productId,
// 			});

// 			await transaction.save();
// 		}
// 	}
// }

// const moment = require("moment");
// const User = require("../models/User");
// const WalletTransaction = require("../models/WalletTransaction");

// const MAX_CALLS_PER_DAY = 10;
// const COMMISSION_PERCENTAGE = 3;

// async function trackUserCalls(userId) {
//     const today = moment().startOf('day');
//     const user = await User.findById(userId);

//     // Check if the user's call count needs resetting (if the last call was not today)
//     if (!user.lastCallDate || moment(user.lastCallDate).isBefore(today)) {
//         user.callCount = 0;  // Reset call count
//     }

//     // Increment the user's call count
//     user.callCount += 1;
//     user.lastCallDate = new Date();

//     if (user.callCount > MAX_CALLS_PER_DAY) {
//         return {
//             status: 400,
//             message: "You have reached the maximum number of calls for today.",
//         };
//     }

//     // If call count reaches 10, apply the commission
//     if (user.callCount === MAX_CALLS_PER_DAY) {
//         const walletTransaction = await WalletTransaction.findOne({ userId: user._id }).sort({ createdAt: -1 });

//         if (walletTransaction) {
//             const commission = walletTransaction.balance * (COMMISSION_PERCENTAGE / 100);

//             const newTransaction = new WalletTransaction({
//                 userId: user._id,
//                 transactionType: "Commission",
//                 credit: commission,
//                 balance: walletTransaction.balance + commission,
//                 reference: "Daily call limit reached",
//             });

//             await newTransaction.save();

//             return {
//                 status: 200,
//                 message: `Commission of ${COMMISSION_PERCENTAGE}% has been added to your wallet.`,
//             };
//         } else {
//             return {
//                 status: 400,
//                 message: "No wallet found for this user.",
//             };
//         }
//     }

//     // Save the user call data
//     await user.save();

//     return {
//         status: 200,
//         message: "Call successful.",
//         callCount: user.callCount,
//     };
// }
