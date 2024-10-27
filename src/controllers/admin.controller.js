// Import required modules and utilities
import { asyncHandler } from "../utils/asyncHandler.js"; // Handles async errors
import { ApiResponse } from "../utils/ApiResponse.js"; // Standard API response format
import {
	Product,
	Events,
	AdminLogin,
	Slider,
	Plan,
	Country,
} from "../models/admin.model.js"; // Admin and Events model imports
import { Wallet, WalletTransaction } from "../models/wallet.model.js";

import {
	User,
	withdrawalRequestAmount,
	Message,
} from "../models/user.model.js"; // User model import
import { uploadOnCloudinary } from "../utils/cloudinary.js"; // Utility for uploading images to Cloudinary
import { ApiError } from "../utils/ApiError.js";

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
		throw new ApiError(
			500,
			"Something went wrong while generating refresh and access token"
		);
	}
};

/**
 * @desc Get home data by user ID
 * @route GET /api/admin/home/:adminLogin
 * @access Public
 */
const getHomeData = asyncHandler(async (req, res) => {
	const { user_id: userId } = req.params;
	return createResponse.success(res, userId, "Admin API successfully fetched");
});

// Controller for user registration
const registerAdmin = asyncHandler(async (req, res) => {
	const {
		email,
		user_name: username,
		password,
		mobile_no: mobileNo,
		is_admin: isAdmin,
	} = req.body;

	// Validate required fields
	if (
		[email, username, password, mobileNo].some((field) => field?.trim() === "")
	) {
		throw new ApiError(400, "All fields are required");
	}

	// Check if a user with the same email or username already exists
	const existedUser = await AdminLogin.findOne({
		$or: [{ username }, { email }],
	});
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
		isAdmin,
	});

	// Fetch the created user without password and refreshTokenAdmin fields
	const registeredAdmin = await AdminLogin.findById(admin._id).select(
		"-password -refreshTokenAdmin"
	);

	if (!registeredAdmin) {
		throw new ApiError(500, "Something went wrong while registering the user");
	}

	// Return success response
	return res
		.status(201)
		.json(
			new ApiResponse(200, registeredAdmin, "Admin registered Successfully")
		);
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
	const { accessTokenAdmin, refreshTokenAdmin } =
		await generateAccessAndRefreshTokens(admin._id);

	// Fetch the logged-in user without password and refreshTokenAdmin fields
	const loggedInAdmin = await AdminLogin.findById(admin._id).select(
		"-password -refreshTokenAdmin"
	);

	// Set HTTP-only and secure cookie options
	const options = { httpOnly: true, secure: true };

	// Return success response with tokens and user info
	return res
		.status(200)
		.cookie("accessTokenAdmin", accessTokenAdmin, options)
		.cookie("refreshTokenAdmin", refreshTokenAdmin, options)
		.json(
			new ApiResponse(
				200,
				{ admin: loggedInAdmin, accessTokenAdmin, refreshTokenAdmin },
				"Admin logged In Successfully"
			)
		);
});

/**
 * @desc Add a new product
 * @route POST /api/admin/product
 * @access Public
 */

