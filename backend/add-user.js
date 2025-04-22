const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/roommate-finder', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const addUser = async () => {
  try {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('test123', salt);

    // Create user
    const user = new User({
      username: 'srihas',
      email: 'srihaschintu01@gmail.com',
      password: hashedPassword,
      phoneNumber: '+919876543210',
      emailVerified: true,
      isPhoneVerified: true
    });

    await user.save();
    console.log('User created successfully!');
    console.log('Email: srihaschintu01@gmail.com');
    console.log('Password: test123');
  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    mongoose.connection.close();
  }
};

addUser(); 