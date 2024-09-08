import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Admin, Events } from '../models/admin.model.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const createResponse = new ApiResponse();

const getHomeData = asyncHandler(async (req, res) => {
	const { user_id: userId } = req.params;
	return createResponse.success(res, userId, 'Admin API successfully fetched');
});

const addProduct = asyncHandler(async (req, res) => {
	const { product_name: productName, level, ratio_between: ratioBetween, price } = req.body;

	if ([productName, level, ratioBetween].some((field) => typeof field === 'string' && field.trim() === "")) {
		return res.status(400).json(400, {}, 'All fields are required');
	}

	const productImgPath = req.files?.productImg?.[0]?.path;

	if (!productImgPath) {
		throw new ApiError(400, "Product Image is required")
	}

	const productImgObj = await uploadOnCloudinary(productImgPath)

	if (!productImgObj) {
		throw new ApiError(400, "Avatar file is required")
	}


	const product = await Admin.create({ productName, level, ratioBetween, price, productImg: productImgObj.url });
	const addedProduct = await Admin.findById(product._id).select();

	return res.status(200).json(
		new ApiResponse(200, addedProduct, 'Product added successfully')
	);
});

const addEvent = asyncHandler(async (req, res) => {
	const { title, start_date: startDate, end_date: endDate, description } = req.body;

	if ([title, startDate, endDate, description].some((field) => typeof field === 'string' && field.trim() === "")) {
		return res.status(400).json(400, {}, 'All fields are required');
	}

	const event = await Events.create({ title, startDate, endDate, description });
	const addedEvent = await Events.findById(event._id).select();

	return res.status(200).json(
		new ApiResponse(200, addedEvent, 'Event added successfully')
	);
});

const getAllProduct = asyncHandler(async (req, res) => {

	const allProducts = await Admin.find();

	if (!allProducts) {
		return res
			.status(200)
			.json(
				new ApiResponse(401, {}, "Something went wrong")
			);
	}

	return res
		.status(200)
		.json(
			new ApiResponse(200, allProducts, "Data fetched successfully")
		);
});

const getEventRecords = asyncHandler(async (req, res) => {

	const userEventsRecords = await Events.find();

	if (!userEventsRecords) {
		return res
			.status(200)
			.json(
				new ApiResponse(401, {}, "Something went wrong while getting user records")
			);
	}

	return res
		.status(200)
		.json(
			new ApiResponse(200, userEventsRecords, "Data fetched successfully")
		);
});

const getUserRecords = asyncHandler(async (req, res) => {

	const userRecords = await User.find();

	if (!userRecords) {
		return res
			.status(200)
			.json(
				new ApiResponse(401, {}, "Something went wrong while getting user records")
			);
	}

	return res
		.status(200)
		.json(
			new ApiResponse(200, userRecords, "Data fetched successfully")
		);
});

export {
	getHomeData,
	addProduct,
	getAllProduct,
	getUserRecords,
	addEvent,
	getEventRecords
};
