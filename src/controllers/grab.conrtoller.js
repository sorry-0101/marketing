'use strict';
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/admin.model.js";
import { ShareCount } from "../models/wallet.model.js";
import { Wallet } from "../models/wallet.model.js";
import { Plan } from "../models/admin.model.js";

const grabProduct = asyncHandler(async (req, res) => {
	try {
		const { user_id: userId } = req.body || req.query;

		// let	remainingBalance= walletBalance;

		const productList = await Product.find({});
		const countDetails = await ShareCount.find({ userId });
		const walletDetails = await Wallet.find({ userId });
		const PlanDetails = await Plan.find({ userId });


		const level = 1,
			shareCount = PlanDetails?.shareLimit,
			walletBalance = walletDetails?.walletAmount;

		filteredProduct = productList.filter(itm => itm.level == level);

		// Access the random value from the array
		const product = array[Math.floor(Math.random() * filteredProduct.length)];

		const productPrice = product.price;


	} catch (error) {
		throw new ApiError(400, error);
	}
});

export {
	grabProduct
};


// TODO: Reference code for grab product


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
