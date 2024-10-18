"use strict";
import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

// Schema definition for the Product collection (representing products)
const ProductsSchema = new Schema(
  {
    // Product name field, required, indexed for faster search, and trimmed to remove extra spaces
    productName: {
      type: String,
      require: true,
      index: true,
      trim: true,
    },
    // Level of the product, required and trimmed
    level: {
      type: String,
      require: true,
      trim: true,
    },
    // Ratio between two things (specific to business logic), required and trimmed
    ratioBetween: {
      type: String,
      require: true,
      trim: true,
    },
    // Price of the product, must be a number, required, and trimmed
    price: {
      type: Number,
      require: true,
      trim: true,
    },
    // Product image URL (e.g., Cloudinary URL), stored as a string
    productImg: {
      type: String,
    },
  },
  {
    // Automatically add createdAt and updatedAt fields
    timestamps: true,
  }
);

// Schema definition for the Events collection
const EventSchema = new Schema(
  {
    // Title of the event, required, indexed for faster search, and trimmed
    title: {
      type: String,
      require: true,
      index: true,
      trim: true,
    },
    // Start date of the event, required and trimmed
    startDate: {
      type: String,
      require: true,
      trim: true,
    },
    // End date of the event, required and trimmed
    endDate: {
      type: String,
      require: true,
      trim: true,
    },
    // Description of the event, required and trimmed
    description: {
      type: String,
      require: true,
      trim: true,
    },
    // event image URL (e.g., Cloudinary URL), stored as a string
    eventImg: {
      type: String,
    },
  },
  {
    // Automatically add createdAt and updatedAt fields
    timestamps: true,
  }
);

// Define the schema for the User model
const adminSchema = new Schema(
  {
    // Username field: must be unique, lowercase, and indexed for faster searches
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Email field: must be unique, lowercase, and trimmed
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Mobile number is required
    mobileNo: {
      type: Number,
      required: true,
      unique: true,
      trim: true,
    },
    // Password field: required and needs validation message when missing
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    IsAdmin: {
      type: Boolean,
      require: true,
    },
    // Field for storing the refresh token (used for authentication)
    refreshTokenAdmin: {
      type: String,
    },
    // Avatar URL (e.g., from Cloudinary) to store the user's profile picture
    adminImg: {
      type: String,
    },
  },
  {
    // Automatically add timestamps (createdAt and updatedAt) to the model
    timestamps: true,
  }
);

// Pre-save middleware to hash the user's password before saving it to the database
adminSchema.pre("save", async function (next) {
  // If the password is not modified, skip hashing and proceed
  if (!this.isModified("password")) return next();

  // Hash the password with bcrypt and a salt of 10 rounds
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to check if the provided password matches the stored hashed password
adminSchema.methods.isPasswordCorrect = async function (password) {
  // Compare the input password with the hashed password
  return await bcrypt.compare(password, this.password);
};

// Method to generate a JWT access token for the user
adminSchema.methods.generateAccessToken = function () {
  // Sign a JWT with the user's basic information and secret key, with an expiration time
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET, // Secret key for signing the access token
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY, // Access token expiry duration (from environment variable)
    }
  );
};

// Method to generate a JWT refresh token for the user
adminSchema.methods.generateRefreshToken = function () {
  // Sign a refresh token with the user's ID and a separate secret key, with an expiration time
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET, // Secret key for signing the refresh token
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY, // Refresh token expiry duration (from environment variable)
    }
  );
};

// / Schema definition for the Events collection
const SliderScheme = new Schema(
  {
    sliderImg: {
      type: String,
    },
  },
  {
    // Automatically add createdAt and updatedAt fields
    timestamps: true,
  }
);

const PlanSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    commission: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    planImg: {
      type: String,
      required: true,
    },
    grabNo: {
      type: String,
      required: true,
    },
    shareCount: {
      type: String,
      required: true,
    },
    shareLimit: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

const countrySchema = new mongoose.Schema(
  {
    countryName: {
      type: String,
      required: true,
    },
    countryCode: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

// Export the User model, which will be used to interact with the 'users' collection in MongoDB
export const AdminLogin = mongoose.model("Admin", adminSchema);
// Create and export the Product model for the Products collection
export const Product = mongoose.model("Products", ProductsSchema);

// Create and export the Events model for the Events collection
export const Events = mongoose.model("Events", EventSchema);
export const Slider = mongoose.model("Slider", SliderScheme);
export const Plan = mongoose.model("Plan", PlanSchema);
export const Country = mongoose.model("Country", countrySchema);
