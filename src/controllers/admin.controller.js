// Import required modules and utilities
import { asyncHandler } from '../utils/asyncHandler.js'; // Handles async errors
import { ApiResponse } from '../utils/ApiResponse.js'; // Standard API response format
import { Product, Events, AdminLogin } from '../models/admin.model.js'; // Admin and Events model imports
import { User } from '../models/user.model.js'; // User model import
import { uploadOnCloudinary } from "../utils/cloudinary.js"; // Utility for uploading images to Cloudinary
import { ApiError } from '../utils/ApiError.js';

// Create an instance of ApiResponse to handle response formatting
const createResponse = new ApiResponse();

// Helper function to generate access and refresh tokens
const generateAccessAndRefreshTokens = async (userId) => {
	try {
		// Find the user by ID
		const admin = await AdminLogin.findById(userId);

		// Generate access and refresh tokens
		const accessTokenAdmin = admin.generateAccessToken();
		const refreshTokenAdmin = admin.generateRefreshToken();

		// Save the refresh token to the user document
		admin.refreshTokenAdmin = refreshTokenAdmin;
		await admin.save({ validateBeforeSave: false });

		// Return the tokens
		return { accessTokenAdmin, refreshTokenAdmin };

	} catch (error) {
		// Handle any errors during token generation
		throw new ApiError(500, "Something went wrong while generating refresh and access token");
	}
};


/**
 * @desc Get home data by user ID
 * @route GET /api/admin/home/:user_id
 * @access Public
 */
const getHomeData = asyncHandler(async (req, res) => {
	const { user_id: userId } = req.params;
	return createResponse.success(res, userId, 'Admin API successfully fetched');
});

// Controller for user registration
const registerAdmin = asyncHandler(async (req, res) => {
	const { email, user_name: username, password, mobile_no: mobileNo, is_admin: isAdmin } = req.body;

	// Validate required fields
	if ([email, username, password, mobileNo].some((field) => field?.trim() === "")) {
		throw new ApiError(400, "All fields are required");
	}

	// Check if a user with the same email or username already exists
	const existedUser = await AdminLogin.findOne({ $or: [{ username }, { email }] });
	if (existedUser) {
		throw new ApiError(409, "User with email or username already exists");
	}

	// Check if the avatar image is provided
	const avatarLocalPath = req.files?.adminImg?.[0]?.path || null;
	if (avatarLocalPath) {
		// Upload avatar to Cloudinary
		var avatar = await uploadOnCloudinary(avatarLocalPath);
		if (!avatar) {
			throw new ApiError(400, "Avatar file is required");
		}
	}

	// Create a new user
	const admin = await AdminLogin.create({
		avatar: avatar?.url || null,
		email,
		password,
		username: username?.toLowerCase(),
		mobileNo,
		isAdmin
	});

	// Fetch the created user without password and refreshTokenAdmin fields
	const registeredAdmin = await AdminLogin.findById(admin._id).select("-password -refreshTokenAdmin");

	if (!registeredAdmin) {
		throw new ApiError(500, "Something went wrong while registering the user");
	}

	// Return success response
	return res.status(201).json(new ApiResponse(200, registeredAdmin, "Admin registered Successfully"));
});


// Controller for user login
const adminLogin = asyncHandler(async (req, res) => {
	const { mobile_no: mobileNo, password } = req.body;

	// Validate if either email or username is provided
	if (!mobileNo && !password) {
		throw new ApiError(400, "password or mobileNo is required");
	}

	// Find user by email or username
	const admin = await AdminLogin.findOne({ $or: [{ mobileNo }] });
	if (!admin) {
		throw new ApiError(404, "Admin does not exist");
	}

	// Validate password
	const isPasswordValid = await admin.isPasswordCorrect(password);
	if (!isPasswordValid) {
		throw new ApiError(401, "Invalid user credentials");
	}

	// Generate access and refresh tokens
	const { accessTokenAdmin, refreshTokenAdmin } = await generateAccessAndRefreshTokens(admin._id);

	// Fetch the logged-in user without password and refreshTokenAdmin fields
	const loggedInAdmin = await AdminLogin.findById(admin._id).select("-password -refreshTokenAdmin");

	// Set HTTP-only and secure cookie options
	const options = { httpOnly: true, secure: true };

	// Return success response with tokens and user info
	return res
		.status(200)
		.cookie("accessTokenAdmin", accessTokenAdmin, options)
		.cookie("refreshTokenAdmin", refreshTokenAdmin, options)
		.json(new ApiResponse(200, { admin: loggedInAdmin, accessTokenAdmin, refreshTokenAdmin }, "Admin logged In Successfully"));
});


/**
 * @desc Add a new product
 * @route POST /api/admin/product
 * @access Public
 */
const addProduct = asyncHandler(async (req, res) => {
	const { product_name: productName, level, ratio_between: ratioBetween, price } = req.body;

	// Validate required fields
	if ([productName, level, ratioBetween].some((field) => typeof field === 'string' && field.trim() === "")) {
		return res.status(400).json(400, {}, 'All fields are required');
	}

	// Check for product image in the request
	const productImgPath = req.files?.productImg?.[0]?.path;

	if (!productImgPath) {
		throw new ApiError(400, "Product Image is required");
	}

	// Upload product image to Cloudinary
	const productImgObj = await uploadOnCloudinary(productImgPath);

	if (!productImgObj) {
		throw new ApiError(400, "Avatar file is required");
	}

	// Create new product in the database
	const product = await Product.create({ productName, level, ratioBetween, price, productImg: productImgObj.url });
	const addedProduct = await Product.findById(product._id).select();

	// Return success response with the added product
	return res.status(200).json(
		new ApiResponse(200, addedProduct, 'Product added successfully')
	);
});

