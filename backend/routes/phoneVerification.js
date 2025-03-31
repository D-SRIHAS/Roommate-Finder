const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, resendOTP } = require('../controllers/phoneVerificationController');
const auth = require('../middleware/authenticate');

// Send OTP
router.post('/send-otp', auth, sendOTP);

// Verify OTP
router.post('/verify-otp', auth, verifyOTP);

// Resend OTP
router.post('/resend-otp', auth, resendOTP);

module.exports = router; 