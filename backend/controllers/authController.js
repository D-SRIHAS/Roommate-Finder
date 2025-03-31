// Import models and dependencies
const axios = require('axios');
const OtpUser = require('../models/OtpUser');
const User = require('../models/User');
const nodemailerConfig = require('../config/nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../utils/email');
const { generateOTP } = require('../utils/otp');

// Send OTP via email
const sendOtpEmail = async (email, otp) => {
  try {
    // Use the sendOtpEmail function from nodemailerConfig
    const result = await nodemailerConfig.sendOtpEmail(email, otp);
    return result;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return { 
      success: false, 
      error: error.message,
      errorType: error.code === 'EENVELOPE' ? 'email_undeliverable' : 'email_error'
    };
  }
};

// Generate a verification token using JWT
const generateVerificationToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Send OTP to user's email
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if email exists in the main users database
    const userExists = await User.findOne({ email });
    
    if (!userExists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Email address does not exist in our system. Please register first.' 
      });
    }

    // Generate a 6-digit OTP
    const otp = generateOTP();
    
    // Display OTP prominently in console for testing
    console.log(`\n=================================================`);
    console.log(`🔑 YOUR VERIFICATION CODE: ${otp}`);
    console.log(`   For email: ${email}`);
    console.log(`=================================================\n`);
    
    // OTP expires in 5 minutes
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 5);

    // Check if user exists
    let user = await OtpUser.findOne({ email });

    if (user) {
      // Update existing user
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      user.isVerified = false;
      await user.save();
    } else {
      // Create new user
      user = new OtpUser({
        email,
        otp,
        otpExpiry,
      });
      await user.save();
    }

    // Send OTP via email
    const emailResult = await sendOtpEmail(email, otp);

    if (!emailResult.success) {
      // Check for specific email delivery errors
      if (emailResult.error && (
          emailResult.error.includes("Address not found") || 
          emailResult.error.includes("unable to receive mail") ||
          emailResult.error.includes("550") ||
          emailResult.error.includes("recipient rejected")
        )) {
        return res.status(422).json({ 
          success: false, 
          message: 'The email address could not be found or is unable to receive mail. Please check the email address and try again.',
          errorType: 'email_undeliverable',
          error: emailResult.error
        });
      }

      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send OTP email',
        error: emailResult.error
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'OTP sent to your email',
      expiresIn: '5 minutes'
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    
    // Check for nodemailer specific errors
    if (error.code === 'EENVELOPE' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(422).json({ 
        success: false, 
        message: 'The email address appears to be invalid or unable to receive mail. Please check the email address and try again.',
        errorType: 'email_undeliverable',
        error: error.message
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Verify the OTP entered by user
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP are required' 
      });
    }

    // Find user by email
    const otpUser = await OtpUser.findOne({ email });

    if (!otpUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found. Please request a new OTP' 
      });
    }

    // Check if OTP has expired
    if (otpUser.otpExpiry < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired. Please request a new one' 
      });
    }

    // Verify OTP
    if (otpUser.otp !== otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP. Please try again' 
      });
    }

    // Mark OTP user as verified
    otpUser.isVerified = true;
    otpUser.otp = undefined;
    otpUser.otpExpiry = undefined;
    await otpUser.save();
    
    // Check both exact email and lowercase version
    let updateStatus = 'Not attempted';
    
    try {
      // Update the main User model to mark email as verified
      
      // Try exact match first
      console.log(`Looking for exact user match with email: ${email}`);
      let mainUser = await User.findOne({ email: email });
      
      // If not found, try lowercase version
      if (!mainUser) {
        console.log(`Trying case-insensitive match for: ${email.toLowerCase()}`);
        mainUser = await User.findOne({ email: email.toLowerCase() });
      }
      
      if (mainUser) {
        console.log(`Found user: ${mainUser.username} with id: ${mainUser._id}`);
        mainUser.emailVerified = true;
        await mainUser.save();
        console.log(`User ${email} marked as email verified in main User model`);
        updateStatus = 'Success';
      } else {
        console.log(`User with email: ${email} not found in main User model`);
        // List available users for debugging
        const allUsers = await User.find({}).select('_id username email');
        console.log('Available users:');
        allUsers.forEach(u => console.log(`- ${u.username} (${u.email})`));
        updateStatus = 'User not found';
      }
    } catch (error) {
      console.error('Error updating main user model:', error);
      updateStatus = `Error: ${error.message}`;
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Email verified successfully',
      mainUserUpdate: updateStatus
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Send verification email with token link
exports.sendVerificationEmail = async (req, res) => {
  try {
    const { email, userId } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // If no userId is provided, check if the email exists in the database
    if (!userId || userId === 'newuser') {
      const userExists = await User.findOne({ email });
      
      if (!userExists) {
        return res.status(404).json({ 
          success: false, 
          message: 'Email address does not exist in our system. Please register first.' 
        });
      }
    }

    // Generate a verification token
    const verificationToken = generateVerificationToken(userId || 'newuser', email);
    
    // Create verification link
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email-token?token=${verificationToken}`;
    
    console.log(`\n=================================================`);
    console.log(`🔗 VERIFICATION LINK: ${verificationLink}`);
    console.log(`   For email: ${email}`);
    console.log(`=================================================\n`);

    // Send verification email
    const emailResult = await sendVerificationEmail(email, verificationLink);

    if (!emailResult.success) {
      // Check for specific email delivery errors
      if (emailResult.error && (
          emailResult.error.includes("Address not found") || 
          emailResult.error.includes("unable to receive mail") ||
          emailResult.error.includes("550") ||
          emailResult.error.includes("recipient rejected")
        )) {
        return res.status(422).json({ 
          success: false, 
          message: 'The email address could not be found or is unable to receive mail. Please check the email address and try again.',
          errorType: 'email_undeliverable',
          error: emailResult.error
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send verification email',
        error: emailResult.error
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Verification email sent',
      expiresIn: '24 hours'
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    
    // Check for nodemailer specific errors
    if (error.code === 'EENVELOPE' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(422).json({ 
        success: false, 
        message: 'The email address appears to be invalid or unable to receive mail. Please check the email address and try again.',
        errorType: 'email_undeliverable',
        error: error.message
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Verify email with token
exports.verifyEmailToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verification token is required' 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification token' 
      });
    }

    // Extract email from token
    const { email, userId } = decoded;

    // Find user by email or userId
    let mainUser;
    
    if (userId && userId !== 'newuser') {
      mainUser = await User.findById(userId);
    }
    
    if (!mainUser && email) {
      // Try to find by email if userId lookup failed
      mainUser = await User.findOne({ email });
    }

    if (!mainUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found'
      });
    }

    // Update user's verification status
    mainUser.emailVerified = true;
    await mainUser.save();

    return res.status(200).json({ 
      success: true, 
      message: 'Email verified successfully',
      user: {
        id: mainUser._id,
        username: mainUser.username,
        email: mainUser.email,
        emailVerified: mainUser.emailVerified
      }
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
}; 