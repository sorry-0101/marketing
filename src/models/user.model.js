'use strict'
import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

// Define the schema for the User model
const userSchema = new Schema(
	{
		// Username field: must be unique, lowercase, and indexed for faster searches
		username: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
			index: true
		},
		// Email field: must be unique, lowercase, and trimmed
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
		},
		// Mobile number is required
		mobileNo: {
			type: Number,
			required: true,
			unique: true,
			trim: true,
		},
		// Password field: required and needs validation message when missing
		password: {
			type: String,
			required: [true, 'Password is required']
		},
		// Shared ID, required for some logic in the application
		sharedId: {
			type: String,
			trim: true,
			index: true // Adds a non-unique index
		},
		userId: {
			type: String,
			trim: true
		},
		// Field for storing the refresh token (used for authentication)
		refreshToken: {
			type: String
		},
		// Avatar URL (e.g., from Cloudinary) to store the user's profile picture
		avatar: {
			type: String,
		},
	},
	{
		// Automatically add timestamps (createdAt and updatedAt) to the model
		timestamps: true
	}
);

// Pre-save middleware to hash the user's password before saving it to the database
userSchema.pre("save", async function (next) {
	// If the password is not modified, skip hashing and proceed
	if (!this.isModified("password")) return next();

	// Hash the password with bcrypt and a salt of 10 rounds
	this.password = await bcrypt.hash(this.password, 10);
	next();
});

// Method to check if the provided password matches the stored hashed password
userSchema.methods.isPasswordCorrect = async function (password) {
	// Compare the input password with the hashed password
	return await bcrypt.compare(password, this.password);
};

// Method to generate a JWT access token for the user
userSchema.methods.generateAccessToken = function () {
	// Sign a JWT with the user's basic information and secret key, with an expiration time
	return jwt.sign(
		{
			_id: this._id,
			email: this.email,
			username: this.username,
			fullName: this.fullName
		},
		process.env.ACCESS_TOKEN_SECRET, // Secret key for signing the access token
		{
			expiresIn: process.env.ACCESS_TOKEN_EXPIRY // Access token expiry duration (from environment variable)
		}
	);
};

// Method to generate a JWT refresh token for the user
userSchema.methods.generateRefreshToken = function () {
	// Sign a refresh token with the user's ID and a separate secret key, with an expiration time
	return jwt.sign(
		{
			_id: this._id,
		},
		process.env.REFRESH_TOKEN_SECRET, // Secret key for signing the refresh token
		{
			expiresIn: process.env.REFRESH_TOKEN_EXPIRY // Refresh token expiry duration (from environment variable)
		}
	);
};

const addressSchema = new mongoose.Schema({
    address: {
        type: String,
        required: true
    }
}, { timestamps: true });
const withdrawalRequestSchema = new Schema({
	address: {
		type: String,
		required: true
	},
	amount: {
		type: Number,
		required: true
	},
	finalAmount: {
		type: Number,
		required: true
	},
	username: {
		type: String,
		required: true
	},
	mobile: {
		type: String,
		required: true
	},
	dateTime: {
		type: Date,
		default: Date.now
	},
	status: {
		type: String,
		enum: ['Pending', 'Approved', 'Rejected'],
		default: 'Pending'
	}
},
	{
		timestamps: true
	});


const messageSchema = new Schema(
	{
		content: {
			type: String,
		},
		imageUrl: {
			type: String, // For storing the image URL if an image is sent
		},
		sender: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User', // References the User model
			required: true,
		},
		receiver: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User', // For admin, you can store admin's ID here
		},
		isAdmin: {
			type: Boolean,
			default: false, // Distinguishes between admin and user messages
		},
	},
	{ timestamps: true }
);



// Export the User model, which will be used to interact with the 'users' collection in MongoDB
export const User = mongoose.model("User", userSchema);
export const withdrawalRequestAmount = mongoose.model("withdrawalRequestAmount", withdrawalRequestSchema);
export const addressSchemaWithdrawal = mongoose.model("addressSchema", addressSchema);
export const Message = mongoose.model("Message", messageSchema);
