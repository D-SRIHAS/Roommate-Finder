const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Protected Route
router.get("/", authMiddleware, (req, res) => {
    res.json({ message: "You have accessed a protected route!", user: req.user });
});

module.exports = router;
