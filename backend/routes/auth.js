const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateJWT } = require('../middleware/authMiddleware');

// Send OTP to user's email
router.post('/send-otp', authController.sendOTP);

// Verify OTP
router.post('/verify-otp', authController.verifyOTP);

// Link verification routes
router.post('/send-verification-email', authController.sendVerificationEmail);
router.post('/verify-email-token', authController.verifyEmailToken);

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }
    
    console.log(`Attempting login for email: ${email}`);
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`Login failed: No user found with email ${email}`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Login failed: Password mismatch for ${email}`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    console.log(`Login successful for user: ${email}`);
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Check if email is verified and include appropriate flags
    // Use both emailVerified and isEmailVerified for consistency
    const emailVerified = user.emailVerified || user.isEmailVerified;
    const phoneVerified = user.isPhoneVerified || false;
    
    // Check if any verification is required
    const requireVerification = !emailVerified;
    
    res.json({
      message: emailVerified 
        ? 'Login successful' 
        : 'Login successful. Please verify your email to access all features.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        emailVerified: emailVerified,
        isEmailVerified: emailVerified,
        isPhoneVerified: phoneVerified
      },
      requireVerification,
      redirectTo: requireVerification ? '/verify-email' : phoneVerified ? null : '/phone-verification'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Register user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phoneNumber } = req.body;
    
    // Validate input
    if (!username || !email || !password || !phoneNumber) {
      return res.status(400).json({ message: 'Please provide username, email, password, and phone number' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Please provide a valid email address',
        emailInvalid: true
      });
    }
    
    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ 
        message: 'Please provide a valid phone number',
        phoneInvalid: true
      });
    }
    
    console.log(`Attempting registration for email: ${email}, username: ${username}, phone: ${phoneNumber}`);
    
    // Check if user already exists
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`Registration failed: Email ${email} already exists`);
      return res.status(400).json({ 
        message: `This email (${email}) is already registered. Please use a different email or try logging in.`,
        emailExists: true
      });
    }
    
    existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log(`Registration failed: Username ${username} already exists`);
      return res.status(400).json({ 
        message: `Username "${username}" is already taken. Please choose a different username.`,
        usernameExists: true
      });
    }
    
    existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      console.log(`Registration failed: Phone number ${phoneNumber} already exists`);
      return res.status(400).json({ 
        message: `This phone number is already registered. Please use a different number or try logging in.`,
        phoneExists: true
      });
    }
    
    // Create new user
    const user = new User({
      username,
      email,
      password,
      phoneNumber,
      emailVerified: false, // Explicitly set as false
      isPhoneVerified: false // Explicitly set as false
    });
    
    await user.save();
    console.log(`Registration successful for user: ${email}`);
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Don't send verification emails automatically
    // Just redirect to verification page
    
    res.status(201).json({
      message: 'User registered successfully. Please verify your email to access all features.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        emailVerified: false,
        isPhoneVerified: false
      },
      requireVerification: true,
      redirectTo: '/verify-email'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Direct verification endpoint (for testing)
router.post('/verify-email-direct', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.emailVerified = true;
    await user.save();
    
    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Direct email verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update email verification status
router.post('/update-email-verification', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { email } = req.body;
    
    // Validate input
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    // Update user's email verification status
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Ensure email matches
    if (user.email !== email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email does not match the authenticated user' 
      });
    }
    
    // Update verification status
    user.emailVerified = true;
    user.isEmailVerified = true; // Update both fields for consistency
    await user.save();
    
    return res.status(200).json({ 
      success: true, 
      message: 'Email verification status updated successfully' 
    });
  } catch (error) {
    console.error('Update email verification error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Resend verification email/OTP route
router.post('/resend-verification', async (req, res) => {
  try {
    const { email, method } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if already verified
    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }
    
    // Send verification based on method preference
    if (method === 'link' || !method) {
      // Send verification link
      await authController.sendVerificationEmail({ 
        body: { email, userId: user._id } 
      }, { status: () => ({ json: () => {} }) });
    } else {
      // Send OTP
      await authController.sendOTP({ 
        body: { email } 
      }, { status: () => ({ json: () => {} }) });
    }
    
    res.json({
      message: `Verification ${method === 'otp' ? 'OTP' : 'link'} sent successfully`,
      success: true
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 