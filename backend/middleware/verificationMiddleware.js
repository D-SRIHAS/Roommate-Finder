const User = require('../models/User');

// Middleware to check if user's email is verified
const verificationMiddleware = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication failed: Missing user ID',
        requireVerification: true
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found',
        requireVerification: true
      });
    }
    
    // Check if email is verified
    if (!user.emailVerified) {
      console.log(`⚠️ Verification check failed for user: ${user.username}, email: ${user.email}`);
      
      return res.status(403).json({
        success: false,
        message: 'Your email is not verified. Please verify your email to access this feature.',
        requireVerification: true,
        redirectTo: '/verify-email'
      });
    }
    
    console.log(`✅ Verification check passed for user: ${user.username}, email: ${user.email}`);
    // User's email is verified, proceed to next middleware
    next();
  } catch (error) {
    console.error('Error in verification middleware:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error during verification check',
      requireVerification: true
    });
  }
};

module.exports = verificationMiddleware; 