require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// Email to update - based on the logs
const USER_EMAIL = 'srihaschintu@gmail.com';

async function verifyUserEmail() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/roommateFinder', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Find and update user by email
    const user = await User.findOne({ email: USER_EMAIL });
    
    if (!user) {
      console.error(`❌ User with email ${USER_EMAIL} not found`);
      process.exit(1);
    }
    
    console.log(`Found user: ${user.username} (${user.email}) with ID: ${user._id}`);
    console.log(`Current email verification status: ${user.emailVerified}`);
    
    // Update email verification status
    user.emailVerified = true;
    await user.save();
    
    console.log('✅ Email verification status updated to: true');
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('💤 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
verifyUserEmail(); 