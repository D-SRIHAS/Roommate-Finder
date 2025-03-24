const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function resetPassword() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/roommateFinder', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB successfully');

    const email = 'krishna@gmail.com';
    const password = 'krishna123';

    // Find the user
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    console.log(`Found user: ${user.username} (${user.email})`);

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password directly in the database to bypass the pre-save middleware
    const result = await User.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword } }
    );

    if (result.modifiedCount === 1) {
      console.log('✅ Password reset successful!');
      console.log(`User: ${user.email}`);
      console.log(`New password: ${password}`);
    } else {
      console.error('❌ Password reset failed');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

resetPassword(); 