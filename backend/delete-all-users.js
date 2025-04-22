const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/roommate-finder')
  .then(async () => {
    console.log('✅ MongoDB connected');
    
    // Import the User model
    const User = require('./models/User');
    
    try {
      // Delete all users
      const result = await User.deleteMany({});
      console.log(`✅ Successfully deleted ${result.deletedCount} users`);
      
      // Optional: Also delete related OTP records if you have them
      try {
        const OtpUser = require('./models/OtpUser');
        const otpResult = await OtpUser.deleteMany({});
        console.log(`✅ Successfully deleted ${otpResult.deletedCount} OTP records`);
      } catch (otpError) {
        console.log('No OTP records found or OtpUser model not available');
      }
      
    } catch (error) {
      console.error('❌ Error deleting users:', error);
    } finally {
      // Close the MongoDB connection
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }); 