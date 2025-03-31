const crypto = require('crypto');

// Generate a random 6-digit OTP
const generateOTP = () => {
  // Generate a random 6-digit number
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate a random token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = {
  generateOTP,
  generateToken
}; 