import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
	User,
	addressSchemaWithdrawal,
	withdrawalRequestAmount,
	Message,
} from "../models/user.model.js";
import { Wallet, WalletTransaction } from "../models/wallet.model.js";

import { Plan } from "../models/admin.model.js";
import { ShareCount } from "../models/wallet.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import axios from "axios";
import moment from "moment";

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
		throw new ApiError(
			500,
			"Something went wrong while generating refresh and access token"
		);
	}
};

// Controller for user registration
const registerUser = asyncHandler(async (req, res) => {
	try {
		const { email, username, password, mobileNo } = req.body;
		const sharedId = req.query.shared_Id;

		let _userId = "";
		let str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnlpqrstuvwxyz0123456789";
		for (let i = 1; i <= 5; i++) {
			let char = Math.floor(Math.random() * str.length + 1);
			_userId += str.charAt(char);
		}

		if (!sharedId) throw new ApiError(400, "SharedId No found");

		// Validate required fields
		if (
			[email, username, password, sharedId, mobileNo].some(
				(field) => field?.trim() === ""
			)
		) {
			throw new ApiError(400, "All fields are required");
		}

		// Check if a user with the same email or username already exists
		const existedUser = await User.findOne({
			$or: [{ username }, { email }, { mobileNo }],
		});
		if (existedUser) {
			throw new ApiError(409, "User with email or username already exists");
		}

		// Check if the avatar image is provided
		// const avatarLocalPath = req.files?.avatar?.[0]?.path;
		// if (!avatarLocalPath) {
		// 	throw new ApiError(400, "Avatar file is required");
		// }

		// // Upload avatar to Cloudinary
		// const avatar = await uploadOnCloudinary(avatarLocalPath);
		// if (!avatar) {
		// 	throw new ApiError(400, "Avatar file is required");
		// }

		// Create a new user
		const user = await User.create({
			username: username?.toLowerCase(),
			email,
			mobileNo,
			password,
			sharedId,
			userId: _userId,
			// adminImg: avatar.url,
		});

		// Fetch the created user without password and refreshToken fields
		const createdUser = await User.findById(user._id).select(
			"-password -refreshToken"
		);

		if (!createdUser) {
			throw new ApiError(
				500,
				"Something went wrong while registering the user"
			);
		}

		if (sharedId) {
			console.log("sharedId : ", sharedId);

			// Find the document by sharedId
			let shareCount = await ShareCount.findOne({ userId: sharedId });
			console.log("shareCount", shareCount);

			if (!shareCount) {

				try {
					// Create a new document if one does not exist
					console.log("ShareCount document not found, creating a new one for sharedId: ", sharedId);

					shareCount = await ShareCount.create({
						userId: sharedId,
						shareCount: 0,
						totalShareCount: 0,
						callDate: moment().startOf('day'),
						grabCount: 0
					});

					console.log("New ShareCount document created for sharedId:", sharedId);
				} catch (error) {
					console.error("Error creating ShareCount document:", error);
					throw new ApiError(500, "Error creating ShareCount document");
				}
			} else {
				// If the document exists, update the shareCount and totalShareCount
				const totalShareCount = shareCount.totalShareCount + 1;
				const updatedShareCount = shareCount.shareCount + 1;

				await ShareCount.findOneAndUpdate(
					{ sharedId },
					{
						$set: {
							shareCount: updatedShareCount, // Update the share count
							totalShareCount, // Update the total share count
						},
					},
					{ new: true }
				);
				console.log("ShareCount document updated for sharedId:", sharedId);
			}
		}

		const transaction = await WalletTransaction.create({
			userId: _userId,
			transactionId: `${Math.floor(Math.random() * 100000)}${Date.now()}`,
			credit: 0,
			balance: 0,
			transactionType: "Opening Amount",
			reference: `self`,
			referenceId: _userId,
		});

		const walletDetails = await WalletTransaction.findById(transaction._id).select();
		// Return success response
		return res
			.status(201)
			.json(
				new ApiResponse(
					200,
					{ createdUser, walletDetails, },
					"User registered Successfully"
				)
			);
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
	const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
		user._id
	);

	// Fetch the logged-in user without password and refreshToken fields
	const loggedInUser = await User.findById(user._id).select(
		"-password -refreshToken"
	);


	const userId = loggedInUser.userId,
		walletDetails = await WalletTransaction.findOne({ userId }).sort({ _id: -1 }),
		childUsers = await getUsersLevel(loggedInUser.userId),
		plans = await Plan.find({}),
		shareCountDetails = await ShareCount.findOne({ userId });

	const currentlyActivePlan = plans?.find(itm => ((itm.price <= walletDetails?.balance) && (itm?.shareLimit <= shareCountDetails?.shareCount)));
	req.user = loggedInUser;

	const UserActivePlan = {
		title: currentlyActivePlan?.title,
		commission: currentlyActivePlan?.commission,
		price: currentlyActivePlan?.price,
		planImg: currentlyActivePlan?.planImg,
		grabNo: currentlyActivePlan?.grabNo,
		shareCount: currentlyActivePlan?.shareCount,
		shareLimit: currentlyActivePlan?.shareLimit,
	}

	req.user.activePlan = UserActivePlan;
	global.activePlan = UserActivePlan;

	// Store user details in the global variable
	global.logged_in_user = global.logged_in_user || {};
	global.logged_in_user = {
		userId: loggedInUser.userId,
		userName: loggedInUser.username,
		mobileNo: loggedInUser.mobileNo,
		sharedId: loggedInUser.sharedId,
		email: loggedInUser.email,
	};

	// Set HTTP-only and secure cookie options
	const options = { httpOnly: true, secure: true };

	// Return success response with tokens and user info
	return res
		.status(200)
		.cookie("accessToken", accessToken, options)
		.cookie("refreshToken", refreshToken, options)
		.json(
			new ApiResponse(
				200,
				{
					user: loggedInUser,
					activePlan: currentlyActivePlan,
					walletDetails: walletDetails,
					accessToken,
					refreshToken,
				},
				"User logged In Successfully"
			)
		);
});

