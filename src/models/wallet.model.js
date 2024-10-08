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
		}
	}
)


export const Wallet = mongoose.model("wallet", wallet);
