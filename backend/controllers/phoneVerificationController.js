const User = require('../models/User');
const twilio = require('twilio');
const { generateOTP } = require('../utils/otp');

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Send OTP via SMS
const sendOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in user document
    user.phoneVerificationOTP = {
      code: otp,
      expiresAt
    };
    await user.save();

    try {
      // Send OTP via Twilio
      await twilioClient.messages.create({
        body: `Your Roommate Finder verification code is: ${otp}. Valid for 10 minutes.`,
        to: phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER
      });
      console.log(`SMS sent successfully to ${phoneNumber} with OTP: ${otp}`);
    } catch (twilioError) {
      // Log error but don't fail the request - for development purposes
      console.error('Twilio SMS error:', twilioError);
      console.log(`⚠️ DEVELOPMENT MODE: SMS would have been sent to ${phoneNumber} with OTP: ${otp}`);
    }

    res.json({ 
      message: 'OTP sent successfully',
      // Include OTP in response during development - remove in production
      developmentOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ message: 'Error sending OTP' });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.phoneVerificationOTP) {
      return res.status(400).json({ message: 'No OTP request found' });
    }

    if (user.phoneVerificationOTP.expiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (user.phoneVerificationOTP.code !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Mark phone as verified
    user.isPhoneVerified = true;
    user.phoneVerificationOTP = undefined;
    await user.save();

    res.json({ message: 'Phone number verified successfully' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Error verifying OTP' });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store new OTP in user document
    user.phoneVerificationOTP = {
      code: otp,
      expiresAt
    };
    await user.save();

    try {
      // Send new OTP via Twilio
      await twilioClient.messages.create({
        body: `Your new Roommate Finder verification code is: ${otp}. Valid for 10 minutes.`,
        to: phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER
      });
      console.log(`SMS resent successfully to ${phoneNumber} with OTP: ${otp}`);
    } catch (twilioError) {
      // Log error but don't fail the request - for development purposes
      console.error('Twilio SMS error:', twilioError);
      console.log(`⚠️ DEVELOPMENT MODE: SMS would have been resent to ${phoneNumber} with OTP: ${otp}`);
    }

    res.json({ 
      message: 'New OTP sent successfully',
      // Include OTP in response during development - remove in production
      developmentOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
    });
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ message: 'Error resending OTP' });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  resendOTP
}; 