// Controller for user logout
const logoutUser = asyncHandler(async (req, res) => {
	// Remove refresh token from user document
	await User.findByIdAndUpdate(
		req.user._id,
		{ $unset: { refreshToken: 1 } },
		{ new: true }
	);

	// Clear access and refresh tokens from cookies
	const options = { httpOnly: true, secure: true };
	return res
		.status(200)
		.clearCookie("accessToken", options)
		.clearCookie("refreshToken", options)
		.json(new ApiResponse(200, {}, "User logged Out"));
});

// Controller to refresh access token using refresh token
const refreshAccessToken = asyncHandler(async (req, res) => {
	const incomingRefreshToken =
		req.cookies.refreshToken || req.body.refreshToken;

	if (!incomingRefreshToken) {
		throw new ApiError(401, "Unauthorized request");
	}

	try {
		// Verify the refresh token
		const decodedToken = jwt.verify(
			incomingRefreshToken,
			process.env.REFRESH_TOKEN_SECRET
		);
		const user = await User.findById(decodedToken?._id);

		if (!user || incomingRefreshToken !== user?.refreshToken) {
			throw new ApiError(401, "Refresh token is expired or invalid");
		}

		// Generate new access and refresh tokens
		const { accessToken, newRefreshToken } =
			await generateAccessAndRefreshTokens(user._id);
		const options = { httpOnly: true, secure: true };

		// Return the refreshed tokens
		return res
			.status(200)
			.cookie("accessToken", accessToken, options)
			.cookie("refreshToken", newRefreshToken, options)
			.json(
				new ApiResponse(
					200,
					{ accessToken, refreshToken: newRefreshToken },
					"Access token refreshed"
				)
			);
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
	return res
		.status(200)
		.json(new ApiResponse(200, {}, "Password changed successfully"));
});

const changePassword = asyncHandler(async (req, res) => {
	const { mobileNo, newPassword } = req.body;

	// Check if mobileNo and newPassword are provided
	if (!mobileNo || !newPassword) {
		throw new ApiError(400, "Mobile number and new password are required");
	}

	// Find user by mobileNo
	const user = await User.findOne({ mobileNo });
	if (!user) {
		throw new ApiError(404, "User not found with the provided mobile number");
	}

	// Set new password and save user
	user.password = newPassword;
	await user.save({ validateBeforeSave: false });

	// Return success response
	return res
		.status(200)
		.json(new ApiResponse(200, {}, "Password changed successfully"));
});

// Controller to get the current logged-in user's information
const getCurrentUser = asyncHandler(async (req, res) => {
	return res
		.status(200)
		.json(
			new ApiResponse(200, req.user, "User fetched successfully")
		);
});

// Controller to update user's account details (name and email)
const updateAccountDetails = asyncHandler(async (req, res) => {
	const { fullName, email } = req.body;

	if (!fullName || !email) {
		throw new ApiError(400, "All fields are required");
	}

	// Update the user's full name and email
	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{ $set: { fullName, email } },
		{ new: true }
	).select("-password");

	// Return success response
	return res
		.status(200)
		.json(new ApiResponse(200, user, "Account details updated successfully"));
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
	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{ $set: { avatar: avatar.url } },
		{ new: true }
	).select("-password");

	// Return success response
	return res
		.status(200)
		.json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

const sendOtp = asyncHandler(async (req, res) => {
	// Send OTP via the external SMS API
	try {
		const { mobileNo } = req.body;

		// Validate if mobile number is provided
		if (!mobileNo) {
			throw new ApiError(400, "Mobile number is required");
		}
		// Find user by mobile number
		const user = await User.findOne({ mobileNo });
		if (!user) {
			throw new ApiError(404, "Mobile number does not exist");
		}
		// Generate a random 6-digit OTP
		const otp = Math.floor(100000 + Math.random() * 900000);
		// Prepare the SMS message
		let smsMessage = `${otp} is your otp for your account verification valid for the next 10 minutes. Esotericit`;
		smsMessage = encodeURIComponent(smsMessage).replace(/%20/g, "+");
		const smsUrl = `http://osd7.in/V2/http-api.php?apikey=${process.env.AUTHKEY}&number=${mobileNo}&message=${smsMessage}&senderid=${process.env.SENDERID}&format=json`;

		await axios.get(smsUrl);
		// Update the user with the OTP and validity time (10 minutes)
		const otpValidity = new Date(new Date().getTime() + 10 * 60000); // 10 minutes validity
		user.otp = otp;
		user.otp_validity = otpValidity;
		await user.save();
		return res
			.status(200)
			.json(
				new ApiResponse(
					200,
					{ mobileNo, OTP: otp },
					"OTP has been sent successfully"
				)
			);
	} catch (error) {
		throw new ApiError(500, "Failed to send OTP. Please try again.");
	}
});

// Controller to get users at different referral levels

// Controller to get users at different referral levels
// const getUsersAtLevel = asyncHandler(
//   async (req, res, _, user_id = null, visitedUsers = null) => {
//     try {
//       // Extract user_id from query if not passed as an argument
//       const userId = user_id || req?.query?.user_id;

//       // Get all referral levels for the user
//       const userLevels = await getUsersLevel(userId);
//       // Return the result of the recursion (for deeper levels)]
//       return res
//         .status(200)
//         .json(new ApiResponse(200, userLevels, "Data fetched successfully"));
//     } catch (error) {
//       //  Catch any errors and send an appropriate response

//       throw new ApiError(400, error.message || "Something went wrong");
//     }
//   }
// );

// const getUsersLevel = async (userId, visitedUsers = new Set()) => {
//   try {
//     // Stop recursion if user has been visited already (to avoid circular references)
//     if (visitedUsers.has(userId)) {
//       return [];
//     }

//     // Mark the user as visited
//     visitedUsers.add(userId);

//     // Find all users directly referred by the given userId
//     const directReferrals = await User.find({ sharedId: userId });

//     let allReferrals = [...directReferrals];

//     // Recursively find referrals for each direct referral
//     for (let referral of directReferrals) {
//       const deeperReferrals = await getUsersLevel(
//         referral.userId,
//         visitedUsers
//       );
//       allReferrals = allReferrals.concat(deeperReferrals);
//     }

//     return allReferrals;
//   } catch (error) {
//     throw error;
//   }
// };

const getUsersAtLevel = asyncHandler(async (req, res) => {
	try {
		const userId = req?.query?.user_id;

		// Get users at level 1, 2, or 3 with their level info
		const userLevels = await getUsersLevel(userId, new Set(), 1);

		// Fetch wallet balances for each user at the specified levels
		const usersWithWalletBalances = await Promise.all(
			userLevels.map(async (user) => {
				const wallet = await Wallet.findOne({ userId: user._id }).select(
					"walletAmount"
				);
				return {
					...user, // Use the existing user object
					walletBalance: wallet ? wallet.walletAmount : 0, // Add wallet balance
				};
			})
		);

		return res
			.status(200)
			.json(
				new ApiResponse(
					200,
					usersWithWalletBalances,
					"Users with levels and wallet balances fetched successfully"
				)
			);
	} catch (error) {
		// Catch and handle any errors
		throw new ApiError(400, error.message || "Something went wrong");
	}
});

const getUsersLevel = async (
	userId,
	visitedUsers = new Set(),
	currentLevel = 1
) => {
	try {
		// If the current level is beyond level 3, stop recursion
		if (currentLevel > 3) {
			return [];
		}

		// Stop recursion if the user has already been visited (to avoid circular references)
		if (visitedUsers.has(userId)) {
			return [];
		}

		// Mark the user as visited
		visitedUsers.add(userId);

		// Find all users directly referred by the given userId
		const directReferrals = await User.find({ sharedId: userId });

		let usersWithLevels = [];

		// Store direct referrals along with their corresponding level
		for (let referral of directReferrals) {
			usersWithLevels.push({
				user: referral, // Add the referral user object
				level: currentLevel, // Add the level number (1, 2, or 3)
			});
		}

		// Recursively find referrals for each direct referral at the next level
		for (let referral of directReferrals) {
			const deeperReferrals = await getUsersLevel(
				referral.userId,
				visitedUsers,
				currentLevel + 1 // Move to the next level
			);
			usersWithLevels = usersWithLevels.concat(deeperReferrals);
		}

		return usersWithLevels;
	} catch (error) {
		throw error;
	}
};

// const processCurrency = asyncHandler(async (req, res) => {
//   const { currencyName, email, mobileNo, amount, blockchain } = req.body;

//   // Validate that all required fields are provided
//   if (!currencyName) {
//     throw new ApiError(
//       400,
//       "currencyName information is required (currencyName and blockchain)"
//     );
//   }
//   if (!email) {
//     throw new ApiError(400, "Email is required");
//   }
//   if (!mobileNo) {
//     throw new ApiError(400, "Phone number is required");
//   }
//   if (!amount) {
//     throw new ApiError(400, "amount  required");
//   }
//   if (!blockchain) {
//     throw new ApiError(400, "blockchain  required");
//   }

//   // Additional business logic can be added here (e.g., saving to DB, validating, etc.)
//   // For now, we return a success response with the provided data

//   return res
//     .status(200)
//     .json(
//       new ApiResponse(
//         200,
//         { currencyName, email, mobileNo, blockchain, amount },
//         "Data processed successfully"
//       )
//     );
// });

// const receiveMoney = asyncHandler(async (req, res) => {
//   const { currencyName, email, amount, mobileNo, blockchain } = req.body;

//   // Validate required fields
//   if (!currencyName) {
//     throw new ApiError(
//       400,
//       "currencyName is required (currencyName and blockchain)"
//     );
//   }
//   if (!email) {
//     throw new ApiError(400, "Email is required");
//   }
//   if (!amount) {
//     throw new ApiError(400, "Amount is required");
//   }
//   if (!mobileNo) {
//     throw new ApiError(400, "Phone is required");
//   }
//   if (!blockchain) {
//     throw new ApiError(400, "Phone is required");
//   }

//   try {
//     // Prepare the request to OxaPay API
//     const response = await axios.post(
//       "https://api.oxapay.com/merchants/request/whitelabel",
//       {
//         merchant: "NCV36N-GTMR3L-6XHTHD-62W176", // Replace with actual merchant code
//         currency: currencyName,
//         payCurrency: currencyName,
//         amount: amount,
//         email: email,
//         description: mobileNo,
//         network: blockchain,
//       }
//     );

//     // Handle the API response
//     if (response.data.result === 100) {
//       handleRequestMoney(response);
//       return res
//         .status(200)
//         .json(
//           new ApiResponse(200, response.data, "Payment request successful")
//         );
//     } else {
//       throw new ApiError(400, `API Error: ${response.data.message}`);
//     }
//   } catch (error) {
//     // Handle any errors
//     console.error("API Error:", error);
//     throw new ApiError(500, "Something went wrong with the payment request");
//   }
// });

// const handleRequestMoney = async (event) => {
//   try {
//     const response = await axios.post(
//       "https://api.oxapay.com/merchants/inquiry",
//       {
//         merchant: "NCV36N-GTMR3L-6XHTHD-62W176",
//         trackId: trackId,
//         // "trackId": "26186222"
//       }
//     );

//     if (response.data.result === 100) {
//       // console.log("fdasdfa hhandleRequest ", response.data);
//       const status = response.data.status;
//       if (status === "Paid" && !sendToSecondAPICalled) {
//         const amount = response.data.payAmount;

//         setTransactionMessage("Transaction is successful. Status: Paid");
//       } else if (status === "Waiting") {
//         setTransactionMessage("Transaction is not successful. Status: Waiting");
//       }
//     } else {
//       console.log("API Error:", response.data.message);
//       // Handle other cases here
//     }
//   } catch (error) {
//     console.error("API Error:", error);
//   }
// };

// Process Withdrawal Request
const saveWithdralAddress = asyncHandler(async (req, res) => {
	const { address } = req.body;

	// Fields to validate
	const requiredFields = {
		address: "Wallet address is required",
	};

	const withdrawalRequest = await addressSchemaWithdrawal.create({ address });

	// Send success response
	return res
		.status(200)
		.json(
			new ApiResponse(
				200,
				withdrawalRequest,
				"Withdrawal request submitted successfully"
			)
		);
});

const getWalletAddress = asyncHandler(async (req, res) => {
	const addresses = await addressSchemaWithdrawal.find();

	// Send success response
	return res
		.status(200)
		.json(new ApiResponse(200, addresses, "Addresses retrieved successfully"));
});

// Process Withdrawal Request
// const processWithdrawal = asyncHandler(async (req, res) => {
//   const { address, amount, username, mobile } = req.body;
//   //   const userNmae = global.logged_in_user.username;
//   //   const userNmae = global.logged_in_user.username;

//   // Fields to validate
//   const requiredFields = {
//     address: "Wallet address is required",
//     amount: "Amount is required",
//     username: "Username is required",
//     mobile: "Mobile number is required",
//   };

//   // Validate fields
//   for (const [field, errorMessage] of Object.entries(requiredFields)) {
//     if (!eval(field)) {
//       throw new ApiError(400, errorMessage);
//     }
//   }

//   // Calculate final amount (95% of amount)
//   const finalAmount = amount * 0.95;

//   // Create a new withdrawal request
//   const withdrawalRequest = await withdrawalRequestAmount.create({
//     address,
//     amount,
//     finalAmount,
//     username,
//     mobile,
//   });

//   // Send success response
//   return res
//     .status(200)
//     .json(
//       new ApiResponse(
//         200,
//         withdrawalRequest,
//         "Withdrawal request submitted successfully"
//       )
//     );
// });

const generateTransactionId = () => {
	return `txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`; // Create a unique transaction ID
};
// Process Withdrawal Request
const processWithdrawal = asyncHandler(async (req, res) => {
	const { userId, address, amount, username, mobile } = req.body;

	// Fields to validate
	const requiredFields = {
		userId: "User ID is required", // Include userId for validation
		address: "Wallet address is required",
		amount: "Amount is required",
		username: "Username is required",
		mobile: "Mobile number is required",
	};

	// Validate fields
	for (const [field, errorMessage] of Object.entries(requiredFields)) {
		if (!req.body[field]) {
			throw new ApiError(400, errorMessage);
		}
	}

	// Calculate final amount (95% of amount)
	const finalAmount = amount * 0.95;

	// Create a new withdrawal request
	const withdrawalRequest = await withdrawalRequestAmount.create({
		userId, // Include userId in the withdrawal request
		address,
		amount,
		finalAmount,
		username,
		mobile,
	});

	// Update the user's wallet balance
	const userWallet = await Wallet.findOne({ userId });

	if (!userWallet) {
		throw new ApiError(404, "User wallet not found");
	}

	// Deduct the final amount from the user's balance
	userWallet.walletAmount -= finalAmount;

	// Save the updated wallet
	const updatedWallet = await userWallet.save();

	// Optionally, you can create a transaction entry for the withdrawal
	const transactionEntry = await WalletTransaction.create({
		userId,
		transactionId: generateTransactionId(),
		credit: 0,
		debit: finalAmount,
		balance: updatedWallet.walletAmount, // Include the updated balance
		transactionType: "withdrawal",
		referenceId: withdrawalRequest._id, // Link to the withdrawal request
		address,
		createdAt: new Date(),
	});

	// Send success response with updated balance
	return res.status(200).json(
		new ApiResponse(
			200,
			{
				withdrawalRequest,
				updatedBalance: updatedWallet.walletAmount,
				transactionEntry,
			}, // Include the updated balance and transaction entry
			"Withdrawal request submitted successfully"
		)
	);
});

// get withdrawals of user
const getAllWithdrawals = asyncHandler(async (req, res) => {
	const withdrawals = await withdrawalRequestAmount.find();

	// Check if there are any withdrawal requests
	if (!withdrawals) {
		throw new ApiError(404, "No withdrawal requests found");
	}

	// Send success response
	return res
		.status(200)
		.json(
			new ApiResponse(
				200,
				withdrawals,
				"Withdrawal requests retrieved successfully"
			)
		);
});

// change withdral request status
const updateWithdrawalStatus = asyncHandler(async (req, res) => {
	const { id, status } = req.body; // Get the withdrawal request ID and status from the request body

	// Validate fields
	if (!id) {
		throw new ApiError(400, "Withdrawal request ID is required");
	}
	if (!status) {
		throw new ApiError(400, "Status is required");
	}

	// Check if status is valid (Pending, Approved, Rejected)
	const validStatuses = ["Pending", "Approved", "Rejected"];
	if (!validStatuses.includes(status)) {
		throw new ApiError(400, "Invalid status value");
	}

	// Find the withdrawal request by ID and update the status
	const withdrawalRequest = await withdrawalRequestAmount.findByIdAndUpdate(
		id,
		{ status },
		{ new: true } // Return the updated document
	);

	if (!withdrawalRequest) {
		throw new ApiError(404, "Withdrawal request not found");
	}

	// Send success response with the updated withdrawal request
	return res
		.status(200)
		.json(
			new ApiResponse(200, withdrawalRequest, "Status updated successfully")
		);
});
// Delete a withdrawal request by user
const deleteWithdrawalRequest = asyncHandler(async (req, res) => {
	const { id } = req.body; // Get the withdrawal request ID from the request body

	// Validate if the ID is provided
	if (!id) {
		throw new ApiError(400, "Withdrawal request ID is required");
	}

	// Find and delete the withdrawal request
	const deletedWithdrawal = await withdrawalRequestAmount.findByIdAndDelete(id);

	if (!deletedWithdrawal) {
		throw new ApiError(404, "Withdrawal request not found");
	}

	// Send success response
	return res
		.status(200)
		.json(
			new ApiResponse(200, null, "Withdrawal request deleted successfully")
		);
});

// const getUsersLevel = async (userId, level = 1, maxLevel = 5) => {
// 	try {
// 		if (level > maxLevel) {
// 			return []; // Stop recursion if we reach the max level
// 		}
// 		// Find all users directly sponsored by the given userId
// 		const directReferrals = await User.find({ sharedId: userId });

// 		let allReferrals = [...directReferrals];

// 		// Recursively find referrals for each direct referral
// 		for (let referral of directReferrals) {
// 			const deeperReferrals = await getUsersLevel(referral.userId, level + 1, maxLevel);
// 			allReferrals = allReferrals.concat(deeperReferrals); // Combine current level's referrals with deeper levels
// 		}

// 		return allReferrals;
// 	} catch (error) {
// 		throw error;
// 	}

// };

// Send message as user (token is used to identify user)
const sendUserMessage = asyncHandler(async (req, res) => {
	const { content } = req.body;
	const senderId = req.user.id;

	// Handling image upload
	const imageMesg = req.file?.path;
	console.log("imageMesg", imageMesg);
	let imageObj = {};
	if (imageMesg) {
		imageObj = await uploadOnCloudinary(imageMesg);
	}

	const message = await Message.create({
		content,
		sender: senderId,
		isAdmin: false,
		chatImg: imageObj.url || null, // If no image, set to null
	});

	const addedMessage = await Message.findById(message._id).select();
	return res
		.status(200)
		.json(new ApiResponse(200, addedMessage, "Message sent successfully"));
});

// Get messages for the user
// const getUserMessages = asyncHandler(async (req, res) => {
//   const messages = await Message.find({ sender: req.user.id, isAdmin: false });

//   return res.status(200).json(messages);
// });

// Get messages for the user
const getUserMessages = asyncHandler(async (req, res) => {
	const messages = await Message.find({
		$or: [
			{ sender: req.user.id, isAdmin: false }, // User's own messages
			{ sender: req.params.id, isAdmin: true }, // Admin messages
		],
	});

	return res.status(200).json(messages);
});

// Delete a user's message
const deleteUserMessage = asyncHandler(async (req, res) => {
	const { messageId } = req.body;

	await Message.findByIdAndDelete(messageId);

	return res.status(200).json({ message: "Message deleted successfully" });
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
	saveWithdralAddress,
	getWalletAddress,
	processWithdrawal,
	getAllWithdrawals,
	updateWithdrawalStatus,
	deleteWithdrawalRequest,
	sendUserMessage,
	getUserMessages,
	deleteUserMessage,
	changePassword,
};

// const generateQr = asyncHandler(async (req, res) => {
//   const { currencyName, email, amount, mobileNo, blockchain } = req.body;

//   // Validate required fields
//   if (!currencyName) {
//     throw new ApiError(
//       400,
//       "currencyName is required (currencyName and blockchain)"
//     );
//   }
//   if (!email) {
//     throw new ApiError(400, "Email is required");
//   }
//   if (!amount) {
//     throw new ApiError(400, "Amount is required");
//   }
//   if (!mobileNo) {
//     throw new ApiError(400, "Phone is required");
//   }
//   if (!blockchain) {
//     throw new ApiError(400, "Phone is required");
//   }

//   try {
//     // Prepare the request to OxaPay API
//     const response = await axios.post(
//       "https://api.oxapay.com/merchants/request/whitelabel",
//       {
//         merchant: "NCV36N-GTMR3L-6XHTHD-62W176",
//         currency: currencyName,
//         payCurrency: currencyName,
//         amount: amount,
//         email: email,
//         description: mobileNo,
//         network: blockchain,
//       }
//     );

//     // Handle the API response
//     if (response.data.result === 100) {
//       // handleRequestMoney(response);
//       return res
//         .status(200)
//         .json(
//           new ApiResponse(200, response.data, "Payment request successful")
//         );
//     } else {
//       throw new ApiError(400, `API Error: ${response.data.message}`);
//     }
//   } catch (error) {
//     // Handle any errors
//     console.error("API Error:", error);
//     throw new ApiError(500, "Something went wrong with the payment request");
//   }
// });

// const generateQr = asyncHandler(async (req, res) => {
//   const { currencyName, email, amount, mobileNo, blockchain } = req.body;

//   // Validate required fields
//   if (!currencyName) {
//     throw new ApiError(
//       400,
//       "currencyName is required (currencyName and blockchain)"
//     );
//   }
//   if (!email) {
//     throw new ApiError(400, "Email is required");
//   }
//   if (!amount) {
//     throw new ApiError(400, "Amount is required");
//   }
//   if (!mobileNo) {
//     throw new ApiError(400, "Phone is required");
//   }
//   if (!blockchain) {
//     throw new ApiError(400, "Blockchain is required");
//   }

//   try {
//     // Prepare the request to OxaPay API
//     const response = await axios.post(
//       "https://api.oxapay.com/merchants/request/whitelabel",
//       {
//         merchant: "NCV36N-GTMR3L-6XHTHD-62W176",
//         currency: currencyName,
//         payCurrency: currencyName,
//         amount: amount,
//         email: email,
//         description: mobileNo,
//         network: blockchain,
//       }
//     );

//     // Handle the API response
//     if (response.data.result === 100) {
//       const trackId = response.data.trackId;

//       // Respond with the initial response from OxaPay
//       res
//         .status(200)
//         .json(
//           new ApiResponse(200, response.data, "Payment request successful")
//         );

//       // Call handleRequestMoney in the background
//       handleRequestMoney({ body: { trackId } }).catch((error) => {
//         console.error("Error handling request money:", error.message);
//       });
//     } else {
//       throw new ApiError(400, `API Error: ${response.data.message}`);
//     }
//   } catch (error) {
//     console.error("API Error:", error);
//     throw new ApiError(500, "Something went wrong with the payment request");
//   }
// });

// const handleRequestMoney = asyncHandler(async (req, res) => {
//   const { trackId } = req.body; // Get trackId from the request body

//   if (!trackId) {
//     return res.status(400).json({ message: "trackId is required" });
//   }
//   console.log("trackId.", trackId);
//   try {
//     // Make the POST request to the external API
//     const response = await axios.post(
//       "https://api.oxapay.com/merchants/inquiry",
//       {
//         merchant: "NCV36N-GTMR3L-6XHTHD-62W176",
//         trackId: trackId,
//       }
//     );

//     console.log("response.data.", response.data);
//     // Check if the response result is 100 (success)
//     if (response.data.result === 100) {
//       console.log("response.data.", response.data);
//       const status = response.data.status;
//       const amount = response.data.payAmount;

//       // Handle different status responses
//       if (status === "Paid") {
//         // Successful payment
//         return res.status(200).json({
//           message: "Transaction is successful.",
//           status: "Paid",
//           amount: amount,
//         });
//       } else if (status === "Waiting") {
//         // Payment is waiting
//         return res.status(200).json({
//           message: "Transaction is not successful. Status: Waiting.",
//           status: "Waiting",
//         });
//       }
//     } else {
//       // Handle API errors
//       return res.status(500).json({
//         message: `API Error: ${response.data.message}`,
//       });
//     }
//   } catch (error) {
//     // Handle errors
//     console.error("API Error:", error.message);
//     return res.status(500).json({
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// });
