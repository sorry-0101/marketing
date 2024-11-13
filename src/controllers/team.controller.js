import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { WalletTransaction } from "../models/wallet.model.js";
import moment from "moment";


const getUsersLevel = async (
	userId,
	visitedUsers = new Set(),
	currentLevel = 1
) => {
	try {
		// If the current level is beyond level 3, stop recursion
		if (currentLevel > 3) {
			return [];
		}

		// Stop recursion if the user has already been visited (to avoid circular references)
		if (visitedUsers.has(userId)) {
			return [];
		}

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
			const deeperReferrals = await getUsersLevel(
				referral.userId,
				visitedUsers,
				currentLevel + 1 // Move to the next level
			);
			usersWithLevels = usersWithLevels.concat(deeperReferrals);
		}

		return usersWithLevels;
	} catch (error) {
		throw error;
	}
};

const getTeamDataByDate = asyncHandler(async (req, res) => {
	try {
		const userId = req.user.userId || req.query.user_id;
		// Parse start and end dates and adjust for the entire day
		const startDate = moment(req.query.start_date, "YYYY-MM-DD").startOf("day").toDate();
		const endDate = moment(req.query.end_date, "YYYY-MM-DD").endOf("day").toDate();

		// Get users up to level 3
		const userLevels = await getUsersLevel(userId, new Set(), 3);
		const userIds = userLevels.map((item) => item.user.userId);
		const teamSize = userLevels?.length ? userLevels?.length : 0;
		// Filter transactions by date using the timestamp directly
		const lastTransactions = await WalletTransaction.aggregate([
			{ $match: { userId: { $in: userIds } } },
			{ $sort: { _id: -1 } },
			{
				$group: {
					_id: "$userId",
					balance: { $first: "$balance" },
					credit: { $sum: "$credit" },
					debit: { $sum: "$debit" },
					// withdraw: { $sum: "$withdraw" }, //  withdraw field exists
					firstDeposit: { $first: "$credit" }, // For first-time deposit
					// commission: { $sum: "$commission" }, //  commission field exists
					createdAt: { $first: "$createdAt" }
				},
			},
			{
				$project: {
					userId: "$_id",
					balance: 1,
					credit: 1,
					debit: 1,
					withdraw: 1,
					firstDeposit: 1,
					commission: 1,
					createdAt: 1,
					_id: 0,
				},
			},
		]);
		console.log(lastTransactions);

		// Calculate totals
		const { teamBalance, teamCredit, teamDebit, teamWithdraw, firstLevelMembers, firstTimeDepositors, teamOrderCommission } = lastTransactions.reduce(
			(acc, transaction) => {
				const { userId, balance, credit, debit, withdraw, firstDeposit, commission } = transaction;
				acc.teamBalance += balance || 0;
				acc.teamCredit += credit || 0;
				acc.teamDebit += debit || 0;
				acc.teamWithdraw += withdraw || 0;
				acc.firstLevelMembers += userLevels.find(u => u.user.userId === userId && u.level === 1) ? 1 : 0;
				acc.firstTimeDepositors += firstDeposit ? 1 : 0;
				acc.teamOrderCommission += commission || 0;
				return acc;
			},
			{
				teamBalance: 0,
				teamCredit: 0,
				teamDebit: 0,
				teamWithdraw: 0,
				firstLevelMembers: 0,
				firstTimeDepositors: 0,
				teamOrderCommission: 0,
			}
		);

		res.status(200).json({ teamBalance, teamCredit, teamDebit, teamWithdraw, teamSize, firstLevelMembers, firstTimeDepositors, teamOrderCommission, timestamps: lastTransactions.map(tx => tx.createdAt) });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Internal server error" });
	}
});


export {
	getTeamDataByDate
};
