import jwt from 'jsonwebtoken'; // Assuming you're using JWT for authentication
import { User } from "../models/user.model.js";


class ApiResponse {
	constructor(statusCode, data = null, message = "Success") {
		this.statusCode = statusCode;
		this.data = data;
		this.message = message;
		this.success = statusCode < 400;
	}

	// Static method to validate Bearer token
	static async validateToken(req, res) {
		const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
		if (!refreshToken) {
			return res
				.status(401)
				.json(new ApiResponse(401, {}, "User logged Out"));
		}

		try {
			const decodedToken = jwt.verify(refreshToken,
				process.env.REFRESH_TOKEN_SECRET
			); // Verify token with secret key

			const user = await User.findById(decodedToken?._id);

			if (!user) {
				return await ApiResponse.unauthorized(res, 'User not logged in');
				// throw  ApiResponse.unauthorized(401, "Invalid refresh token");
			}

			if (refreshToken !== user?.refreshToken) {
				return await ApiResponse.unauthorized(res, "Refresh token is expired or used");

			}

		} catch (err) {
			return await ApiResponse.unauthorized(res, 'User not logged in');
		}
	}

	// Static methods for global status code handling
	static async success(res, data, message = 'Success') {
		return await res.status(200).json(new ApiResponse(200, data, message));
	}

	static async created(res, data, message = 'Resource created successfully') {
		return await res.status(201).json(new ApiResponse(201, data, message));
	}

	static async badRequest(res, message = 'Bad Request') {
		return await res.status(400).json(new ApiResponse(400, null, message));
	}

	static async unauthorized(res, message = 'Unauthorized') {
		return await res.status(401).json(new ApiResponse(401, null, message));
	}

	static async forbidden(res, message = 'Forbidden') {
		return await res.status(403).json(new ApiResponse(403, null, message));
	}

	static async notFound(res, message = 'Not Found') {
		return await res.status(404).json(new ApiResponse(404, null, message));
	}

	static async internalServerError(res, message = 'Internal Server Error') {
		return await res.status(500).json(new ApiResponse(500, null, message));
	}
}

export { ApiResponse }
