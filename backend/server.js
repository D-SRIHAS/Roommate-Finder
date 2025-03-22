const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const authRoutes = require("./routes/auth");
const protectedRoutes = require("./routes/protectedRoute");
const userRoutes = require("./routes/user");

dotenv.config();
const app = express();
const server = http.createServer(app);

// WebSocket server setup
const wss = new WebSocket.Server({ server });
app.set('wss', wss);

// Helper function to clear expired token from browser
const sendClearTokenMessage = (ws) => {
  ws.send(JSON.stringify({
    type: 'auth_error',
    error: 'token_expired',
    message: 'Your session has expired. Please log in again.',
    action: 'clear_token'
  }));
};

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');

  // Extract token from query string
  const token = new URL(req.url, 'ws://localhost').searchParams.get('token');
  
  if (token) {
    try {
      // Verify token and get user ID
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      ws.userId = decoded.userId;
      console.log('WebSocket connection authenticated for user:', ws.userId);
      
      // Send a successful connection message
      ws.send(JSON.stringify({
        type: 'connection',
        status: 'success',
        message: 'Successfully connected to WebSocket server'
      }));
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      
      // Send appropriate error message to client
      if (error.name === 'TokenExpiredError') {
        sendClearTokenMessage(ws);
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          code: 'AUTH_FAILED',
          message: 'Authentication failed. Please log in again.'
        }));
      }
      
      // Close connection with appropriate code
      ws.close(1000, 'Authentication failed');
    }
  } else {
    console.error('No token provided for WebSocket connection');
    ws.send(JSON.stringify({
      type: 'error',
      code: 'NO_TOKEN',
      message: 'No authentication token provided'
    }));
    ws.close(1000, 'No authentication token');
  }

  ws.on('message', (message) => {
    console.log('Received:', message);
    // Echo the message back for testing
    try {
      const parsedMessage = JSON.parse(message);
      ws.send(JSON.stringify({
        type: 'echo',
        data: parsedMessage
      }));
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/user", userRoutes);

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug route to check uploads directory
app.get('/check-uploads', (req, res) => {
  const uploadsDir = path.join(__dirname, 'uploads');
  
  if (!fs.existsSync(uploadsDir)) {
    return res.json({
      exists: false,
      message: 'Uploads directory does not exist',
      path: uploadsDir
    });
  }
  
  try {
    const files = fs.readdirSync(uploadsDir);
    return res.json({
      exists: true,
      path: uploadsDir,
      files: files,
      fileCount: files.length
    });
  } catch (error) {
    return res.status(500).json({
      exists: true,
      path: uploadsDir,
      error: error.message
    });
  }
});

// Default route
app.get("/", (req, res) => {
  res.send("🚀 Backend is running...");
});

// Handle undefined routes
app.use((req, res) => {
  res.status(404).json({ message: "❌ Route Not Found" });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
