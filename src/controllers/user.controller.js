import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User, withdrawalRequestAmount, Message } from "../models/user.model.js";
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

const sendOtp = asyncHandler(async (req, res) => {

	// Send OTP via the external SMS API
	try {
		const { mobileNo } = req.body;

		// Validate if mobile number is provided
		if (!mobileNo) {
			throw new ApiError(400, 'Mobile number is required');
		}

		// Find user by mobile number
		const user = await User.findOne({ mobileNo });
		if (!user) {
			throw new ApiError(404, 'Mobile number does not exist');
		}

		// Generate a random 6-digit OTP
		const otp = Math.floor(100000 + Math.random() * 900000);

		// Prepare the SMS message
		// const smsMessage = encodeURIComponent(`${otp} is your OTP for account verification, valid for the next 10 minutes. Esotericit`);
		let smsMessage = `${otp} is your otp for your account verification valid for the next 10 minutes. Esotericit`;
		smsMessage = encodeURIComponent(smsMessage).replace(/%20/g, '+');

		const smsUrl = `http://osd7.in/V2/http-api.php?apikey=${process.env.AUTHKEY}&number=${mobileNo}&message=${smsMessage}&senderid=${process.env.SENDERID}&format=json`;
		// console.log(smsMessage);
		// console.log("dsds", smsUrl)
		const respsms = await axios.get(smsUrl);
		// Update the user with the OTP and validity time (10 minutes)
		const otpValidity = new Date(new Date().getTime() + 10 * 60000); // 10 minutes validity
		user.otp = otp;
		user.otp_validity = otpValidity;
		await user.save();
		// console.log("resfd", respsms);
		// Return success response with the OTP (for testing purposes; in production, remove OTP from the response)
		return res
			.status(200)
			.json(new ApiResponse(200, { mobileNo, OTP: otp }, 'OTP has been sent successfully'));

	} catch (error) {
		throw new ApiError(500, 'Failed to send OTP. Please try again.');
	}


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


const processCurrency = asyncHandler(async (req, res) => {
	const { currencyName, email, mobileNo, amount, blockchain } = req.body;

	// Validate that all required fields are provided
	if (!currencyName) {
		throw new ApiError(400, 'currencyName information is required (currencyName and blockchain)');
	}
	if (!email) {
		throw new ApiError(400, 'Email is required');
	}
	if (!mobileNo) {
		throw new ApiError(400, 'Phone number is required');
	}
	if (!amount) {
		throw new ApiError(400, 'amount  required');
	} if (!blockchain) {
		throw new ApiError(400, 'blockchain  required');
	}

	// Additional business logic can be added here (e.g., saving to DB, validating, etc.)
	// For now, we return a success response with the provided data

	return res.status(200).json(new ApiResponse(200, { currencyName, email, mobileNo, blockchain, amount }, 'Data processed successfully'));
});



const receiveMoney = asyncHandler(async (req, res) => {
	const { currencyName, email, amount, mobileNo, blockchain } = req.body;

	// Validate required fields
	if (!currencyName) {
		throw new ApiError(400, 'currencyName is required (currencyName and blockchain)');
	}
	if (!email) {
		throw new ApiError(400, 'Email is required');
	}
	if (!amount) {
		throw new ApiError(400, 'Amount is required');
	}
	if (!mobileNo) {
		throw new ApiError(400, 'Phone is required');
	}
	if (!blockchain) {
		throw new ApiError(400, 'Phone is required');
	}

	try {
		// Prepare the request to OxaPay API
		const response = await axios.post('https://api.oxapay.com/merchants/request/whitelabel', {
			merchant: "NCV36N-GTMR3L-6XHTHD-62W176", // Replace with actual merchant code
			currency: currencyName,
			payCurrency: currencyName,
			amount: amount,
			email: email,
			description: mobileNo,
			network: blockchain
		});


		// Handle the API response
		if (response.data.result === 100) {
			handleRequestMoney(response);
			return res.status(200).json(new ApiResponse(200, response.data, 'Payment request successful'));
		} else {
			throw new ApiError(400, `API Error: ${response.data.message}`);
		}
	} catch (error) {
		// Handle any errors
		console.error("API Error:", error);
		throw new ApiError(500, 'Something went wrong with the payment request');
	}
});


const handleRequestMoney = async (event) => {
	console.log("jai shree ram")

	try {
		const response = await axios.post(
			'https://api.oxapay.com/merchants/inquiry',
			{
				merchant: "NCV36N-GTMR3L-6XHTHD-62W176",
				trackId: trackId,
				// "trackId": "26186222"


			}
		);

		if (response.data.result === 100) {
			// console.log("fdasdfa hhandleRequest ", response.data);
			const status = response.data.status;
			if (status === "Paid" && !sendToSecondAPICalled) {
				const amount = response.data.payAmount;

				setTransactionMessage("Transaction is successful. Status: Paid");
			} else if (status === "Waiting") {
				setTransactionMessage("Transaction is not successful. Status: Waiting");
			}

		} else {
			console.log("API Error:", response.data.message);
			// Handle other cases here
		}
	} catch (error) {
		console.error("API Error:", error);
	}
};

// Process Withdrawal Request
const processWithdrawal = asyncHandler(async (req, res) => {
	const { address, amount, username, mobile } = req.body;

	// Validate fields
	if (!address) {
		throw new ApiError(400, 'Wallet address is required');
	}
	if (!amount) {
		throw new ApiError(400, 'Amount is required');
	}
	if (!username) {
		throw new ApiError(400, 'Username is required');
	}
	if (!mobile) {
		throw new ApiError(400, 'Mobile number is required');
	}

	// Calculate final amount (97% of amount)
	const finalAmount = amount * 0.97;

	// Create a new withdrawal request
	const withdrawalRequest = await withdrawalRequestAmount.create({
		address,
		amount,
		finalAmount,
		username,
		mobile
	});

	// Send success response
	return res.status(200).json(new ApiResponse(200, withdrawalRequest, 'Withdrawal request submitted successfully'));
});

// get withdrawals of user 
const getAllWithdrawals = asyncHandler(async (req, res) => {
	const withdrawals = await withdrawalRequestAmount.find();

	// Check if there are any withdrawal requests
	if (!withdrawals) {
		throw new ApiError(404, 'No withdrawal requests found');
	}

	// Send success response
	return res.status(200).json(new ApiResponse(200, withdrawals, 'Withdrawal requests retrieved successfully'));
});

// change withdral request status

const updateWithdrawalStatus = asyncHandler(async (req, res) => {
	const { id, status } = req.body; // Get the withdrawal request ID and status from the request body

	// Validate fields
	if (!id) {
		throw new ApiError(400, 'Withdrawal request ID is required');
	}
	if (!status) {
		throw new ApiError(400, 'Status is required');
	}

	// Check if status is valid (Pending, Approved, Rejected)
	const validStatuses = ['Pending', 'Approved', 'Rejected'];
	if (!validStatuses.includes(status)) {
		throw new ApiError(400, 'Invalid status value');
	}

	// Find the withdrawal request by ID and update the status
	const withdrawalRequest = await withdrawalRequestAmount.findByIdAndUpdate(
		id,
		{ status },
		{ new: true } // Return the updated document
	);

	if (!withdrawalRequest) {
		throw new ApiError(404, 'Withdrawal request not found');
	}

	// Send success response with the updated withdrawal request
	return res.status(200).json(new ApiResponse(200, withdrawalRequest, 'Status updated successfully'));
});
// Delete a withdrawal request by user
const deleteWithdrawalRequest = asyncHandler(async (req, res) => {
	const { id } = req.body; // Get the withdrawal request ID from the request body

	// Validate if the ID is provided
	if (!id) {
		throw new ApiError(400, 'Withdrawal request ID is required');
	}

	// Find and delete the withdrawal request
	const deletedWithdrawal = await withdrawalRequestAmount.findByIdAndDelete(id);

	if (!deletedWithdrawal) {
		throw new ApiError(404, 'Withdrawal request not found');
	}

	// Send success response
	return res.status(200).json(new ApiResponse(200, null, 'Withdrawal request deleted successfully'));
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



// Send message as user (token is used to identify user)
const sendUserMessage = asyncHandler(async (req, res) => {
	const { content } = req.body;
	const senderId = req.user.id; // User ID from token

	// Handling image upload
	const image = req.files?.chatImg?.[0]?.path;
	let imageUrl = '';
	if (image) {
		const imageObj = await uploadOnCloudinary(image);
		imageUrl = imageObj.url;
	}

	const message = await Message.create({
		content,
		imageUrl,
		sender: senderId,
		isAdmin: false,
	});

	return res.status(200).json({ message, message: 'Message sent successfully' });
});


// Get messages for the user
const getUserMessages = asyncHandler(async (req, res) => {
	const messages = await Message.find({ sender: req.user.id, isAdmin: false });

	return res.status(200).json(messages);
});

// Delete a user's message
const deleteUserMessage = asyncHandler(async (req, res) => {
	const { messageId } = req.body;

	await Message.findByIdAndDelete(messageId);

	return res.status(200).json({ message: 'Message deleted successfully' });
});

export {
	registerUser,
	loginUser,
	logoutUser,
	refreshAccessToken,
	changeCurrentPassword,
	getCurrentUser,
	updateAccountDetails,
	updateUserAvatar,
	getUsersAtLevel,
	sendOtp,
	processCurrency,
	receiveMoney,
	processWithdrawal,
	getAllWithdrawals,
	updateWithdrawalStatus,
	deleteWithdrawalRequest,
	sendUserMessage,
	getUserMessages,
	deleteUserMessage
};
