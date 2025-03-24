const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function resetKrishnaPassword() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/roommateFinder', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB successfully');

    const db = mongoose.connection.db;
    const email = 'krishna@gmail.com';
    const newPassword = 'krishna123';

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    console.log('Password hashed:', hashedPassword);

    // Update directly using the MongoDB driver
    const result = await db.collection('users').updateOne(
      { email: email },
      { $set: { password: hashedPassword } }
    );

    if (result.modifiedCount === 1) {
      console.log('✅ Password reset successful!');
      console.log(`User: ${email}`);
      console.log(`New password: ${newPassword}`);
    } else {
      console.error('❌ Password reset failed - user not found or not updated');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

resetKrishnaPassword(); 