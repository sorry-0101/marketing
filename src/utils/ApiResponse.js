import jwt from 'jsonwebtoken';
import { User } from "../models/user.model.js";

class ApiResponse {
	constructor(statusCode, data = null, message = "Success") {
		this.statusCode = statusCode;
		this.data = data;
		this.message = message;
		this.success = statusCode < 400;
	}

	// Static method to validate Bearer token
	// async validateToken(req, res) {
	// 	const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
	// 	if (!refreshToken) {
	// 		// Return and exit function after sending a response
	// 		return res
	// 			.status(401)
	// 			.json(new ApiResponse(401, {}, "Api Token is missing"));
	// 	}

	// 	try {
	// 		const decodedToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
	// 		const user = await User.findById(decodedToken?._id);

	// 		if (!user) {
	// 			// Return and exit function after sending a response
	// 			return res.status(401).json(new ApiResponse(401, {}, 'User not logged in'));
	// 		}

	// 		if (refreshToken !== user?.refreshToken) {
	// 			// Return and exit function after sending a response
	// 			return res.status(401).json(new ApiResponse(401, {}, "Refresh token is expired or used"));
	// 		}

	// 	} catch (err) {
	// 		// Return and exit function after sending a response
	// 		return res.status(401).json(new ApiResponse(401, {}, 'User not logged in'));
	// 	}
	// }

	// Static methods for global status code handling
	async success(res, data, message = 'Success') {
		return res.status(200).json(new ApiResponse(200, data, message));
	}

	async created(res, data, message = 'Resource created successfully') {
		return res.status(201).json(new ApiResponse(201, data, message));
	}

	async badRequest(res, message = 'Bad Request') {
		return res.status(400).json(new ApiResponse(400, null, message));
	}

	async unauthorized(res, message = 'Unauthorized') {
		return res.status(401).json(new ApiResponse(401, null, message));
	}

	async forbidden(res, message = 'Forbidden') {
		return res.status(403).json(new ApiResponse(403, null, message));
	}

	async notFound(res, message = 'Not Found') {
		return res.status(404).json(new ApiResponse(404, null, message));
	}

	async internalServerError(res, message = 'Internal Server Error') {
		return res.status(500).json(new ApiResponse(500, null, message));
	}
}

export { ApiResponse };
