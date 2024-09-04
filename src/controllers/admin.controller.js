import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Admin } from '../models/admin.model.js';

const getHomeData = asyncHandler(async (req, res) => {
	const { user_id: userId } = req.params;

	// Use ApiResponse.success for a 200 OK response
	return ApiResponse.success(res, userId, 'Admin API successfully fetched');
});

const addProduct = asyncHandler(async (req, res) => {
	const { product_name: productName, level, ratio_between: ratioBetween, price } = req.body;

	if ([productName, level, ratioBetween].some((field) => typeof field === 'string' && field.trim() === "")) {
		return ApiResponse.badRequest(res, 'All fields are required');
	}

	const product = await Admin.create({ productName, level, ratioBetween, price });
	const addedProduct = await Admin.findById(product._id).select();

	// Use ApiResponse.created for a 201 Created response
	return ApiResponse.created(res, addedProduct, 'Product added successfully');
});

const getAllProduct = asyncHandler(async (req, res) => {
	const { user_id: userId } = req.param;
	//await ApiResponse.validateToken(req, res);
	const allProducts = await Admin.find();

	if (!allProducts) {
		return ApiResponse.badRequest(res, 'Something went wrong');
	}

	// Use ApiResponse.success for a 200 OK response
	return ApiResponse.success(res, allProducts, 'Product data fetched successfully');
});

export {
	getHomeData,
	addProduct,
	getAllProduct
};
