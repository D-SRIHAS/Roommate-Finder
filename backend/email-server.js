require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const { initMongoDB } = require('./mongodb-setup');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('Email Verification API is running');
});

// Initialize MongoDB connection
(async () => {
  try {
    const connected = await initMongoDB();
    if (!connected) {
      console.error('Failed to connect to MongoDB, server may not function properly');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
})();

// Start server
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
}); 