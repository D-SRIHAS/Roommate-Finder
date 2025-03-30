const nodemailer = require('nodemailer');
require('dotenv').config();

// Debug mode - when true, logs OTP to console instead of sending actual email
const DEBUG_MODE = false;

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USERNAME || 'test@example.com',
    pass: process.env.EMAIL_PASSWORD || 'password123'
  },
  // Add error handling with rejection
  tls: {
    rejectUnauthorized: true
  }
});

// Verify transporter connection
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('SMTP server connection established successfully');
  }
});

// Function to send OTP via email
exports.sendOtpEmail = async (email, otp) => {
  try {
    // Debug mode - don't actually send email, just log OTP
    if (DEBUG_MODE) {
      console.log(`🔑 DEBUG MODE: OTP for ${email} is: ${otp}`);
      return { success: true, message: 'OTP logged to console (DEBUG MODE)' };
    }

    // Real email sending logic
    const mailOptions = {
      from: `"Roommate Finder" <${process.env.EMAIL_USERNAME}>`,
      to: email,
      subject: 'Email Verification OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4a6ee0;">Email Verification</h2>
          <p>Thank you for registering with Roommate Finder. Please use the following OTP to verify your email address:</p>
          <div style="background-color: #f4f7ff; padding: 10px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="color: #4a6ee0; margin: 0; font-size: 36px;">${otp}</h1>
          </div>
          <p>This OTP will expire in 5 minutes.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #999;">This is an automated message, please do not reply.</p>
        </div>
      `
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return { success: true, message: 'OTP sent successfully' };
    } catch (mailError) {
      console.error('Specific nodemailer error:', mailError);
      
      // Check for specific error types
      if (mailError.code === 'EENVELOPE' || 
          mailError.code === 'ECONNREFUSED' || 
          mailError.responseCode >= 500) {
        return { 
          success: false, 
          error: `Email delivery error: ${mailError.message || 'Address not found or unable to receive mail'}` 
        };
      }
      
      return { success: false, error: mailError.message };
    }
  } catch (error) {
    console.error('Error in sendOtpEmail:', error);
    return { success: false, error: error.message };
  }
};

// Function to send verification email with link
exports.sendVerificationEmail = async (email, verificationLink) => {
  try {
    // Debug mode - don't actually send email, just log link
    if (DEBUG_MODE) {
      console.log(`🔗 DEBUG MODE: Verification link for ${email} is: ${verificationLink}`);
      return { success: true, message: 'Verification link logged to console (DEBUG MODE)' };
    }

    // Real email sending logic
    const mailOptions = {
      from: `"Roommate Finder" <${process.env.EMAIL_USERNAME}>`,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4a6ee0;">Email Verification</h2>
          <p>Thank you for registering with Roommate Finder. Please click the button below to verify your email address:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #4a6ee0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
               Verify My Email
            </a>
          </div>
          
          <p>Or copy and paste this link in your browser:</p>
          <p style="background-color: #f4f7ff; padding: 10px; border-radius: 5px; word-break: break-all;">
            ${verificationLink}
          </p>
          
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #999;">This is an automated message, please do not reply.</p>
        </div>
      `
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Verification email sent:', info.messageId);
      return { success: true, message: 'Verification email sent successfully' };
    } catch (mailError) {
      console.error('Specific nodemailer error:', mailError);
      
      // Check for specific error types
      if (mailError.code === 'EENVELOPE' || 
          mailError.code === 'ECONNREFUSED' || 
          mailError.responseCode >= 500) {
        return { 
          success: false, 
          error: `Email delivery error: ${mailError.message || 'Address not found or unable to receive mail'}` 
        };
      }
      
      return { success: false, error: mailError.message };
    }
  } catch (error) {
    console.error('Error in sendVerificationEmail:', error);
    return { success: false, error: error.message };
  }
}; 