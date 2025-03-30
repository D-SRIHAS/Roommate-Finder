const mongoose = require('mongoose');
require('dotenv').config();

/**
 * MongoDB connection with improved options
 * @returns {Promise} Mongoose connection promise
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/email-verification';
    
    // MongoDB connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      autoIndex: true, // Build indexes
      maxPoolSize: 10, // Maintain up to 10 socket connections
      family: 4 // Use IPv4, skip trying IPv6
    };

    await mongoose.connect(mongoURI, options);
    console.log('✅ MongoDB connected successfully');
    
    // Check the connection status
    const { host, port, name } = mongoose.connection;
    console.log(`📦 Database: ${name} on ${host}:${port}`);
    
    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    // Exit process with failure if this is a critical error
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
};

// Setup MongoDB event listeners
const setupMongoDBEventListeners = () => {
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
  });

  // Graceful shutdown handler
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    } catch (err) {
      console.error('Failed to close MongoDB connection:', err);
      process.exit(1);
    }
  });
};

// Initialize MongoDB
const initMongoDB = async () => {
  try {
    // Use the roommateFinder database to match with the main application
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/roommateFinder';
    
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📦 Database: ${mongoose.connection.name} on ${mongoose.connection.host}:${mongoose.connection.port}`);
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    return false;
  }
};

module.exports = {
  connectDB,
  setupMongoDBEventListeners,
  initMongoDB
};
