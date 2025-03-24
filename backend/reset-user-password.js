require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function resetPassword() {
  try {
    // Connect to MongoDB (will use Atlas URL from .env if properly configured)
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB successfully');
    
    // User email to update (change this to match your user)
    const email = 'srihaschintu01@gmail.com';
    
    // New password to set - using a very simple password now
    const newPassword = 'simple123';
    
    // Generate hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update directly in the database, bypassing any middleware
    const result = await mongoose.connection.collection('users').updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );
    
    if (result.matchedCount === 1) {
      console.log('✅ Password reset successful!');
      console.log(`User: ${email}`);
      console.log(`New password: ${newPassword}`);
    } else {
      console.log(`❌ User with email ${email} not found`);
    }
  } catch (error) {
    console.error('🚨 Error resetting password:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

resetPassword(); 