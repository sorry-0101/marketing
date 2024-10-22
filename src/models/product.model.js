'use strict';
import mongoose, { Schema } from 'mongoose';

const CustomerProductReportSchema = new Schema(
	{
		userId: {
			type: String,
			required: true,
			ref: 'User'
		},
		productId: {
			type: String,
			required: true,
		},
		buyStatus: {
			type: String, // 'BUY'
			required: true,
		},
		productName: {
			type: String,
		},
		productPrice: {
			type: Number,
		},
		grabCommission: {
			type: Number
		},
		buyDate: {
			type: Date, // If sold, the date of sale
		},
		// You can add additional fields as necessary based on business logic
	},
	{ timestamps: true }
);

export const CustomerProductReport = mongoose.model('CustomerProductReport', CustomerProductReportSchema);
