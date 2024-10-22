'use strict';
import mongoose, { Schema } from 'mongoose';

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

const shareCount = new Schema({
	userId: {
		type: String,
	},
	shareCount: {
		type: Number,
		default: 0,
	},
	totalShareCount: {
		type: Number,
		default: 0,
	},
	callDate: {
		type: Date,
		required: true,
	},
	grabCount: {
		type: Number,
		default: 0,
	}

});

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

const paymentRequestSchema = new mongoose.Schema(
	{
		trackId: {
			type: String,
			required: true,
			unique: true,
		},
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		amount: {
			type: String,
			required: true,
		},

		currency: {
			type: String,
			required: true,
		},
		status: {
			type: String,
			enum: ['Expired', 'Paid', 'Waiting'],
			default: 'Waiting',
		},

		expiredAt: {
			type: Date,
			required: true,
		},

		email: {
			type: String,
			required: true,
		},
		description: {
			type: String,
		},
		address: {
			type: String,
			required: true,
		},
	},
	{ timestamps: true }
);

const levelSchema = new Schema(
	{
		levelFirst: {
			type: String,
			required: true,
		},
		levelSecond: {
			type: String,
			required: true,
		},
		levelThird: {
			type: String,
			required: true,
		},
		firstPartyCommission: {
			type: Number,
			required: true,
		},
		secondPartyCommission: {
			type: Number,
			required: true,
		},
	},
	{ timestamps: true }
);

export const WalletTransaction = mongoose.model('WalletTransaction', WalletTransactionSchema);
export const Wallet = mongoose.model('wallet', wallet);
export const Paymentdetail = mongoose.model('PaymentRequest', paymentRequestSchema);
export const ShareCount = mongoose.model('shareCount', shareCount);
export const Level = mongoose.model('LevelSchema', levelSchema);
