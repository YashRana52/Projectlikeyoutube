import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "").trim();

    // Log token retrieval for debugging
    console.log("Token retrieved:", token);

    if (!token) {
      throw new ApiError(401, "Unauthorized request: No token provided");
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      console.log("Decoded Token:", decodedToken); // Log decoded token
    } catch (err) {
      // Specific error handling for token verification
      console.error("Token verification failed:", err);
      throw new ApiError(401, "Invalid access token");
    }

    const user = await User.findById(decodedToken.id).select("-password -refreshToken");

    if (!user) {
      throw new ApiError(401, "Invalid access token: User not found");
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error); // Log the error for debugging
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});
