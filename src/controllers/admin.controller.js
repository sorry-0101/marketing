import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Admin } from '../models/admin.model.js';

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

	const product = await Admin.create({ productName, level, ratioBetween, price });
	const addedProduct = await Admin.findById(product._id).select();

	return res.status(200).json(
		new ApiResponse(200, addedProduct, 'Product added successfully')
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
			new ApiResponse(401, allProducts, "Data fetched successfully")
		);
});


export {
	getHomeData,
	addProduct,
	getAllProduct
};
