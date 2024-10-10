"use strict";
import mongoose, { Schema } from "mongoose";

const CustomerProductReportSchema = new Schema(
	{
		userId: {
			type: String,
			required: true,
		},
		productId: {
			type: String,
			required: true,
		},
		buySellStatus: {
			type: String, // "BUY" or "SELL"
			required: true,
		},
		sellDate: {
			type: Date, // If sold, the date of sale
		},
		// You can add additional fields as necessary based on business logic
	},
	{ timestamps: true }
);

export const CustomerProductReport = mongoose.model("CustomerProductReport", CustomerProductReportSchema);
