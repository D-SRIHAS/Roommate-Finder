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
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      ws.close();
    }
  }

  ws.on('message', (message) => {
    console.log('Received:', message);
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
