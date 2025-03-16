const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware"); // Import the middleware

const router = express.Router(); 

// Login User
router.post("/login", async (req, res) => {
  let { email, password } = req.body;

  try {
    console.log("Login request received:", req.body); 

    // Trim input to prevent accidental spaces
    email = email.trim();

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found:", email);
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Debugging logs
    console.log("Stored user object from DB:", user);
    console.log("Entered password:", password);
    console.log("Stored hashed password:", user.password);

    // Ensure password comparison is working
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match result:", isMatch);

    if (!isMatch) {
      console.log("Password does not match for:", email);
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate JWT with explicit algorithm
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h", algorithm: "HS256" }
    );

    console.log("Login successful for:", email);
    res.status(200).json({ message: "Login successful", token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

// ✅ Protected Route
router.get("/protected", authMiddleware, (req, res) => {
    res.json({ message: "You have accessed a protected route!", user: req.user });
});

module.exports = router;