const addProduct = asyncHandler(async (req, res) => {
	const {
		product_name: productName,
		// level,
		ratio_between: ratioBetween,
		price,
		plan_id: planId, // Add plan_id here
		plan_name: planName, // Add plan_name here
	} = req.body;

	// Validate required fields
	if (
		[productName, ratioBetween, planId, planName].some(
			(field) => typeof field === "string" && field.trim() === ""
		)
	) {
		return res.status(400).json(400, {}, "All fields are required");
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

	let productId = "";
	let str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnlpqrstuvwxyz0123456789";
	for (let i = 1; i <= 5; i++) {
		let char = Math.floor(Math.random() * str.length + 1);
		productId += str.charAt(char);
	}

	// Create new product in the database
	const product = await Product.create({
		productName,
		// level,
		ratioBetween,
		price,
		planId, // Include planId
		planName, // Include planName
		productId,
		productImg: productImgObj.url,
	});
	const addedProduct = await Product.findById(product._id).select();

	// Return success response with the added product
	return res
		.status(200)
		.json(new ApiResponse(200, addedProduct, "Product added successfully"));
});

// const addProduct = asyncHandler(async (req, res) => {
//   const {
//     product_name: productName,
//     level,
//     ratio_between: ratioBetween,
//     price,
//   } = req.body;

//   // Validate required fields
//   if (
//     [productName, level, ratioBetween].some(
//       (field) => typeof field === "string" && field.trim() === ""
//     )
//   ) {
//     return res.status(400).json(400, {}, "All fields are required");
//   }

//   // Check for product image in the request
//   const productImgPath = req.files?.productImg?.[0]?.path;

//   if (!productImgPath) {
//     throw new ApiError(400, "Product Image is required");
//   }

//   // Upload product image to Cloudinary
//   const productImgObj = await uploadOnCloudinary(productImgPath);

//   if (!productImgObj) {
//     throw new ApiError(400, "Avatar file is required");
//   }

//   // Create new product in the database
//   const product = await Product.create({
//     productName,
//     level,
//     ratioBetween,
//     price,
//     productImg: productImgObj.url,
//   });
//   const addedProduct = await Product.findById(product._id).select();

//   // Return success response with the added product
//   return res
//     .status(200)
//     .json(new ApiResponse(200, addedProduct, "Product added successfully"));
// });

/**
 * @desc Add a new event
 * @route POST /api/admin/event
 * @access Public
 */
const addEvent = asyncHandler(async (req, res) => {
	const {
		title,
		start_date: startDate,
		end_date: endDate,
		description,
	} = req.body;
	// Check for product image in the request
	const eventImgPath = req.files?.eventImg?.[0]?.path;

	// Validate required fields
	if (
		[title, startDate, endDate, description].some(
			(field) => typeof field === "string" && field.trim() === ""
		)
	) {
		return res.status(400).json(400, {}, "All fields are required");
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
	const event = await Events.create({
		title,
		startDate,
		endDate,
		description,
		eventImg: eventImgObj.url,
	});
	const addedEvent = await Events.findById(event._id).select();

	// Return success response with the added event
	return res
		.status(200)
		.json(new ApiResponse(200, addedEvent, "Event added successfully"));
});

// Controller to update Events Data
const updateEvent = asyncHandler(async (req, res) => {
	const {
		event_id: eventId,
		title,
		start_date: startDate,
		end_date: endDate,
		description,
	} = req.body;
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
	const updatedEvent = await Events.findByIdAndUpdate(
		eventId,
		{
			$set: {
				title,
				startDate,
				endDate,
				description,
				eventImg: eventImgObj.url,
			},
		},
		{ new: true }
	).select();

	// Return success response
	return res
		.status(200)
		.json(
			new ApiResponse(200, updatedEvent, "Event Details updated successfully")
		);
});

const deleteEventRecord = asyncHandler(async (req, res) => {
	const { event_id: eventId } = req.body; // Get the ID from the request body

	// Validate if ID is provided
	if (!eventId) {
		return res
			.status(400)
			.json(new ApiResponse(400, {}, "Event ID is required"));
	}

	// Find the event by ID and delete it
	const deletedEvent = await Events.findByIdAndDelete(eventId);

	// If the event is not found
	if (!deletedEvent) {
		return res.status(404).json(new ApiResponse(404, {}, "Event not found"));
	}

	// Return success response
	return res
		.status(200)
		.json(new ApiResponse(200, deletedEvent, "Event deleted successfully"));
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
		return res
			.status(200)
			.json(new ApiResponse(401, {}, "Something went wrong"));
	}

	// Return success response with all products
	return res
		.status(200)
		.json(new ApiResponse(200, allProducts, "Data fetched successfully"));
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
		return res
			.status(200)
			.json(
				new ApiResponse(
					401,
					{},
					"Something went wrong while getting user records"
				)
			);
	}

	// Return success response with all event records
	return res
		.status(200)
		.json(new ApiResponse(200, userEventsRecords, "Data fetched successfully"));
});

