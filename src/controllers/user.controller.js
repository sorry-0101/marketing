import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
  User,
  addressSchemaWithdrawal,
  withdrawalRequestAmount,
  Message,
  Notification,
} from "../models/user.model.js";
import { Wallet, WalletTransaction } from "../models/wallet.model.js";

import { Plan, Events } from "../models/admin.model.js";
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

    // Create a new user
    const user = await User.create({
      username: username?.toLowerCase(),
      email,
      mobileNo,
      password,
      sharedId,
      userId: _userId,
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

    if (_userId) {
      console.log("_userId : ", _userId);

      // Find the document by sharedId
      let shareCount = await ShareCount.findOne({ userId: _userId });
      console.log("shareCount", shareCount);

      if (!shareCount) {
        try {
          // Create a new document if one does not exist
          console.log(
            "ShareCount document not found, creating a new one for _userId: ",
            _userId
          );

          shareCount = await ShareCount.create({
            userId: _userId,
            shareCount: 0,
            totalShareCount: 0,
            callDate: moment().startOf("day"),
            grabCount: 0,
          });

          console.log("New ShareCount document created for _userId:", _userId);
        } catch (error) {
          console.error("Error creating ShareCount document:", error);
          throw new ApiError(500, "Error creating ShareCount document");
        }
      }
    }

    if (sharedId) {
      console.log("sharedId : ", sharedId);

      // Find the document by sharedId
      let shareCount = await ShareCount.findOne({ userId: sharedId });
      console.log("shareCount", shareCount);

      if (!shareCount) {
        try {
          // Create a new document if one does not exist
          console.log(
            "ShareCount document not found, creating a new one for sharedId: ",
            sharedId
          );

          shareCount = await ShareCount.create({
            userId: sharedId,
            shareCount: 0,
            totalShareCount: 0,
            callDate: moment().startOf("day"),
            grabCount: 0,
          });

          console.log(
            "New ShareCount document created for sharedId:",
            sharedId
          );
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

    const walletDetails = await WalletTransaction.findById(
      transaction._id
    ).select();
    // Return success response
    return res
      .status(201)
      .json(
        new ApiResponse(
          200,
          { createdUser, walletDetails },
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
    walletDetails = await WalletTransaction.findOne({ userId }).sort({
      _id: -1,
    }),
    childUsers = await getUsersLevel(loggedInUser.userId),
    plans = await Plan.find({}),
    shareCountDetails = (await ShareCount.findOne({ userId })) || {
      shareCount: 0,
    };

  const currentlyActivePlan = plans?.find(
    (itm) =>
      itm.price <= walletDetails?.balance &&
      itm?.shareLimit <= shareCountDetails?.shareCount
  );

  req.user = loggedInUser;

  const UserActivePlan = {
    title: currentlyActivePlan?.title,
    commission: currentlyActivePlan?.commission,
    price: currentlyActivePlan?.price,
    planImg: currentlyActivePlan?.planImg,
    grabNo: currentlyActivePlan?.grabNo,
    shareCount: currentlyActivePlan?.shareCount,
    shareLimit: currentlyActivePlan?.shareLimit,
  };

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
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
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

const getUsersAtLevel = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userId || req.query.user_id;

    // Get users at levels 1, 2, or 3 with their level info
    const userLevels = await getUsersLevel(userId, new Set(), 1);
    // console.log("userLevels", userLevels); // Debug log

    // Prepare an array of user IDs for bulk fetching transactions
    const userIds = userLevels.map((item) => item.user.userId); // Extract user IDs

    // Fetch the latest wallet balance for each user using aggregation
    const lastTransactions = await WalletTransaction.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $sort: { _id: -1 } },
      { $group: { _id: "$userId", balance: { $first: "$balance" } } },
      { $project: { userId: "$_id", balance: 1, _id: 0 } },
    ]);

    // Create a mapping of userId to balance for quick lookup
    const balanceMap = lastTransactions.reduce((acc, transaction) => {
      acc[transaction.userId] = transaction.balance;
      return acc;
    }, {});

    // Merge user levels with their corresponding wallet balances
    const usersWithWalletBalances = userLevels.map((item) => {
      const user = item.user; // Get the user object
      const currentUserId = user.userId; // Access userId directly from user object

      // Get the balance from the mapping, default to 0 if not found
      const walletBalance = balanceMap[currentUserId] || 0;

      return {
        userId: user.userId,
        username: user.username,
        email: user.email,
        mobileNo: user.mobileNo,
        sharedId: user.sharedId,
        walletBalance, // Include the wallet balance
        level: item.level, // Extract the level from the item
      };
    });

    // Send the response with the users and their wallet balances
    res.status(200).json(usersWithWalletBalances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
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

// Process Withdrawal Request
const saveWithdralAddress = asyncHandler(async (req, res) => {
  const userId = req.user.userId || req.query.user_id;
  const { address } = req.body;

  // Validate fields
  if (!address) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Wallet address is required"));
  }

  // Save the address with the userId
  const withdrawalRequest = await addressSchemaWithdrawal.create({
    userId,
    address,
  });

  // Send success response
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        withdrawalRequest,
        "Withdrawal address saved successfully"
      )
    );
});

const getWalletAddress = asyncHandler(async (req, res) => {
  const userId = req.user.userId || req.query.user_id;
  const addresses = await addressSchemaWithdrawal.find({ userId }); // Fetch address by userId

  if (!addresses) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "No address found for this user"));
  }

  // Send success response
  return res
    .status(200)
    .json(new ApiResponse(200, addresses, "Address retrieved successfully"));
});

