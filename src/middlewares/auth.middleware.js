"use strict";

import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { AdminLogin } from "../models/admin.model.js"; // Assuming you have an Admin model

// Middleware to verify JWT for protected routes (both user and admin)
export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    // Retrieve token for user or admin from cookies or Authorization header (Bearer token)
    const userToken =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");
    const adminToken =
      req.cookies?.accessTokenAdmin ||
      req.header("Authorization")?.replace("Bearer ", "");

    let decodedToken;
    let userOrAdmin = null;

    // Check if user token exists, else check for admin token
    if (userToken) {
      // Verify the user token using user secret key
      decodedToken = jwt.verify(userToken, process.env.ACCESS_TOKEN_SECRET);

      // Find the user by ID from the decoded token
      userOrAdmin = await User.findById(decodedToken?._id).select(
        "-password -refreshToken"
      );
      //   TODO: need to look into this make seprate toke for admin in future
      if (!userOrAdmin) {
        // Find the admin by ID from the decoded token
        decodedToken = jwt.verify(adminToken, process.env.ACCESS_TOKEN_SECRET);
        userOrAdmin = await AdminLogin.findById(decodedToken?._id).select(
          "-password -refreshTokenAdmin"
        );
      }

      if (!userOrAdmin) {
        throw new ApiError(401, "Invalid User Access Token");
      }

      // Attach user data to request object
      req.user = userOrAdmin;
    } else if (adminToken) {
      // Verify the admin token using admin secret key
      decodedToken = jwt.verify(adminToken, process.env.ACCESS_TOKEN_SECRE);

      // Find the admin by ID from the decoded token
      userOrAdmin = await AdminLogin.findById(decodedToken?._id).select(
        "-password -refreshTokenAdmin"
      );

      if (!userOrAdmin) {
        throw new ApiError(401, "Invalid Admin Access Token");
      }

      // Attach admin data to request object
      req.admin = userOrAdmin;
    } else {
      // Throw an error if neither user nor admin token is present
      throw new ApiError(401, "Unauthorized request");
    }

    // Proceed to the next middleware or controller
    next();
  } catch (error) {
    // Handle token verification errors
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});