const uploadSliderImage = asyncHandler(async (req, res) => {
	const sliderImgPath = req.files?.sliderImg?.[0]?.path;
	//   console.log("sliderImgPath", sliderImgPath);

	// Validate that an image has been uploaded
	if (!sliderImgPath) {
		throw new ApiError(400, "Slider Image is required");
	}

	// Upload slider image to Cloudinary (or your preferred image service)
	const sliderImgObj = await uploadOnCloudinary(sliderImgPath);

	if (!sliderImgObj) {
		throw new ApiError(400, "Slider file is required");
	}

	// Optionally store the image URL in a database if required
	const slider = await Slider.create({ sliderImg: sliderImgObj.url });

	// Return success response with the uploaded image details
	return res
		.status(200)
		.json(new ApiResponse(200, slider, "Slider image uploaded successfully"));
});

const updateSliderImage = asyncHandler(async (req, res) => {
	const { id } = req.body; // Get slider ID from request body

	// Ensure the slider ID is provided
	if (!id) {
		throw new ApiError(400, "Slider ID is required");
	}

	// Check for the new slider image in the request
	const sliderImgPath = req.files?.sliderImg?.[0]?.path;
	console.log("sliderImgPath", sliderImgPath);

	// Validate that a new image has been uploaded
	if (!sliderImgPath) {
		throw new ApiError(400, "Slider Image is required for update");
	}

	// Upload new slider image to Cloudinary
	const sliderImgObj = await uploadOnCloudinary(sliderImgPath);

	if (!sliderImgObj) {
		throw new ApiError(400, "Slider file upload failed");
	}

	// Find and update the slider image URL in the database
	const updatedSlider = await Slider.findByIdAndUpdate(
		id,
		{ sliderImg: sliderImgObj.url },
		{ new: true } // Return the updated document
	);

	if (!updatedSlider) {
		throw new ApiError(404, "Slider image not found");
	}

	// Return success response with the updated slider details
	return res
		.status(200)
		.json(
			new ApiResponse(200, updatedSlider, "Slider image updated successfully")
		);
});

const getSliderImages = asyncHandler(async (req, res) => {
	const sliderImages = await Slider.find().select("sliderImg");

	// Return all slider images
	return res
		.status(200)
		.json(
			new ApiResponse(200, sliderImages, "Slider images retrieved successfully")
		);
});

const deleteSliderImage = asyncHandler(async (req, res) => {
	const { id } = req.body; // Taking ID from the request body

	// Check if ID is provided
	if (!id) {
		throw new ApiError(400, "Slider ID is required");
	}

	// Find and delete the slider image from the database
	const deletedSlider = await Slider.findByIdAndDelete(id);

	if (!deletedSlider) {
		throw new ApiError(404, "Slider image not found");
	}

	// Return success response
	return res
		.status(200)
		.json(new ApiResponse(200, {}, "Slider image deleted successfully"));
});

// Add Plan
const addPlan = asyncHandler(async (req, res) => {
	const { title, commission, price, grabNo, shareCount } = req.body;
	const imagePath = req.files?.planImg?.[0]?.path;

	if (!title || !commission || !price || !grabNo || !shareCount) {
		throw new ApiError(400, "All fields are required");
	}

	if (!imagePath) {
		throw new ApiError(400, "Image is required");
	}

	// Upload image to Cloudinary
	const imageObj = await uploadOnCloudinary(imagePath);
	if (!imageObj.url) {
		throw new ApiError(400, "Error while uploading image");
	}

	const plan = await Plan.create({
		title,
		commission,
		price,
		grabNo,
		shareCount,
		planImg: imageObj.url,
	});

	return res
		.status(200)
		.json(new ApiResponse(200, plan, "Plan added successfully"));
});

