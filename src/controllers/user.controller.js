import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Helper function to generate access and refresh tokens
const generateAccessAndRefreshTokens = async (userId) => {
	try {
		// Find the user by ID
		const user = await User.findById(userId);

		// Generate access and refresh tokens
		const accessToken = user.generateAccessToken();
		const refreshToken = user.generateRefreshToken();

		// Save the refresh token to the user document
		user.refreshToken = refreshToken;
		await user.save({ validateBeforeSave: false });

		// Return the tokens
		return { accessToken, refreshToken };

	} catch (error) {
		// Handle any errors during token generation
		throw new ApiError(500, "Something went wrong while generating refresh and access token");
	}
};

// Controller for user registration
const registerUser = asyncHandler(async (req, res) => {
	try {
		const { email, username, password, mobileNo } = req.body;
		const { shared_Id: sharedId } = req.query;

		let userId = '';
		let str = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnlpqrstuvwxyz0123456789';
		for (let i = 1; i <= 5; i++) {
			let char = Math.floor(Math.random() * str.length + 1);
			userId += str.charAt(char);
		}

		if (!sharedId) throw new ApiError(400, "SharedId No found");

		// Validate required fields
		if ([email, username, password, sharedId, mobileNo].some((field) => field?.trim() === "")) {
			throw new ApiError(400, "All fields are required");
		}

		// Check if a user with the same email or username already exists
		const existedUser = await User.findOne({ $or: [{ username }, { email }, { mobileNo }] });
		if (existedUser) {
			throw new ApiError(409, "User with email or username already exists");
		}

		// Check if the avatar image is provided
		const avatarLocalPath = req.files?.avatar?.[0]?.path;
		if (!avatarLocalPath) {
			throw new ApiError(400, "Avatar file is required");
		}

		// Upload avatar to Cloudinary
		const avatar = await uploadOnCloudinary(avatarLocalPath);
		if (!avatar) {
			throw new ApiError(400, "Avatar file is required");
		}

		// Create a new user
		const user = await User.create({
			username: username?.toLowerCase(),
			email,
			mobileNo,
			password,
			sharedId,
			userId,
			adminImg: avatar.url,
		});

		// Fetch the created user without password and refreshToken fields
		const createdUser = await User.findById(user._id).select("-password -refreshToken");

		if (!createdUser) {
			throw new ApiError(500, "Something went wrong while registering the user");
		}

		// Return success response
		return res.status(201).json(new ApiResponse(200, createdUser, "User registered Successfully"));
	} catch (error) {
		throw new ApiError(500, error.message);
	}
});

// Controller for user login
const loginUser = asyncHandler(async (req, res) => {
	const { mobile_no: mobileNo, password } = req.body;

	// Validate if either email or username is provided
	if (!mobileNo && !password) {
		throw new ApiError(400, "mobileNo or password is required");
	}

	// Find user by email or username
	const user = await User.findOne({ $or: [{ mobileNo }] });
	if (!user) {
		throw new ApiError(404, "User does not exist");
	}

	// Validate password
	const isPasswordValid = await user.isPasswordCorrect(password);
	if (!isPasswordValid) {
		throw new ApiError(401, "Invalid user credentials");
	}

	// Generate access and refresh tokens
	const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

	// Fetch the logged-in user without password and refreshToken fields
	const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

	// Set HTTP-only and secure cookie options
	const options = { httpOnly: true, secure: true };

	// Return success response with tokens and user info
	return res
		.status(200)
		.cookie("accessToken", accessToken, options)
		.cookie("refreshToken", refreshToken, options)
		.json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged In Successfully"));
});

// Controller for user logout
const logoutUser = asyncHandler(async (req, res) => {
	// Remove refresh token from user document
	await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } }, { new: true });

	// Clear access and refresh tokens from cookies
	const options = { httpOnly: true, secure: true };
	return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(new ApiResponse(200, {}, "User logged Out"));
});

