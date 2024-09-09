'use strict'
import mongoose, { Schema } from "mongoose";

// Schema definition for the Admin collection (representing products)
const adminSchema = new Schema(
	{
		// Product name field, required, indexed for faster search, and trimmed to remove extra spaces
		productName: {
			type: String,
			require: true,
			index: true,
			trim: true
		},
		// Level of the product, required and trimmed
		level: {
			type: String,
			require: true,
			trim: true
		},
		// Ratio between two things (specific to business logic), required and trimmed
		ratioBetween: {
			type: String,
			require: true,
			trim: true
		},
		// Price of the product, must be a number, required, and trimmed
		price: {
			type: Number,
			require: true,
			trim: true
		},
		// Product image URL (e.g., Cloudinary URL), stored as a string
		productImg: {
			type: String,
		}
	},
	{
		// Automatically add createdAt and updatedAt fields
		timestamps: true
	}
);

// Schema definition for the Events collection
const EventSchema = new Schema(
	{
		// Title of the event, required, indexed for faster search, and trimmed
		title: {
			type: String,
			require: true,
			index: true,
			trim: true
		},
		// Start date of the event, required and trimmed
		startDate: {
			type: String,
			require: true,
			trim: true
		},
		// End date of the event, required and trimmed
		endDate: {
			type: String,
			require: true,
			trim: true
		},
		// Description of the event, required and trimmed
		description: {
			type: String,
			require: true,
			trim: true
		}
	},
	{
		// Automatically add createdAt and updatedAt fields
		timestamps: true
	}
);

// Create and export the Admin model for the Products collection
export const Admin = mongoose.model('Products', adminSchema);

// Create and export the Events model for the Events collection
export const Events = mongoose.model('Events', EventSchema);
