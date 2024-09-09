import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

// Middleware to verify JWT for protected routes
export const verifyJWT = asyncHandler(async (req, _, next) => {
	try {
		// Retrieve the token from cookies or Authorization header (Bearer token)
		const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

		// Check if the token exists
		if (!token) {
			throw new ApiError(401, "Unauthorized request"); // Throw error if token is missing
		}

		// Verify the token using the secret key
		const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

		// Find the user by the ID from the decoded token, excluding password and refreshToken fields
		const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

		// If user is not found or the token is invalid, throw an error
		if (!user) {
			throw new ApiError(401, "Invalid Access Token");
		}

		// Attach the user information to the request object for further use in the request cycle
		req.user = user;

		// Call the next middleware or controller function
		next();
	} catch (error) {
		// Handle any errors during token verification and user lookup
		throw new ApiError(401, error?.message || "Invalid access token");
	}
});