/**
 * @desc Add a new event
 * @route POST /api/admin/event
 * @access Public
 */
const addEvent = asyncHandler(async (req, res) => {
	const { title, start_date: startDate, end_date: endDate, description } = req.body;
	// Check for product image in the request
	const eventImgPath = req.files?.eventImg?.[0]?.path;

	// Validate required fields
	if ([title, startDate, endDate, description].some((field) => typeof field === 'string' && field.trim() === "")) {
		return res.status(400).json(400, {}, 'All fields are required');
	}

	if (!eventImgPath) {
		throw new ApiError(400, "Event Image is required");
	}

	// Upload product image to Cloudinary
	const eventImgObj = await uploadOnCloudinary(eventImgPath);

	if (!eventImgObj) {
		throw new ApiError(400, "Event file is required");
	}

	// Create new event in the database
	const event = await Events.create({ title, startDate, endDate, description, eventImg: eventImgObj.url });
	const addedEvent = await Events.findById(event._id).select();

	// Return success response with the added event
	return res.status(200).json(
		new ApiResponse(200, addedEvent, 'Event added successfully')
	);
});

// Controller to update Events Data
const updateEvent = asyncHandler(async (req, res) => {
	const { event_id: eventId, title, start_date: startDate, end_date: endDate, description } = req.body;
	const eventImgPath = req.files?.eventImg?.[0]?.path;

	if (!eventId) {
		throw new ApiError(400, "Event id not found");
	}

	if (!startDate || !endDate || !description || !title) {
		throw new ApiError(400, "All Fields are required");
	}

	if (!eventImgPath) {
		throw new ApiError(400, "Event image is missing");
	}

	// Upload new Event Image to Cloudinary
	const eventImgObj = await uploadOnCloudinary(eventImgPath);
	if (!eventImgObj.url) {
		throw new ApiError(400, "Error while uploading Event Image");
	}

	// Update the Events Data
	const updatedEvent = await Events.findByIdAndUpdate(eventId, { $set: { title, startDate, endDate, description, eventImg: eventImgObj.url } }, { new: true }).select();

	// Return success response
	return res.status(200).json(new ApiResponse(200, updatedEvent, "Event Details updated successfully"));
});

const deleteEventRecord = asyncHandler(async (req, res) => {
	const { event_id: eventId, } = req.body;  // Get the ID from the request body

	// Validate if ID is provided
	if (!eventId) {
		return res.status(400).json(
			new ApiResponse(400, {}, 'Event ID is required')
		);
	}

	// Find the event by ID and delete it
	const deletedEvent = await Events.findByIdAndDelete(eventId);

	// If the event is not found
	if (!deletedEvent) {
		return res.status(404).json(
			new ApiResponse(404, {}, 'Event not found')
		);
	}

	// Return success response
	return res.status(200).json(
		new ApiResponse(200, deletedEvent, 'Event deleted successfully')
	);
});

/**
 * @desc Get all products
 * @route GET /api/admin/products
 * @access Public
 */
const getAllProduct = asyncHandler(async (req, res) => {
	// Fetch all products from the database
	const allProducts = await Product.find();

	// Check if there are no products fetched
	if (!allProducts) {
		return res.status(200).json(
			new ApiResponse(401, {}, "Something went wrong")
		);
	}

	// Return success response with all products
	return res.status(200).json(
		new ApiResponse(200, allProducts, "Data fetched successfully")
	);
});

/**
 * @desc Get all event records
 * @route GET /api/admin/events
 * @access Public
 */
const getEventRecords = asyncHandler(async (req, res) => {
	// Fetch all event records from the database
	const userEventsRecords = await Events.find();

	// Check if there are no event records fetched
	if (!userEventsRecords) {
		return res.status(200).json(
			new ApiResponse(401, {}, "Something went wrong while getting user records")
		);
	}

	// Return success response with all event records
	return res.status(200).json(
		new ApiResponse(200, userEventsRecords, "Data fetched successfully")
	);
});

/**
 * @desc Get all user records
 * @route GET /api/admin/users
 * @access Public
 */
const getUserRecords = asyncHandler(async (req, res) => {
	// Fetch all user records from the database
	const userRecords = await User.find();

	// Check if there are no user records fetched
	if (!userRecords) {
		return res.status(200).json(
			new ApiResponse(401, {}, "Something went wrong while getting user records")
		);
	}

	// Return success response with all user records
	return res.status(200).json(
		new ApiResponse(200, userRecords, "Data fetched successfully")
	);
});

// Export the functions for use in routes
export {
	getHomeData,
	addProduct,
	getAllProduct,
	getUserRecords,
	addEvent,
	getEventRecords,
	updateEvent,
	deleteEventRecord,
	adminLogin,
	registerAdmin
};
