require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Function to create a test user
async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Test user credentials
    const testEmail = 'tester@example.com';
    const testUsername = 'TestUser';
    
    // Check if the test user already exists by email or username
    let existingUserByEmail = await User.findOne({ email: testEmail });
    let existingUserByUsername = await User.findOne({ username: testUsername });
    
    if (existingUserByEmail) {
      console.log('Test user with email already exists, deleting...');
      await User.deleteOne({ email: testEmail });
      console.log('Existing test user deleted');
    }
    
    if (existingUserByUsername) {
      console.log('Test user with username already exists, deleting...');
      await User.deleteOne({ username: testUsername });
      console.log('Existing user with same username deleted');
    }
    
    // Create a plain password
    const plainPassword = 'Test1234';
    
    // Manually hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);
    
    // Create a new user with the hashed password
    const newUser = new User({
      username: testUsername,
      email: testEmail,
      password: hashedPassword,
      profileCompleted: true,
      profile: {
        fullName: 'Test User',
        bio: 'This is a test user for development',
        address: '123 Test Street',
        phone: '555-1234',
        occupation: 'Software Tester'
      },
      preferences: {
        cleanliness: 'Moderately Clean',
        smoking: 'No Smoking',
        pets: 'Pet Friendly',
        workSchedule: 'Regular Hours',
        socialLevel: 'Moderately Social',
        guestPreference: 'Occasional Guests',
        music: 'With Headphones'
      }
    });
    
    // Save the user to the database
    const savedUser = await newUser.save();
    
    console.log('Test user created successfully:');
    console.log('Email:', testEmail);
    console.log('Password:', plainPassword);
    console.log('User ID:', savedUser._id);
    
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    // Close the database connection
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the function
createTestUser(); 