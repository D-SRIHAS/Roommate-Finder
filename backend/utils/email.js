const nodemailerConfig = require('../config/nodemailer');

// Send verification email with OTP
const sendVerificationEmail = async (email, otp) => {
  try {
    // Use the function from nodemailerConfig
    return await nodemailerConfig.sendOtpEmail(email, otp);
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { 
      success: false, 
      error: error.message,
      errorType: error.code === 'EENVELOPE' ? 'email_undeliverable' : 'email_error'
    };
  }
};

module.exports = {
  sendVerificationEmail
}; 