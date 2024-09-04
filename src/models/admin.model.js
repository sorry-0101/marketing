'use strict'
import mongoose, { Schema } from "mongoose";

const adminSchema = new Schema(
	{
		productName: {
			type: String,
			require: true,
			index: true,
			trim: true
		},
		level: {
			type: String,
			require: true,
			trim: true
		},
		ratioBetween: {
			type: String,
			require: true,
			trim: true
		},
		price: {
			type: Number,
			require: true,
			trim: true
		}
	},
	{
		timestamps: true
	}
);

export const Admin = mongoose.model('Products', adminSchema);