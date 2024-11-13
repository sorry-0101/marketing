"use strict";

import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { AdminLogin } from "../models/admin.model.js"; // Assuming you have an Admin model

// Middleware to verify JWT for protected routes (both user and admin)
export const verifyJWT = asyncHandler(async (req, _, next) => {
	try {
		// Retrieve token for user or admin from cookies or Authorization header (Bearer token)
		const token =
			req.cookies?.accessToken ||
			req.header("Authorization")?.replace("Bearer ", "");

		let userOrAdmin = null;

		// Check if user token exists, else check for admin token
		if (token) {
			// Verify the user token using user secret key
			const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

			// Find the user by ID from the decoded token
			userOrAdmin = await User.findById(decodedToken?._id).select(
				"-password "
			);

			if (!userOrAdmin) {
				userOrAdmin = await AdminLogin.findById(decodedToken?._id).select(
					"-password "
				);
			}

			// If user/admin is not found or token mismatch, clear cookies and require re-login
			if (!userOrAdmin || userOrAdmin.refreshToken !== req.cookies.refreshToken) {
				return res.status(401).clearCookie("accessToken").clearCookie("refreshToken").json({ message: "Session expired. Please log in again." });
			}

			req.user = userOrAdmin;
		} else {
			// Throw an error if neither user nor admin token is present
			throw new ApiError(401, "Unauthorized request");
		}

		// Proceed to the next middleware or controller
		next();
	} catch (error) {
		// Handle token verification errors
		throw new ApiError(401, error?.message || "Invalid access token");
	}
});
