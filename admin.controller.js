import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Admin } from '../models/admin.model.js';

const getHomeData = asyncHandler(async(req,res)=>{

    const {user_id:userId} = req.params;
    return res.status(201).json(
        new ApiResponse(200, userId,'admin api successfully fetched')
    );
});

const addProduct = asyncHandler(async (req, res) => {

    const {product_name:productName, level:level, ratio_between:ratioBetween, price:price} = req.body;
  
    if (
        [productName, level, ratioBetween].some((field) => field?.trim() === "")
      ) {
          throw new ApiError(400, 'All fields are required');
      }

    const product = await Admin.create({
        productName,
        level,
        ratioBetween,
        price
    });

    const addedProduct = await Admin.findById(product._id).select();

    return res.status(201).json(
        new ApiResponse(200, addedProduct, 'Product added successfully' )
    )

});

export {
    getHomeData,
    addProduct
}