const mongoose = require('mongoose');
const User = require('./models/User');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/roommate-finder', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const checkUsers = async () => {
  try {
    console.log('Checking all users in database...');
    const users = await User.find({});
    
    if (users.length === 0) {
      console.log('No users found in database');
    } else {
      console.log(`Found ${users.length} users:`);
      users.forEach(user => {
        console.log('\nUser details:');
        console.log('ID:', user._id);
        console.log('Email:', user.email);
        console.log('Username:', user.username);
        console.log('Email Verified:', user.emailVerified);
        console.log('Phone Verified:', user.isPhoneVerified);
      });
    }
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    mongoose.connection.close();
  }
};

checkUsers(); 