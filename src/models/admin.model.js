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
		},
		productImg: {
			type: String, // cloudinary url
		}
	},
	{
		timestamps: true
	}
);

const EventSchema = new Schema(
	{
		title: {
			type: String,
			require: true,
			index: true,
			trim: true
		},
		startDate: {
			type: String,
			require: true,
			trim: true
		},
		endDate: {
			type: String,
			require: true,
			trim: true
		},
		description: {
			type: String,
			require: true,
			trim: true
		}
	},
	{
		timestamps: true
	}
);

export const Admin = mongoose.model('Products', adminSchema);
export const Events = mongoose.model('Events', EventSchema);