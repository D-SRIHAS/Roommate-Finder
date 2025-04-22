const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { authenticateJWT } = require('./middleware/auth');

// Load environment variables first
dotenv.config();

// Import User model
const User = require('./models/User');

// Then create Express app and server
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/roommate-finder')
  .then(() => {
    console.log("✅ MongoDB connected");
    
    // Create Socket.io server with CORS configuration
    const io = new Server(server, {
      cors: {
        origin: ["http://localhost:3000", "http://192.168.0.100:3000"], // Allow React app to connect
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    
    // Function to broadcast user online status to friends
    async function broadcastUserStatus(userId, isOnline) {
      try {
        const user = await User.findById(userId).populate('friends');
        
        if (user && user.friends) {
          user.friends.forEach(friend => {
            if (activeUsers.has(friend._id.toString())) {
              const friendSocketIds = activeUsers.get(friend._id.toString());
              friendSocketIds.forEach(socketId => {
                io.to(socketId).emit('userStatus', { 
                  userId, 
                  status: isOnline ? 'online' : 'offline' 
                });
              });
            }
          });
        }
      } catch (error) {
        console.error('Error broadcasting user status:', error);
      }
    }

    // Function to send online users to socket
    async function sendOnlineUsers(socket) {
      try {
        const user = await User.findById(socket.userId).populate('friends');
        
        if (user && user.friends) {
          const onlineFriends = user.friends
            .filter(friend => activeUsers.has(friend._id.toString()))
            .map(friend => friend._id.toString());
          
          socket.emit('onlineUsers', { users: onlineFriends });
        }
      } catch (error) {
        console.error('Error sending online users:', error);
      }
    }

    // Socket.io middleware for authentication
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication error: Token not provided'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        
        // Store user info in socket
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }
        
        socket.user = user;
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication error: Invalid token'));
      }
    });

    // Active users mapping
    const activeUsers = new Map();

    // Socket.io connection handling
    io.on('connection', (socket) => {
      console.log(`WebSocket connection authenticated for user: ${socket.userId}`);
      
      // Add user to active users map
      if (!activeUsers.has(socket.userId)) {
        activeUsers.set(socket.userId, new Set());
      }
      activeUsers.get(socket.userId).add(socket.id);
      
      // Log active connections
      let totalConnections = 0;
      let activeUserCount = 0;
      activeUsers.forEach(connections => {
        totalConnections += connections.size;
        activeUserCount++;
      });
      console.log(`Currently active clients: ${activeUserCount} users with ${totalConnections} total connections`);
      
      // Broadcast online status to friends
      broadcastUserStatus(socket.userId, true);
      
      // Send initial online users to the connected client
      sendOnlineUsers(socket);
      
      // Handle join room event
      socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.userId} joined room: ${roomId}`);
      });
      
      // Handle leave room event
      socket.on('leaveRoom', (roomId) => {
        socket.leave(roomId);
        console.log(`User ${socket.userId} left room: ${roomId}`);
      });
      
      // Handle private message event
      socket.on('sendMessage', async (data, callback) => {
        try {
          console.log(`Received websocket message from user: ${socket.userId}`);
          
          const { recipientId, text } = data;
          
          if (!recipientId || !text) {
            if (callback) callback({ error: 'Recipient ID and message text are required' });
            return;
          }
          
          // Create a unique conversation ID (smaller ID first for consistency)
          const participants = [socket.userId, recipientId].sort();
          const conversationId = `${participants[0]}_${participants[1]}`;
          
          // Create message object with a MongoDB ObjectId
          const messageId = new mongoose.Types.ObjectId();
          const timestamp = new Date();
          const messageData = {
            _id: messageId,
            conversationId,
            sender: socket.userId,
            recipient: recipientId,
            text,
            timestamp,
            read: false
          };
          
          // Format for sending over socket
          const messageToSend = {
            ...messageData,
            timestamp: timestamp.toISOString() // Convert Date to string for JSON
          };
          
          // Send confirmation back to sender immediately
          socket.emit('messageSent', messageToSend);
          
          // Send message to recipient if online
          if (activeUsers.has(recipientId)) {
            const recipientSockets = activeUsers.get(recipientId);
            recipientSockets.forEach(socketId => {
              io.to(socketId).emit('newMessage', messageToSend);
            });
            console.log(`Message sent to online recipient ${recipientId}`);
          } else {
            console.log(`Recipient ${recipientId} is offline, message will be delivered when they connect`);
          }
          
          // Save to database in the background (don't await to avoid blocking)
          Promise.all([
            User.findByIdAndUpdate(socket.userId, { $push: { messages: messageData } }),
            User.findByIdAndUpdate(recipientId, { $push: { messages: messageData } })
          ]).then(() => {
            console.log(`Message saved to database: ${messageId}`);
          }).catch(error => {
            console.error('Error saving message to database:', error);
          });
          
          // Send success acknowledgment if callback exists
          if (callback) callback({ success: true, messageId: messageId.toString() });
          
        } catch (error) {
          console.error('Error sending message:', error);
          if (callback) callback({ error: 'Failed to send message' });
        }
      });
      
      // Handle typing indicator
      socket.on('typing', (data) => {
        const { recipientId } = data;
        
        if (activeUsers.has(recipientId)) {
          const recipientSocketIds = activeUsers.get(recipientId);
          recipientSocketIds.forEach(socketId => {
            io.to(socketId).emit('userTyping', { userId: socket.userId });
          });
        }
      });
      
      // Handle stop typing
      socket.on('stopTyping', (data) => {
        const { recipientId } = data;
        
        if (activeUsers.has(recipientId)) {
          const recipientSocketIds = activeUsers.get(recipientId);
          recipientSocketIds.forEach(socketId => {
            io.to(socketId).emit('userStopTyping', { userId: socket.userId });
          });
        }
      });
      
      // Handle mark as read
      socket.on('markAsRead', async (data) => {
        try {
          const { messageId } = data;
          if (!messageId) {
            console.error('Missing messageId in markAsRead event');
            return;
          }

          // Skip if it's a temporary message ID
          if (messageId.startsWith('temp-')) {
            return;
          }

          // Validate if messageId is a valid MongoDB ObjectId
          if (!mongoose.Types.ObjectId.isValid(messageId)) {
            console.error('Invalid messageId format:', messageId);
            return;
          }
          
          console.log(`Marking message ${messageId} as read by user ${socket.userId}`);
          
          // Update message read status in database
          const result = await User.updateMany(
            { 'messages._id': messageId },
            { $set: { 'messages.$.read': true } }
          );
          
          console.log(`Update result:`, result);
          
          // Find the message to notify the sender
          const userWithMessage = await User.findOne(
            { 'messages._id': messageId },
            { 'messages.$': 1 }
          );
          
          if (userWithMessage && userWithMessage.messages && userWithMessage.messages[0]) {
            const message = userWithMessage.messages[0];
            const senderId = message.sender.toString();
            
            // Notify sender that the message was read
            if (senderId !== socket.userId && activeUsers.has(senderId)) {
              const senderSockets = activeUsers.get(senderId);
              senderSockets.forEach(socketId => {
                io.to(socketId).emit('messageRead', { messageId });
              });
              console.log(`Notified sender ${senderId} that message was read`);
            }
          }
        } catch (error) {
          console.error('Error marking message as read:', error);
        }
      });
    });
    
  })
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/protected", require("./routes/protectedRoute"));
app.use("/api/user", require("./routes/user"));
app.use('/api/profile', require('./routes/profile'));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  console.log('Creating uploads directory:', uploadDir);
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

// This section handles user updating their preferences
app.post('/api/user/preferences', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { preferences } = req.body;
    
    if (!preferences) {
      return res.status(400).json({ message: 'No preferences provided' });
    }
    
    // Find and update the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update preferences
    user.preferences = { ...user.preferences, ...preferences };
    await user.save();
    
    return res.status(200).json({ 
      success: true,
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });
  } catch (error) {
    console.error('Error in preferences update:', error);
    return res.status(500).json({ message: 'Server error updating preferences' });
  }
});

// Start the server
const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`🚀 Backend is running on port ${PORT}`);
});