// Update Plan
const updatePlan = asyncHandler(async (req, res) => {
	const {
		plan_id: planId,
		title,
		commission,
		price,
		grabNo,
		shareCount,
	} = req.body;
	const imagePath = req.files?.planImg?.[0]?.path;

	if (!planId) {
		throw new ApiError(400, "Plan ID is required");
	}

	if (!title || !commission || !price || !grabNo || !shareCount) {
		throw new ApiError(400, "All fields are required");
	}

	const plan = await Plan.findById(planId);
	if (!plan) {
		throw new ApiError(404, "Plan not found");
	}

	// Upload new image if provided
	if (imagePath) {
		const imageObj = await uploadOnCloudinary(imagePath);
		if (!imageObj.url) {
			throw new ApiError(400, "Error while uploading image");
		}
		plan.planImg = imageObj.url;
	}

	// Update the rest of the fields
	plan.title = title;
	plan.commission = commission;
	plan.price = price;
	plan.grabNo = grabNo;
	plan.shareCount = shareCount;

	await plan.save();

	return res
		.status(200)
		.json(new ApiResponse(200, plan, "Plan updated successfully"));
});

// Delete Plan
const deletePlan = asyncHandler(async (req, res) => {
	const { plan_id: planId } = req.body;

	if (!planId) {
		throw new ApiError(400, "Plan ID is required");
	}

	const plan = await Plan.findByIdAndDelete(planId);
	if (!plan) {
		throw new ApiError(404, "Plan not found");
	}

	return res
		.status(200)
		.json(new ApiResponse(200, plan, "Plan deleted successfully"));
});

// Get All Plans
const getPlans = asyncHandler(async (req, res) => {
	const plans = await Plan.find();

	if (!plans) {
		throw new ApiError(404, "No plans found");
	}

	return res
		.status(200)
		.json(new ApiResponse(200, plans, "Plans fetched successfully"));
});

// Send message as admin
const sendAdminMessage = asyncHandler(async (req, res) => {
	const { content } = req.body;
	const senderId = req.params.id; // Admin ID passed in route

	// Handling image upload
	const imageMesg = req.files?.chatImg?.[0]?.path;
	//   let imageUrl = "";
	let imageObj = {};
	if (imageMesg) {
		imageObj = await uploadOnCloudinary(imageMesg);
	}

	const message = await Message.create({
		content,
		chatImg: imageObj.url || null,
		sender: senderId,
		isAdmin: true,
	});

	const addedMessage = await Message.findById(message._id).select();
	return res
		.status(200)
		.json(new ApiResponse(200, addedMessage, "Message sent successfully"));
});

// Get messages for the admin
const getAdminMessages = asyncHandler(async (req, res) => {
	const userId = req.params.id; // Get the user ID from the params
	const messages = await Message.find({
		$or: [
			{ sender: userId, isAdmin: false }, // User messages
			{ sender: req.user.id, isAdmin: true }, // Admin messages
		],
	});

	return res.status(200).json(messages);
});

// Delete admin message
const deleteAdminMessage = asyncHandler(async (req, res) => {
	const { messageId } = req.body;

	await Message.findByIdAndDelete(messageId);

	return res.status(200).json({ message: "Message deleted successfully" });
});

//all user withdrawal request
const getAllUserWithdrawalsForAdmin = asyncHandler(async (req, res) => {
	try {
		// Fetch all withdrawal requests from the database
		const withdrawals = await withdrawalRequestAmount.find();

		// Check if there are any withdrawal requests
		if (!withdrawals || withdrawals.length === 0) {
			return res
				.status(404)
				.json(new ApiResponse(404, [], "No withdrawal requests found"));
		}

		// Send success response with the list of withdrawal requests
		return res
			.status(200)
			.json(
				new ApiResponse(
					200,
					withdrawals,
					"Withdrawal requests retrieved successfully"
				)
			);
	} catch (error) {
		// Handle errors
		return res.status(500).json(new ApiResponse(500, null, "Server error"));
	}
});

