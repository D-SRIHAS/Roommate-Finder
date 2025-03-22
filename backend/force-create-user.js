require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB directly
async function createUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Generate a simple hashed password
    const password = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user document directly in MongoDB (bypassing Mongoose middleware)
    const result = await mongoose.connection.collection('users').insertOne({
      username: 'simpleuser',
      email: 'simple@example.com',
      password: hashedPassword,
      profileCompleted: true,
      profile: {
        fullName: 'Simple User',
        bio: 'Test user with simple password',
        address: '123 Test St',
        phone: '555-1234',
        occupation: 'Tester'
      },
      preferences: {
        cleanliness: 'Very Clean',
        smoking: 'No Smoking',
        pets: 'No Pets',
        workSchedule: 'Regular Hours',
        socialLevel: 'Moderately Social',
        guestPreference: 'Occasional Guests',
        music: 'With Headphones'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('User created successfully:');
    console.log('- Email: simple@example.com');
    console.log('- Password: password123');
    console.log('- User ID:', result.insertedId);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createUser(); 