const generateTransactionId = () => {
  return `txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`; // Create a unique transaction ID
};
// Process Withdrawal Request

const processWithdrawal = asyncHandler(async (req, res) => {
  const { userId, address, amount, username, mobile } = req.body;

  // Fields to validate
  const requiredFields = {
    userId: "User ID is required",
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

  // Calculate final amount (95% of the requested amount)
  const finalAmount = amount * 0.95;

  // Retrieve the last transaction for this user to get the current balance
  const lastTransaction = await WalletTransaction.findOne({ userId }).sort({
    _id: -1,
  });
  console.log("lastTransaction", lastTransaction);

  // Ensure there's a last transaction entry to retrieve balance
  if (!lastTransaction) {
    return res
      .status(400)
      .json(
        new ApiResponse(400, null, "No transaction history found for this user")
      );
  }

  // Calculate the new balance after the withdrawal
  const updatedBalance = lastTransaction.balance - finalAmount;

  // Check if the balance is sufficient for the withdrawal
  if (updatedBalance < 0) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Insufficient balance"));
  }

  // Create a new withdrawal request
  const withdrawalRequest = await withdrawalRequestAmount.create({
    userId,
    address,
    amount,
    finalAmount,
    username,
    mobile,
  });

  // Create a transaction entry for the withdrawal
  const transactionEntry = await WalletTransaction.create({
    userId,
    transactionId: generateTransactionId(),
    credit: 0, // No credit since this is a withdrawal
    debit: finalAmount, // Amount being withdrawn
    balance: updatedBalance, // Updated balance after withdrawal
    transactionType: "Withdrawal",
    reference: "User Withdrawal",
    referenceId: withdrawalRequest._id,
    address,
    createdAt: new Date(),
  });

  // Send success response with updated balance and transaction entry
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        withdrawalRequest,
        updatedBalance,
        transactionEntry,
      },
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

// Send message as user (token is used to identify user)
const sendUserMessage = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const senderId = req.query.user_id;
  const imageMesg = req.file?.path;

  let imageObj = {};
  if (imageMesg) {
    imageObj = await uploadOnCloudinary(imageMesg);
  }

  const message = await Message.create({
    content,
    chatImg: imageObj.url || null,
    sender: senderId,
    isAdmin: false,
  });
  const addedMessage = await Message.findById(message._id).select();
  return res
    .status(200)
    .json(new ApiResponse(200, addedMessage, "Message sent successfully"));
});

