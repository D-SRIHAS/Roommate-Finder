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

    username = username.trim();
    email = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "❌ Email already registered" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    console.log("✅ User registered successfully");

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("🚨 Signup error:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

// ✅ Login User
router.post("/login", async (req, res) => {
  let { email, password } = req.body;

  try {
    console.log("📩 Login request received");

    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found with email:", email);
      return res.status(400).json({ message: "Invalid email or password" });
    }

    console.log("🔑 Attempting password comparison...");
    console.log("Email:", email);
    console.log("Password provided:", password);
    
    // Direct comparison for testing purposes
    const plainPassword = "Test123!";
    const result = await bcrypt.compare(plainPassword, user.password);
    console.log("Test comparison with 'Test123!':", result);
    
    const isMatch = await user.comparePassword(password);
    console.log("🔍 Password match result:", isMatch);

    if (!isMatch) {
      console.log("❌ Password does not match for:", email);
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate JWT securely
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    console.log("✅ Login successful for:", email);
    res.status(200).json({ message: "Login successful", token });
  } catch (err) {
    console.error("🚨 Login error:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
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