const updateWithdrawalStatusByAdmin = asyncHandler(async (req, res) => {
	const { id, status } = req.body; // Get the withdrawal request ID and status from the request body

	// Validate fields
	if (!id) {
		throw new ApiError(400, "Withdrawal request ID is required");
	}
	if (!status) {
		throw new ApiError(400, "Status is required");
	}

	// Only allow 'Rejected' or 'Cancelled by Admin' status for admin
	if (status !== "Approved" && status !== "Cancelled by Admin") {
		throw new ApiError(
			400,
			'Invalid status value. Status must be either "Rejected" or "Cancelled by Admin"'
		);
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
			new ApiResponse(
				200,
				withdrawalRequest,
				`Withdrawal request ${status} successfully`
			)
		);
});

//add country code
const addCountry = asyncHandler(async (req, res) => {
	const { countryName, countryCode } = req.body;

	// Validate required fields
	if (!countryName || !countryCode) {
		return res
			.status(400)
			.json({ message: "Both countryName and countryCode are required" });
	}

	// Check if country code already exists
	const existingCountry = await Country.findOne({ countryCode });
	if (existingCountry) {
		return res
			.status(400)
			.json({ message: "Country with this code already exists" });
	}

	// Create new country
	const country = await Country.create({ countryName, countryCode });
	return res
		.status(201)
		.json({ message: "Country added successfully", country });
});

//get  country code
const getCountries = asyncHandler(async (req, res) => {
	const countries = await Country.find();
	if (!countries.length) {
		return res.status(404).json({ message: "No countries found" });
	}

	return res.status(200).json({ countries });
});

//update country code
const updateCountry = asyncHandler(async (req, res) => {
	const { countryId, countryName, countryCode } = req.body;

	if (!countryId) {
		return res.status(400).json({ message: "Country ID is required" });
	}

	// Find country by ID and update
	const updatedCountry = await Country.findByIdAndUpdate(
		countryId,
		{ countryName, countryCode },
		{ new: true }
	);

	if (!updatedCountry) {
		return res.status(404).json({ message: "Country not found" });
	}

	return res
		.status(200)
		.json({ message: "Country updated successfully", updatedCountry });
});

//delete country code
const deleteCountry = asyncHandler(async (req, res) => {
	const { countryId } = req.body;

	if (!countryId) {
		return res.status(400).json({ message: "Country ID is required" });
	}

	// Find and delete country
	const deletedCountry = await Country.findByIdAndDelete(countryId);

	if (!deletedCountry) {
		return res.status(404).json({ message: "Country not found" });
	}

	return res
		.status(200)
		.json({ message: "Country deleted successfully", deletedCountry });
});

const getUserRecords = asyncHandler(async (req, res) => {
	try {
		// Fetch all user records from the database
		const userRecords = await User.find();

		// Check if there are no user records fetched
		if (!userRecords || userRecords.length === 0) {
			return res
				.status(200)
				.json(
					new ApiResponse(
						401,
						{},
						"Something went wrong while getting user records"
					)
				);
		}

		// For each user, fetch the wallet balance
		const userRecordsWithBalance = await Promise.all(
			userRecords.map(async (user) => {
				const wallet = await Wallet.findOne({ userId: user._id }).select(
					"walletAmount"
				);
				return {
					...user.toObject(), // Convert mongoose object to plain JS object
					walletBalance: wallet ? wallet.walletAmount : 0, // Add wallet balance
				};
			})
		);

		// Return success response with user records and wallet balance
		return res
			.status(200)
			.json(
				new ApiResponse(
					200,
					userRecordsWithBalance,
					"Data fetched successfully"
				)
			);
	} catch (error) {
		console.error("Error fetching user records:", error.message);
		throw new ApiError(400, error.message || "Something went wrong");
	}
});