// Controller to refresh access token using refresh token
const refreshAccessToken = asyncHandler(async (req, res) => {
	const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

	if (!incomingRefreshToken) {
		throw new ApiError(401, "Unauthorized request");
	}

	try {
		// Verify the refresh token
		const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
		const user = await User.findById(decodedToken?._id);

		if (!user || incomingRefreshToken !== user?.refreshToken) {
			throw new ApiError(401, "Refresh token is expired or invalid");
		}

		// Generate new access and refresh tokens
		const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);
		const options = { httpOnly: true, secure: true };

		// Return the refreshed tokens
		return res
			.status(200)
			.cookie("accessToken", accessToken, options)
			.cookie("refreshToken", newRefreshToken, options)
			.json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token refreshed"));
	} catch (error) {
		throw new ApiError(401, error?.message || "Invalid refresh token");
	}
});

// Controller to change user password
const changeCurrentPassword = asyncHandler(async (req, res) => {
	const { oldPassword, newPassword } = req.body;

	// Verify old password
	const user = await User.findById(req.user?._id);
	const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
	if (!isPasswordCorrect) {
		throw new ApiError(400, "Invalid old password");
	}

	// Set new password and save user
	user.password = newPassword;
	await user.save({ validateBeforeSave: false });

	// Return success response
	return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
});

// Controller to get the current logged-in user's information
const getCurrentUser = asyncHandler(async (req, res) => {
	return res.status(200).json(new ApiResponse(200, req.user, "User fetched successfully"));
});

// Controller to update user's account details (name and email)
const updateAccountDetails = asyncHandler(async (req, res) => {
	const { fullName, email } = req.body;

	if (!fullName || !email) {
		throw new ApiError(400, "All fields are required");
	}

	// Update the user's full name and email
	const user = await User.findByIdAndUpdate(req.user?._id, { $set: { fullName, email } }, { new: true }).select("-password");

	// Return success response
	return res.status(200).json(new ApiResponse(200, user, "Account details updated successfully"));
});

// Controller to update the user's avatar image
const updateUserAvatar = asyncHandler(async (req, res) => {
	const avatarLocalPath = req.file?.path;

	if (!avatarLocalPath) {
		throw new ApiError(400, "Avatar file is missing");
	}

	// Upload new avatar to Cloudinary
	const avatar = await uploadOnCloudinary(avatarLocalPath);
	if (!avatar.url) {
		throw new ApiError(400, "Error while uploading avatar");
	}

	// Update the user's avatar URL
	const user = await User.findByIdAndUpdate(req.user?._id, { $set: { avatar: avatar.url } }, { new: true }).select("-password");

	// Return success response
	return res.status(200).json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

// Controller to get users at different referral levels
const getUsersAtLevel = asyncHandler(async (req, res, _, user_id = null, min_level = null, visitedUsers = null) => {
	try {
		// Extract user_id from query if not passed as an argument
		const userId = user_id || req?.query?.user_id;
		const minLevel = min_level || 1;
		const maxLevel = 5;

		const userLevels = await getUsersLevel(userId, minLevel, maxLevel);
		// Return the result of the recursion (for deeper levels)]
		return res.status(200).json(new ApiResponse(200, userLevels, "Data fetched successfully"));
	} catch (error) {
		// Catch any errors and send an appropriate response
		throw new ApiError(400, error.message || "Something went wrong");
	}
});


const getUsersLevel = async (userId, level = 1, maxLevel = 5) => {
	try {
		if (level > maxLevel) {
			return []; // Stop recursion if we reach the max level
		}
		// Find all users directly sponsored by the given userId
		const directReferrals = await User.find({ sharedId: userId });

		let allReferrals = [...directReferrals];

		// Recursively find referrals for each direct referral
		for (let referral of directReferrals) {
			const deeperReferrals = await getUsersLevel(referral.userId, level + 1, maxLevel);
			allReferrals = allReferrals.concat(deeperReferrals); // Combine current level's referrals with deeper levels
		}

		return allReferrals;
	} catch (error) {
		throw error;
	}

};



export {
	registerUser,
	loginUser,
	logoutUser,
	refreshAccessToken,
	changeCurrentPassword,
	getCurrentUser,
	updateAccountDetails,
	updateUserAvatar,
	getUsersAtLevel
};
