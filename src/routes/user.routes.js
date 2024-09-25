import { Router } from "express";
import {
	loginUser,
	logoutUser,
	registerUser,
	refreshAccessToken,
	changeCurrentPassword,
	getCurrentUser,
	// getUserChannelProfile,
	updateUserAvatar,
	updateAccountDetails,
	getUsersAtLevel,

	processWithdrawal,
	getAllWithdrawals,
	updateWithdrawalStatus,
	deleteWithdrawalRequest,
	sendOtp,
	processCurrency,
	receiveMoney,
	sendUserMessage,
	getUserMessages,
	deleteUserMessage

} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"; // Middleware for verifying JWT
import { upload } from "../middlewares/multer.middleware.js" // Middleware for handling file uploads

const router = Router(); // Initialize express router

// Route for registering a new user
// Uses multer to upload a single "avatar" file before calling registerUser controller
router.route("/register").post(
	upload.fields([{
		name: "avatar",
		maxCount: 1
	}]),
	registerUser
);

// Route for logging in a user
router.route("/login").post(loginUser);

// Route for updating the user avatar
// Requires JWT verification and allows a single file upload for "avatar"
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar);

// Secured routes (JWT verification required for all)

// Route for logging out a user
router.route("/logout").post(verifyJWT, logoutUser);

// Route for refreshing the access token
router.route("/refresh-token").post(refreshAccessToken);

// Route for changing the current user's password
router.route("/change-password").post(verifyJWT, changeCurrentPassword);

// Route to get details of the currently logged-in user
router.route("/current-user").get(verifyJWT, getCurrentUser);

// Route for updating account details (full name, email, etc.)
router.route("/update-account").patch(verifyJWT, updateAccountDetails);

router.route("/users-at-Level").get(verifyJWT, getUsersAtLevel);

// Uncomment the following route if user channel profiles are needed
// router.route("/c/:username").get(verifyJWT, getUserChannelProfile);

//withdrawal request user 
router.route("/withdrawalrequest").post(verifyJWT, processWithdrawal);
router.route("/getwithdrawalrequest").get(verifyJWT, getAllWithdrawals);
router.route("/withdrawalrequest/status").post(verifyJWT, updateWithdrawalStatus);
router.route("/withdrawalrequest/delete").delete(verifyJWT, deleteWithdrawalRequest);

//otp
router.route("/sendOtp").post(sendOtp);
//gateway api for request qr form oxapay
router.route("/usersReciveMoney").post(verifyJWT, processCurrency);
router.route("/receiveMoney").post(verifyJWT, receiveMoney);


// User Routes
// router.route('/sendMessage').post(verifyJWT, sendUserMessage); // Send message with token user as sender
// router.route('/getMessages').get(verifyJWT, getUserMessages); // Get user messages
// router.route('/deleteMessage').delete(verifyJWT, deleteUserMessage);


export default router; // Export the router for use in the app
