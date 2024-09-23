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
	getUsersAtLevel
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

export default router; // Export the router for use in the app