//delete country code
const deleteProduct = asyncHandler(async (req, res) => {
	const { product_id } = req.body;

	if (!product_id) {
		return res.status(400).json({ message: "Product ID is required" });
	}

	// Find and delete country
	const deleteProduct = await Product.findByIdAndDelete(product_id);

	if (!deleteProduct) {
		return res.status(404).json({ message: "Product not found" });
	}

	return res
		.status(200)
		.json({ message: "Product deleted successfully", deleteProduct });
});

const updateProduct = asyncHandler(async (req, res) => {
	const { product_id: productId } = req.body; // Get product ID from the request body

	const {
		product_name: productName,
		ratio_between: ratioBetween,
		price,
		plan_id: planId,
		plan_name: planName,
	} = req.body;

	// Check if productId is provided
	if (!productId) {
		return res
			.status(400)
			.json(new ApiResponse(400, {}, "Product ID is required"));
	}

	// Find the product by ID in the database
	const product = await Product.findById(productId);

	if (!product) {
		return res.status(404).json(new ApiResponse(404, {}, "Product not found"));
	}

	// Check if a new product image is provided in the request
	let productImgUrl = product.productImg; // Keep the existing image URL by default
	const productImgPath = req.files?.productImg?.[0]?.path;

	if (productImgPath) {
		// Upload the new image to Cloudinary if provided
		const productImgObj = await uploadOnCloudinary(productImgPath);
		if (!productImgObj) {
			throw new ApiError(400, "Failed to upload product image");
		}
		productImgUrl = productImgObj.url; // Update the image URL if a new image is uploaded
	}

	// Update the product fields
	product.productName = productName;
	product.ratioBetween = ratioBetween;
	product.price = price;
	product.planId = planId;
	product.planName = planName;
	product.productImg = productImgUrl;

	// Save the updated product to the database
	await product.save();

	// Return the updated product in the response
	return res
		.status(200)
		.json(new ApiResponse(200, product, "Product updated successfully"));
});

const deleteUserById = asyncHandler(async (req, res) => {
	try {
		const { userId } = req.params; // Get user ID from route parameters

		// Check if the user exists
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json(new ApiResponse(404, {}, "User not found"));
		}

		// Delete the user from the database
		await User.findByIdAndDelete(userId);

		// Optionally, you can also delete the user's wallet or any related data
		await Wallet.findOneAndDelete({ userId });

		// If there are transactions related to the user, you can delete them as well
		await WalletTransaction.deleteMany({ userId });

		return res
			.status(200)
			.json(new ApiResponse(200, {}, "User deleted successfully"));
	} catch (error) {
		console.error("Error deleting user:", error.message);
		throw new ApiError(400, error.message || "Something went wrong");
	}
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
	registerAdmin,
	updateProduct,
	deleteProduct,
	uploadSliderImage,
	getSliderImages,
	updateSliderImage,
	deleteSliderImage,
	addPlan,
	updatePlan,
	deletePlan,
	getPlans,
	getAllUserWithdrawalsForAdmin,
	updateWithdrawalStatusByAdmin,
	addCountry,
	getCountries,
	updateCountry,
	deleteCountry,
	sendAdminMessage,
	getAdminMessages,
	deleteAdminMessage,
	deleteUserById,
};

// const getUserRecords = asyncHandler(async (req, res) => {
//   // Fetch all user records from the database
//   const userRecords = await User.find();

//   // Check if there are no user records fetched
//   if (!userRecords) {
//     return res
//       .status(200)
//       .json(
//         new ApiResponse(
//           401,
//           {},
//           "Something went wrong while getting user records"
//         )
//       );
//   }

//   // Return success response with all user records
//   return res
//     .status(200)
//     .json(new ApiResponse(200, userRecords, "Data fetched successfully"));
// });
