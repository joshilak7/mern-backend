const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const nodemailer = require("nodemailer");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// @route   POST /api/auth/register
// @desc    Register user
router.post(
  "/register",
  [
    body("name").not().isEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Please include a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
      // Check if user exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      // Create user
      user = await User.create({
        name,
        email,
        password,
      });

      // Generate verification token
      const verificationToken = crypto.randomBytes(20).toString("hex");
      user.verificationToken = verificationToken;
      user.verificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      await user.save();

      // Send verification email (optional)
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Email Verification",
        html: `<p>Please click the following link to verify your email: <a href="${verificationUrl}">${verificationUrl}</a></p>`,
      };

      await transporter.sendMail(mailOptions);

      // Generate token
      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please include a valid email"),
    body("password").exists().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Check for user
      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Check password
      const isMatch = await user.matchPassword(password);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Generate token
      const token = generateToken(user._id);

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// @route   POST /api/auth/forgot-password
// @desc    Forgot password
router.post(
  "/forgot-password",
  body("email").isEmail().withMessage("Please include a valid email"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;

    try {
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(20).toString("hex");

      // Hash token and set to resetPasswordToken field
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

      await user.save();

      // Create reset URL
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password Reset Request",
        html: `<p>You requested a password reset. Please click the following link to reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`,
      };

      await transporter.sendMail(mailOptions);

      res.json({
        success: true,
        message: "Email sent",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current user
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
