const express = require("express");
const { authenticateJWT } = require("../middleware/auth");

const router = express.Router();

// ✅ Protected Route
router.get("/", authenticateJWT, (req, res) => {
  try {
    res.json({ message: "🔒 You have accessed a protected route!", user: req.user });
  } catch (error) {
    console.error("🚨 Protected Route Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
