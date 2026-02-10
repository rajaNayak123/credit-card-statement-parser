import User from "../models/User.js";
import { generateToken, generateRefreshToken } from "../services/jwt.js";

/**
 * Signup - Create new user
 * POST /api/auth/signup
 */
export const signup = async (req, res, next) => {
  try {
    const { name, email, password, dob } = req.body;

    // Validate required fields
    if (!name || !email || !password || !dob) {
      return res.status(400).json({
        success: false,
        error: "Please provide name, email, password, and date of birth",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User with this email already exists",
      });
    }

    // Validate DOB format (basic check)
    const dobRegex =
      /^(\d{2}[-/]\d{2}[-/]\d{4}|\d{2}[-/]\d{2}|\d{4}[-/]\d{2}[-/]\d{2}|\d{4})$/;
    if (!dobRegex.test(dob)) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid date of birth format. Use dd-mm-yyyy, dd-mm, or similar",
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      dob,
    });

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    console.log(`✅ New user registered: ${user.email} (DOB: ${user.dob})`);

    // Set JWT in httpOnly cookie so browser sends it with credentials: 'include'
    const cookieMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: cookieMaxAge,
      path: "/",
    });

    // Return user data and token
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          dob: user.dob,
          createdAt: user.createdAt,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: messages.join(", "),
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "User with this email already exists",
      });
    }

    next(error);
  }
};

/**
 * Signin - Login user
 * POST /api/auth/signin
 */
export const signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide email and password",
      });
    }

    // Find user and include password
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: "Your account has been deactivated. Please contact support.",
      });
    }

    // Compare password
    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    console.log(`✅ User logged in: ${user.email}`);

    // Set JWT in httpOnly cookie so browser sends it with credentials: 'include'
    const cookieMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: cookieMaxAge,
      path: "/",
    });

    // Return user data and token
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          dob: user.dob,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    next(error);
  }
};

/**
 * Get current user
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    // req.user is set by requireAuth middleware
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * PUT /api/auth/me
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { name, dob } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (dob) updateData.dob = dob;

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password
 * PUT /api/auth/change-password
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Please provide current password and new password",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 6 characters",
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select("+password");

    // Verify current password
    const isPasswordCorrect = await user.comparePassword(currentPassword);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    console.log(`✅ Password changed for user: ${user.email}`);

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout (client-side token removal)
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    console.log(`✅ User logged out: ${req.user.email}`);

    res.clearCookie("token", { path: "/" });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};
