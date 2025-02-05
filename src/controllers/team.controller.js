import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User, withdrawalRequestAmount } from "../models/user.model.js";
import { WalletTransaction } from "../models/wallet.model.js";
import moment from "moment";


const getUsersLevel = async (userId, visitedUsers = new Set(), currentLevel = 1) => {
	try {
		// If the current level is beyond level 3, stop recursion
		if (currentLevel > 3) { return []; }

		// Stop recursion if the user has already been visited (to avoid circular references)
		if (visitedUsers.has(userId)) { return []; }

		// Mark the user as visited
		visitedUsers.add(userId);

		// Find all users directly referred by the given userId
		const directReferrals = await User.find({ sharedId: userId });

		let usersWithLevels = [];

		// Store direct referrals along with their corresponding level
		for (let referral of directReferrals) {
			usersWithLevels.push({
				user: referral, // Add the referral user object
				level: currentLevel, // Add the level number (1, 2, or 3)
			});
		}

		// Recursively find referrals for each direct referral at the next level
		for (let referral of directReferrals) {
			const deeperReferrals = await getUsersLevel(referral.userId, visitedUsers, currentLevel + 1);
			usersWithLevels = usersWithLevels.concat(deeperReferrals);
		}

		return usersWithLevels;
	} catch (error) {
		throw error;
	}
};

const getTeamDataByDate = asyncHandler(async (req, res) => {
	try {
		const userId = req.query.user_id;
		// Parse start and end dates and adjust for the entire day
		const startDate = moment(req.query.start_date, "YYYY-MM-DD").startOf("day").toDate();
		const endDate = moment(req.query.end_date, "YYYY-MM-DD").endOf("day").toDate();

		// Get users up to level 3
		const userLevels = await getUsersLevel(userId, new Set(), 3);
		const userIds = userLevels.map((item) => item.user.userId);
		const teamSize = userLevels?.length ? userLevels?.length : 0;
		// Fetch Latest Transactions for Each User
		const latestTransactions = await WalletTransaction.aggregate([
			{ $match: { userId: { $in: userIds } } },
			{ $sort: { userId: 1, createdAt: -1 } }, // Sort latest first
			{
				$group: {
					_id: "$userId",
					latestTransaction: { $first: "$$ROOT" } // Take the latest transaction per user
				}
			},
			{
				$replaceRoot: { newRoot: "$latestTransaction" } // Flatten the object
			},
			{
				$project: {
					userId: 1,
					balance: 1,
					credit: 1,
					debit: 1,
					commission: 1,
					totalProfit: 1,
					firstDeposit: 1,
					createdAt: 1
				}
			}
		]);

		// Fetch total approved withdrawal amount
		const totalWithdrawals = await withdrawalRequestAmount.aggregate([
			{ $match: { userId: { $in: userIds }, status: "Approved" } },
			{
				$group: {
					_id: "$userId",
					latestTransaction: { $first: "$$ROOT" } // Take the latest transaction per user
				}
			},
			{
				$replaceRoot: { newRoot: "$latestTransaction" } // Flatten the object
			},
		]);

		// Calculate Totals Based on Latest Transactions
		const teamWithdraw = totalWithdrawals.reduce(
			(acc, { amount }) => {
				acc.teamWithdraw += amount || 0;
				return acc;
			},
			{
				teamWithdraw: 0
			}
		);

		// Calculate Totals Based on Latest Transactions
		const totals = latestTransactions.reduce(
			(acc, { userId, balance, credit, debit, firstDeposit, commission, totalProfit }) => {
				acc.teamBalance += balance || 0;
				acc.teamCredit += credit || 0;
				acc.teamDebit += debit || 0;
				acc.firstLevelMembers += userLevels.find(u => u.user.userId === userId && u.level === 1) ? 1 : 0;
				acc.firstTimeDepositors += firstDeposit ? 1 : 0;
				acc.teamOrderCommission += commission || 0;
				acc.teamTotalProfit += totalProfit || 0;
				return acc;
			},
			{
				teamBalance: 0,
				teamCredit: 0,
				teamDebit: 0,
				firstLevelMembers: 0,
				firstTimeDepositors: 0,
				teamOrderCommission: 0,
				teamTotalProfit: 0
			}
		);

		res.status(200).json({
			...totals,
			teamSize,
			...teamWithdraw, // Adding total withdrawn amount
			timestamps: latestTransactions.map(tx => tx.createdAt)
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Internal server error" });
	}
});


export {
	getTeamDataByDate
};