// Get messages for the user
const getUserMessages = asyncHandler(async (req, res) => {
  // Get user ID from request user or query parameters
  const userId = req.query.user_id; // Get the user ID
  const messages = await Message.find({
    $or: [
      { sender: userId, isAdmin: false },
      { sender: userId, isAdmin: true },
    ],
  });

  await Message.updateMany(
    {
      sender: userId, // Messages sent by admin (not sent by the user)
      isAdmin: true, // Only admin messages
      readBy: { $ne: userId }, // User hasn't read these messages
    },
    { $addToSet: { readBy: userId } } // Add userId to the readBy array
  );

  return res.status(200).json(messages);
});

// Delete a user's message
const deleteUserMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.body;

  await Message.findByIdAndDelete(messageId);

  return res.status(200).json({ message: "Message deleted successfully" });
});

// Get user Level for the user
const getUserLevel = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userId || req.query.user_id;

    const walletDetails = await WalletTransaction.findOne({ userId }).sort({
      _id: -1,
    });
    const plans = await Plan.find({});
    const shareCountDetails = await ShareCount.findOne({ userId });
    const activePlan = plans?.find((plan) => {
      //   console.log("Checking plan:", plan);
      return (
        plan.price <= (walletDetails?.balance || 0) &&
        plan.shareLimit <= (shareCountDetails?.shareCount || 0)
      );
    });
    return res.status(200).json({
      success: true,
      message: "User level retrieved successfully",
      data: {
        userId,
        walletBalance: walletDetails?.balance || 0,
        shareCount: shareCountDetails?.shareCount || 0,
        activePlan: activePlan || null,
      },
    });
  } catch (error) {
    console.error("Error retrieving user level:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user level",
    });
  }
});

// Get count of unread notifications for a specific user
const getUnreadNotificationCount = asyncHandler(async (req, res) => {
  //   const userId = req.params.userId;
  const userId = req.user.userId || req.query.user_id;

  const count = await Notification.countDocuments({
    readBy: { $ne: userId }, // Count notifications that do not include this userId in `readBy`
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { unreadCount: count },
        "Unread notifications count fetched successfully"
      )
    );
});

// Get all notifications for a user and mark them as read

const getAllNotifications = asyncHandler(async (req, res) => {
  // Retrieve the user ID from the request
  const userId = req.user.userId || req.query.user_id;

  // Fetch all notifications sorted by createdAt
  const notifications = await Notification.find().sort({ createdAt: -1 });

  // Fetch all events sorted by createdAt
  const userEventsRecords = await Events.find().sort({ createdAt: -1 });

  // Mark all unread notifications as read by adding the userId to `readBy` array
  await Notification.updateMany(
    { readBy: { $ne: userId } }, // Find notifications the user hasn't read
    { $addToSet: { readBy: userId } } // Add userId to `readBy` array
  );

  // Combine the notifications and events into a single array with `type` field
  const combinedData = [
    ...notifications.map((notification) => ({
      ...notification.toObject(), // Convert Mongoose document to plain JavaScript object
      type: "notification", // Add a field to distinguish notification
    })),
    ...userEventsRecords.map((event) => ({
      ...event.toObject(), // Convert Mongoose document to plain JavaScript object
      type: "event", // Add a field to distinguish event
    })),
  ];

  // Return the combined notifications and events in the response
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        combinedData,
        "Notifications and events fetched successfully"
      )
    );
});

// const getAllNotifications = asyncHandler(async (req, res) => {
//   //   const userId = req.params.userId;
//   const userId = req.user.userId || req.query.user_id;

//   // Fetch all notifications
//   const notifications = await Notification.find().sort({ createdAt: -1 });

