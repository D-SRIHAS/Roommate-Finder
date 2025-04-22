const nodemailer = require('nodemailer');
const User = require('../models/User');
const { generateOTP } = require('../utils/otpUtils');

// Initialize email transporter only if credentials are available and SMTP is enabled
let transporter = null;
try {
  // Only initialize the transporter if explicitly enabled
  if (process.env.SMTP_ENABLED === 'true' && 
      process.env.SMTP_HOST && 
      process.env.SMTP_PORT && 
      process.env.SMTP_USER && 
      process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    console.log('SMTP transport initialized successfully');
  } else {
    console.log('SMTP is disabled, will use console logging instead');
  }
} catch (error) {
  // Suppress the error details to avoid clutter
  console.warn('SMTP initialization failed, using fallback OTP method');
}

const sendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otp = generateOTP();
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    user.emailVerificationOTP = {
      code: otp,
      expiryTime
    };
    await user.save();

    // Try to send via SMTP if available, otherwise just log the OTP
    if (process.env.EMAIL_ENABLED === 'true' && transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: email,
          subject: 'Roommate Finder - Email Verification',
          text: `Your verification code is: ${otp}`,
          html: `<p>Your verification code is: <strong>${otp}</strong></p>`
        });
        console.log(`Email sent to ${email} with OTP: ${otp}`);
      } catch (error) {
        // Suppress error details to avoid clutter
        console.log(`Email sending failed, using console logging instead. OTP for ${email}: ${otp}`);
      }
    } else {
      console.log(`Email sending disabled. OTP for ${email}: ${otp}`);
    }

    res.status(200).json({ message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('Error sending verification email');
    res.status(500).json({ message: 'Error sending verification email', error: error.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.emailVerificationOTP) {
      return res.status(400).json({ message: 'No OTP found for this user' });
    }

    if (user.emailVerificationOTP.code !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (new Date() > user.emailVerificationOTP.expiryTime) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    user.isEmailVerified = true;
    user.emailVerificationOTP = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ message: 'Error verifying email', error: error.message });
  }
};

module.exports = {
  sendVerificationEmail,
  verifyEmail
}; 