import jwt from "jsonwebtoken"; // Assuming you are using jsonwebtoken
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

// Function to generate access and refresh tokens
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Generate access and refresh tokens
    const accessToken = jwt.sign(
      { id: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    // Save the refresh token to the user document
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Token generation error:", error); // Log the error
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

// User registration handler
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;
  console.log("email: ", email);

  // Validation: Ensure all required fields are present
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // Check if the user already exists by email or username
  const existedUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  // Handle file uploads: Avatar is required, cover image is optional
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  let coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // Upload avatar and cover image to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : null;

  if (!avatar) {
    throw new ApiError(400, "Error uploading avatar");
  }

  // Create the user in the database
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // Select created user and exclude sensitive fields (password, refreshToken)
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

// User login handler
const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }

  // Find the user by email or username
  const user = await User.findOne({ $or: [{ username }, { email }] });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // Validate the password
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Password is incorrect");
  }

  // Generate access and refresh tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  // Fetch the logged-in user details and exclude sensitive fields
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Options for setting cookies (httpOnly for security)
  const options = {
    httpOnly: true,
    secure: true, // Use secure cookies in production (https)
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

// User logout handler
const logoutUser = asyncHandler(async (req, res) => {
  // Remove the refresh token from the user document
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: undefined } },
    { new: true }
  );

  // Clear the access and refresh tokens from cookies
  const options = {
    httpOnly: true,
    secure: true, // Use secure cookies in production
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorised request");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "invalid refresh token");
    }

    if (incomingRefreshToken != user?.refreshToken) {
      throw new ApiError(401, "refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, newrefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newrefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newrefreshToken,
          },
          "Access token refresh succesfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "invalid old password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password change successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(200, req.user, "Current user fetch succesfully");
});

const updateAccountDetails = asyncHandler(async(req,res)=>{
  const {fullName,email} = req.body
  if (!fullName || !email) {
    throw new ApiError(400, "all field are required")
    
  }
  const user = User.findByIdAndUpdate(req.user?._id, {
    $set:{
      fullName,
      email
    }
  },
    {new:true}
   ).select("-password")
   return res
   .status(200)
   .json(new ApiResponse(200,user, "Account detailed update successfully"))
})

const updateUserAvtar = asyncHandler(async(req,res)=>{
 const avatarLocalPath = req.file?.path
 if (!avatarLocalPath) {
  throw new ApiError(400, "avatar file is missing")
  
 }
 const avatar = await uploadOnCloudinary(avatarLocalPath)
if (!avatar.url) {
  throw new ApiError(400, "error while uploading on avtar")
  
  
}
 const user = await User.findByIdAndUpdate(
  req.user?._id,
  {$set:{
    avatar:avatar.url
  }},
  {new:true}
).select("-password")
return res.status(200).json(
  new ApiResponse (200, user, "avatar image update succesfully")
 )
})
const updateUserCoverimage = asyncHandler(async(req,res)=>{
  const coverImageLocalPath = req.file?.path
  if (!coverImageLocalPath) {
   throw new ApiError(400, "cover file is missing")
   
  }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)
 if (!coverImage.url) {
   throw new ApiError(400, "error while uploading on coverImage")
   
   
 }
const user = await User.findByIdAndUpdate(
   req.user?._id,
   {$set:{
    coverImage:coverImage.url
   }},
   {new:true}
 ).select("-password")
 return res.status(200).json(
  new ApiResponse (200, user, "cover image update succesfully")
 )
 })
export {
  changeCurrentPassword,
  getCurrentUser, loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser, updateAccountDetails, updateUserAvtar, updateUserCoverimage
};

