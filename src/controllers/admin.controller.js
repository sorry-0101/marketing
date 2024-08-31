import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const getHomeData=asyncHandler(async(req,res)=>{

    const {user_id:userId} = req.params;
    return res.status(201).json(
        new ApiResponse(200, userId,'admin api successfully fetched')
    );

});

export {
    getHomeData
}