//   // Mark all unread notifications as read by adding userId to `readBy` array
//   await Notification.updateMany(
//     { readBy: { $ne: userId } }, // Find notifications the user hasn't read
//     { $addToSet: { readBy: userId } } // Add userId as a string to `readBy` array
//   );

//   return res
//     .status(200)
//     .json(
//       new ApiResponse(
//         200,
//         notifications,
//         "Notifications fetched and marked as read"
//       )
//     );
// });

const getUserUnreadMessageCount = asyncHandler(async (req, res) => {
  const userId = req.query.userId; // Get the user ID from the query

  // Count messages that are sent by admin to this user and have not been read by this user
  const count = await Message.countDocuments({
    sender: userId, // Ensure the message is sent by the admin
    isAdmin: true, // Only count messages sent by admin
    readBy: { $ne: userId }, // Exclude messages that the user has read
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { unreadCount: count },
        "Unread messages count for user fetched successfully"
      )
    );
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
  getUserLevel,
  getUnreadNotificationCount,
  getAllNotifications,
  getUserUnreadMessageCount,
};

// const getUserMessages = asyncHandler(async (req, res) => {
//   const userId = req.user.userId || req.query.user_id; // Get user ID from request parameters

//   const messages = await Message.find({
//     $or: [
//       { sender: userId, receiver: req.user.adminId, isAdmin: false }, // User's messages to Admin
//       { sender: req.user.adminId, receiver: userId, isAdmin: true }, // Admin's messages to User
//     ],
//   }).sort({ createdAt: 1 }); // Sort messages by created date

//   return res
//     .status(200)
//     .json(new ApiResponse(200, messages, "Messages retrieved successfully"));
// });

// const processWithdrawal = asyncHandler(async (req, res) => {
//   const { userId, address, amount, username, mobile } = req.body;

//   // Fields to validate
//   const requiredFields = {
//     userId: "User ID is required", // Include userId for validation
//     address: "Wallet address is required",
//     amount: "Amount is required",
//     username: "Username is required",
//     mobile: "Mobile number is required",
//   };

//   // Validate fields
//   for (const [field, errorMessage] of Object.entries(requiredFields)) {
//     if (!req.body[field]) {
//       throw new ApiError(400, errorMessage);
//     }
//   }

//   // Calculate final amount (95% of amount)
//   const finalAmount = amount * 0.95;

//   // Create a new withdrawal request
//   const withdrawalRequest = await withdrawalRequestAmount.create({
//     userId, // Include userId in the withdrawal request
//     address,
//     amount,
//     finalAmount,
//     username,
//     mobile,
//   });

//   // Update the user's wallet balance
//   //   const userWallet = await Wallet.findOne({ userId });

//   //   if (!userWallet) {
//   //     throw new ApiError(404, "User wallet not found");
//   //   }

//   // Deduct the final amount from the user's balance
//   //   userWallet.walletAmount -= finalAmount;

//   // Save the updated wallet
//   //   const updatedWallet = await userWallet.save();

//   const lastTransaction = await WalletTransaction.findOne({ userId }).sort({
//     _id: -1,
//   });
//   console.log("lastTransaction", lastTransaction);
//   // Optionally, you can create a transaction entry for the withdrawal
//   //   const transactionEntry = await WalletTransaction.create({
//   //     userId,
//   //     transactionId: generateTransactionId(),
//   //     credit: 0,
//   //     debit: finalAmount,
//   //     balance: ,
//   //     transactionType: "withdrawal",
//   //     referenceId: withdrawalRequest._id,
//   //     address,
//   //     createdAt: new Date(),
//   //   });

//   // Send success response with updated balance
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       {
//         withdrawalRequest,
//         // updatedBalance: updatedWallet.walletAmount,
//         transactionEntry,
//       }, // Include the updated balance and transaction entry
//       "Withdrawal request submitted successfully"
//     )
//   );
// });

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
