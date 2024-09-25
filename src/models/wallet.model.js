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


export const Wallet = mongoose.model("wallet", wallet);
