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

// Keep track of active connections by user ID
const activeConnections = new Map();

// Debug function to log active connections
const logActiveConnections = () => {
  console.log('Available clients:', Array.from(activeConnections.keys()));
};

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
      
      // Close any existing connections for this user
      if (activeConnections.has(ws.userId)) {
        console.log(`Closing previous connection for user ${ws.userId}`);
        const oldConnection = activeConnections.get(ws.userId);
        if (oldConnection && oldConnection.readyState === WebSocket.OPEN) {
          oldConnection.send(JSON.stringify({
            type: 'connection',
            status: 'replaced',
            message: 'Your connection was replaced by a new login'
          }));
          oldConnection.close();
        }
      }
      
      // Store this connection
      activeConnections.set(ws.userId, ws);
      
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
    // Convert buffer to string before processing
    const messageString = message.toString('utf8');
    console.log('Received websocket message:', messageString);
    
    try {
      const parsedMessage = JSON.parse(messageString);
      console.log('Parsed message:', parsedMessage);
      
      // Handle different message types
      if (parsedMessage.type === 'chat') {
        console.log('Processing chat message:', parsedMessage);
        handleChatMessage(ws, parsedMessage);
      } else {
        // Echo the message back for testing
        ws.send(JSON.stringify({
          type: 'echo',
          data: parsedMessage
        }));
      }
    } catch (e) {
      console.error('Error parsing message:', e);
      console.error('Raw message content:', messageString);
      console.error('Message type:', typeof message);
      console.error('Is Buffer?', Buffer.isBuffer(message));
      console.error('Buffer length:', message.length);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected', ws.userId ? `(User: ${ws.userId})` : '');
    // Remove from active connections
    if (ws.userId && activeConnections.get(ws.userId) === ws) {
      activeConnections.delete(ws.userId);
    }
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

// Handle chat messages
const handleChatMessage = async (ws, data) => {
  try {
    console.log('Handling chat message, user ID:', ws.userId);
    console.log('Chat message data:', data);
    
    if (!ws.userId) {
      console.log('User not authenticated');
      return ws.send(JSON.stringify({
        type: 'error',
        message: 'Not authenticated'
      }));
    }
    
    const { recipientId, text } = data;
    
    if (!recipientId || !text) {
      console.error('Missing required fields in chat message');
      return ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
    
    // Create a unique conversation ID (smaller ID first for consistency)
    const participants = [ws.userId, recipientId].sort();
    const conversationId = `${participants[0]}_${participants[1]}`;
    
    console.log(`Creating message in conversation ${conversationId}: ${text}`);
    
    // Create the message object
    const newMessage = {
      conversationId,
      sender: ws.userId,
      recipient: recipientId,
      text,
      timestamp: new Date()
    };
    
    console.log('New message object:', newMessage);
    
    // First send confirmation to sender for immediate feedback
    ws.send(JSON.stringify({
      type: 'message_sent',
      message: newMessage
    }));
    
    // Then send the message to the recipient if they're online
    let recipientFound = false;
    
    // Check if recipient is in active connections
    console.log('Looking for recipient with ID:', recipientId);
    logActiveConnections();
    
    if (activeConnections.has(recipientId)) {
      const recipientWs = activeConnections.get(recipientId);
      if (recipientWs.readyState === WebSocket.OPEN) {
        recipientFound = true;
        console.log(`Sending message directly to recipient ${recipientId}`);
        recipientWs.send(JSON.stringify({
          type: 'new_message',
          message: newMessage
        }));
      }
    }
    
    if (!recipientFound) {
      console.log('Recipient not online, message will be delivered when they connect');
    }
    
    // After sending real-time messages, save to database without waiting
    const User = require('./models/User');
    
    try {
      // Add to sender's messages
      await User.findByIdAndUpdate(ws.userId, {
        $push: { messages: newMessage }
      });
      
      // Add to recipient's messages
      await User.findByIdAndUpdate(recipientId, {
        $push: { messages: newMessage }
      });
      
      console.log('Message saved to database');
    } catch (dbError) {
      console.error('Error saving message to database:', dbError);
      // Don't send error to client as message was already delivered
    }
  } catch (error) {
    console.error('Error handling chat message:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to send message: ' + error.message
    }));
  }
};

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
