const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for test uploads
const testStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'test-' + uniqueSuffix + ext);
  }
});

const testUpload = multer({ 
  storage: testStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// ✅ Register User
router.post("/register", async (req, res) => {
  let { username, email, password } = req.body;

  try {
    console.log("📩 Signup request received");
    console.log("📋 Request body:", { username, email, passwordLength: password ? password.length : 0 });

    // Validate input
    if (!username || !email || !password) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ message: "Username, email, and password are required" });
    }

    username = username.trim();
    email = email.trim().toLowerCase();

    console.log("🔍 Checking if email already exists:", email);
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      console.log("❌ Email already registered:", email);
      return res.status(400).json({ message: "Email already registered" });
    }

    console.log("🔍 Checking if username already exists:", username);
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      console.log("❌ Username already taken:", username);
      return res.status(400).json({ message: "Username already taken" });
    }

    // Hash password manually
    console.log("🔒 Hashing password");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log("✅ Password hashed successfully");

    // Create new user directly with the hashed password
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    // Disable the pre-save hook by passing validate: false option
    console.log("💾 Saving new user to database");
    await newUser.save({ validateBeforeSave: false });
    console.log("✅ User registered successfully");

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("🚨 Signup error details:", err);
    
    // Check for specific error types
    if (err.name === 'ValidationError') {
      console.error("❌ Validation error:", err.message);
      return res.status(400).json({ message: "Validation error", error: err.message });
    }
    
    if (err.code === 11000) {
      console.error("❌ Duplicate key error:", err.message);
      return res.status(400).json({ message: "Username or email already exists" });
    }
    
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

// ✅ Login User - Completely rewritten with direct bcrypt comparison
router.post("/login", async (req, res) => {
  let { email, password } = req.body;

  try {
    console.log("📩 Login request received");

    if (!email || !password) {
      console.log("❌ Missing email or password");
      return res.status(400).json({ message: "Email and password are required" });
    }

    email = email.trim().toLowerCase();
    console.log("🔍 Looking for user with email:", email);

    // Find user without using methods
    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found with email:", email);
      return res.status(400).json({ message: "Invalid email or password" });
    }

    console.log("✅ User found:", user.username);
    
    // Direct comparison using bcrypt
    try {
      const isMatch = await bcrypt.compare(password, user.password);
      console.log("🔍 Password match result:", isMatch);
  
      if (!isMatch) {
        console.log("❌ Password does not match for:", email);
        return res.status(400).json({ message: "Invalid email or password" });
      }
    } catch (compareError) {
      console.error("🚨 Error comparing passwords:", compareError);
      return res.status(500).json({ message: "Error verifying credentials" });
    }

    // Generate JWT securely
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret_key_for_development',
      { expiresIn: "24h" }
    );

    console.log("✅ Login successful for:", email);
    res.status(200).json({ 
      message: "Login successful", 
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error("🚨 Login error:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

// Reset user password (development tool)
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required" });
    }
    
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update the user's password
    user.password = hashedPassword;
    await user.save();
    
    console.log("✅ Password reset successful for:", email);
    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("🚨 Password reset error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// ✅ Protected Route
router.get("/protected", authMiddleware, (req, res) => {
  res.json({ message: "🔒 You have accessed a protected route!", user: req.user });
});

// ✅ Test User Registration for Debugging
router.post("/create-test-user", async (req, res) => {
  try {
    console.log("📩 Creating test user");
    
    // Create a new user with fixed credentials
    const email = "testuser@example.com";
    const username = "TestUser";
    const password = "Test123!";
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Delete existing user to recreate
      await User.deleteOne({ email });
      console.log("🗑️ Deleted existing test user");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log("🔒 Hashed password:", hashedPassword);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    console.log("✅ Test user created successfully:", {
      email,
      password: "Test123!",
      hashedPassword
    });

    // Generate token for immediate login
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({ 
      message: "Test user created successfully", 
      credentials: {
        email,
        password
      },
      token
    });
  } catch (err) {
    console.error("🚨 Test user creation error:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

// ✅ Direct Login for Testing (No Password Verification)
router.post("/direct-login", async (req, res) => {
  let { email } = req.body;

  try {
    console.log("📩 Direct login request received for:", email);

    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found with email:", email);
      return res.status(400).json({ message: "User not found" });
    }

    // Generate JWT securely
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    console.log("✅ Direct login successful for:", email);
    res.status(200).json({ 
      message: "Login successful", 
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email
      } 
    });
  } catch (err) {
    console.error("🚨 Direct login error:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

// Add a test route to check file uploads
router.get('/test-upload', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Test File Upload</title>
      </head>
      <body>
        <h1>Test File Upload</h1>
        <form action="/api/auth/test-upload" method="post" enctype="multipart/form-data">
          <input type="file" name="testPhoto" />
          <button type="submit">Upload</button>
        </form>
      </body>
    </html>
  `);
});

// Handle test upload
router.post('/test-upload', testUpload.single('testPhoto'), (req, res) => {
  try {
    console.log('Test file upload received:', req.file);
    
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    console.log('File URL:', fileUrl);
    
    res.send(`
      <html>
        <head>
          <title>Upload Success</title>
        </head>
        <body>
          <h1>Upload Success!</h1>
          <p>File uploaded to: ${fileUrl}</p>
          <img src="${fileUrl}" style="max-width: 500px" />
          <br>
          <a href="/api/auth/test-upload">Upload another file</a>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Test upload error:', error);
    res.status(500).send('Upload failed');
  }
});

module.exports = router;
