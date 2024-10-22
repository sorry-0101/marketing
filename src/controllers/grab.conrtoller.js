'use strict';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Product, Plan } from '../models/admin.model.js';
import { Wallet, ShareCount, Level } from '../models/wallet.model.js';
import { WalletTransaction } from '../models/wallet.model.js';
import { User } from '../models/user.model.js';
import moment from 'moment';

const grabProduct = asyncHandler(async (req, res) => {
	try {
		const userId = req.user.userId || req.query.user_id;
		const sharedId = req.user.sharedId || req.query.shared_id;

		const productList = await Product.find({});
		let countDetails = await ShareCount.findOne({ userId });
		const lastTransaction = await WalletTransaction.findOne({ userId }).sort({ _id: -1 });
		// const PlanDetails = await Plan.find({});
		console.log('countDetails', countDetails);

		const maxCallsPerDay = req?.user?.activePlan?.grabNo || 10,
			directCommissionPercentage = req?.user?.activePlan?.commission || 3;

		const today = moment().startOf('day');

		// Check if the user's call count needs resetting (if the last call was not today)
		if (!countDetails?.callDate || moment(countDetails?.callDate).isBefore(today)) {
			countDetails.grabCount = 0;  // Reset call count
		}
		if (countDetails?.grabCount > maxCallsPerDay) {
			return {
				status: 400,
				message: 'You have reached the maximum number of calls for today.',
			};
		}

		if (countDetails?.grabCount == maxCallsPerDay) {

			if (lastTransaction) {
				try {
					const commission = 3; //walletDetails?.walletAmount * (directCommissionPercentage / 100);
					const transaction = new WalletTransaction({
						userId: userId,
						transactionId: `${Math.floor(Math.random() * 100000)}${Date.now()}`,
						credit: commission,
						balance: lastTransaction ? lastTransaction.balance + commission : commission,
						transactionType: 'Direct Commission',
						reference: `Daily call limit reached`,
					});
					await transaction.save();
				} catch (error) {
					throw new ApiError(
						400,
						'Something went wrong while adding Direct Commission Percentage to wallet'
					);
				}
			}

			// const parentWalletDetails = await Wallet.findOne({ userId: sharedId });
			// let user = await User.findOne({ userId });
			await handleLevelCommission(sharedId, 'Level1', 2)
		}

		const filteredProduct = productList?.filter((itm) => itm?.level == req?.user?.activePlan?.title);

		// Access the random value from the array
		const product = filteredProduct?.[Math.floor(Math.random() * filteredProduct?.length)];

		// Increment the user's call count
		countDetails.grabCount += 1;
		countDetails.callDate = new Date();
		await countDetails.save();
		return res
			.status(200)
			.json(new ApiResponse(200, product, 'product fetched successfully'));
	} catch (error) {
		throw new ApiError(400, error);
	}
});

async function handleLevelCommission(sharedId, productId = 'level1', productPrice = 3) {
	// Logic for level 1, 2, and 3 commissions
	let level1 = await User.findOne({ userId: sharedId });
	let level2, level3;

	if (level1) level2 = await User.findOne({ userId: level1.sharedId });
	if (level2) level3 = await User.findOne({ userId: level2.sharedId });

	const levels = [level1, level2, level3];
	const levelCommissions = [16, 8, 4];

	for (let i = 0; i < levels.length; i++) {
		if (levels[i]) {
			const commission = (productPrice * levelCommissions[i]) / 100;
			const lastTransaction = await WalletTransaction.findOne({ userId: levels[i].userId }).sort({ _id: -1 });

			const transaction = new WalletTransaction({
				userId: levels[i].userId,
				transactionId: `${Math.floor(Math.random() * 100000)}${Date.now()}`,
				credit: commission,
				balance: lastTransaction ? lastTransaction.balance + commission : commission,
				transactionType: 'Level Commission',
				reference: `Level ${i + 1}`,
				referenceId: levels[i].userId,
				reportId: productId,
			});
			await transaction.save();
		}
	}
	return true;
}

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
		throw new Error('Level not found');
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
		throw new Error('Level not found');
	}
});

const deleteLevel = asyncHandler(async (req, res) => {
	const { id } = req.body;

	const level = await Level.findById(id);

	if (level) {
		await Level.deleteOne({ _id: id }); // Use deleteOne instead of remove
		res.json({ message: 'Level removed' });
	} else {
		res.status(404);
		throw new Error('Level not found');
	}
});

export { grabProduct, createLevel, getLevels, updateLevel, deleteLevel };