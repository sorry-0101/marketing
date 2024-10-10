'use strict'
import mongoose, { Schema } from "mongoose";

const wallet = new Schema(
	{
		walletAmount: {
			type: Number,
		},
		userId: {
			type: String,
		},
	},
	{ timestamps: true }
);

const shareCount = new Schema(
	{
		userId: {
			type: String
		},
		shareCount: {
			type: Number
		},
		totalShareCount: {
			type: Number
		}
	}
)

const WalletTransactionSchema = new Schema(
	{
		userId: {
			type: String,
			required: true,
		},
		transactionId: {
			type: String,
			required: true,
			unique: true,
		},
		credit: {
			type: Number,
			default: 0,
		},
		debit: {
			type: Number,
			default: 0,
		},
		balance: {
			type: Number,
		},
		transactionType: {
			type: String, // Deposit, Withdrawal, Direct Commission, etc.
		},
		reference: {
			type: String, // Level 1, user self, etc.
		},
		referenceId: {
			type: String, // ID of the related user or entity
		},
		reportId: {
			type: String, // Product or report associated with the transaction
		},
	},
	{ timestamps: true }
);

export const WalletTransaction = mongoose.model("WalletTransaction", WalletTransactionSchema);
export const Wallet = mongoose.model("wallet", wallet);
export const ShareCount = mongoose.model("shareCount", shareCount);
