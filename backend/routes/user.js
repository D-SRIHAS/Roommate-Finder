const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authenticateJWT } = require("../middleware/auth");
const verificationMiddleware = require("../middleware/verificationMiddleware");
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Helper function to geocode addresses
const geocodeAddress = async (address) => {
  try {
    if (!address) return null;
    
    // For testing, we'll use a basic geocoding approach
    // In production, use Google Maps Geocoding API with your API key
    // const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=YOUR_API_KEY`);
    // return { lat: response.data.results[0].geometry.location.lat, lng: response.data.results[0].geometry.location.lng };
    
    // Placeholder implementation with major Indian cities
    const cities = {
      'delhi': {lat: 28.6139, lng: 77.2090},
      'mumbai': {lat: 19.0760, lng: 72.8777},
      'bangalore': {lat: 12.9716, lng: 77.5946},
      'hyderabad': {lat: 17.3850, lng: 78.4867},
      'chennai': {lat: 13.0827, lng: 80.2707},
      'kolkata': {lat: 22.5726, lng: 88.3639},
      'pune': {lat: 18.5204, lng: 73.8567},
      'ahmedabad': {lat: 23.0225, lng: 72.5714},
      'jaipur': {lat: 26.9124, lng: 75.7873},
      'gautam budh nagar': {lat: 28.5355, lng: 77.3910}, // Noida
      'noida': {lat: 28.5355, lng: 77.3910},
      'surat': {lat: 21.1702, lng: 72.8311},
      'jagat': {lat: 28.2380, lng: 94.8260},
    };
    
    // Find the city in the address
    const addressLower = address.toLowerCase();
    for (const [city, coords] of Object.entries(cities)) {
      if (addressLower.includes(city)) {
        console.log(`✅ Found coordinates for location: ${city} in address: ${address}`);
        return coords;
      }
    }
    
    // If we have an exact city name match in the preferenceOptions
    const exactCity = Object.keys(cities).find(city => 
      city.toLowerCase() === addressLower || 
      addressLower === city.toLowerCase()
    );
    
    if (exactCity) {
      console.log(`✅ Exact match for city: ${exactCity}`);
      return cities[exactCity];
    }
    
    // Default to Delhi if no match
    console.log(`❌ No coordinates found for: ${address}, using default (Delhi)`);
    return cities.delhi;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
};

// Calculate distance between two points using Haversine formula (in km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;  
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + req.user.userId + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Get and Update User Profile
router.route('/profile')
  .get(authenticateJWT, async (req, res) => {
    try {
      console.log("📩 Profile request received for user:", req.user);
      const userId = req.user.userId;
      console.log("🔍 Looking up user with ID:", userId);
      
      const user = await User.findById(userId)
        .select('-password')
        .populate({
          path: 'friendRequests.from',
          select: 'username profile.fullName profile.photoUrl'
        });
      
      console.log("👤 User found:", user);
      
      if (!user) {
        console.log("❌ User not found with ID:", userId);
        return res.status(404).json({ message: "User not found" });
      }

      // This section processes the friend requests to include additional data
      if (user.friendRequests && user.friendRequests.length > 0) {
        const populatedRequests = await Promise.all(user.friendRequests.map(async (request) => {
          // Add a null check to prevent TypeError when 'from' is null
          if (!request.from) {
            return {
              ...request.toObject(),
              fromUser: null
            };
          }
          
          try {
            const fromUser = await User.findById(request.from).select('username profile');
            return {
              ...request.toObject(),
              fromUser: fromUser ? {
                _id: fromUser._id,
                username: fromUser.username,
                fullName: fromUser.profile?.fullName,
                photoUrl: fromUser.profile?.photoUrl,
                occupation: fromUser.profile?.occupation,
                address: fromUser.profile?.address
              } : null
            };
          } catch (err) {
            console.error('Error fetching friend request sender:', err);
            return {
              ...request.toObject(),
              fromUser: null
            };
          }
        }));
        
        // Replace the friend requests with the populated ones
        user.friendRequests = populatedRequests;
      }

      console.log("✅ Sending profile data");
      res.status(200).json(user);
    } catch (error) {
      console.error("🚨 Error fetching profile:", error);
      res.status(500).json({ message: "Error fetching profile" });
    }
  })
  .put(authenticateJWT, upload.single('photo'), async (req, res) => {
    try {
      console.log("📩 Profile update request received");
      console.log("📦 Request body:", req.body);
      console.log("📷 File:", req.file);
      
      const userId = req.user.userId;
      let profileData = {};
      
      try {
        profileData = req.body.profile ? JSON.parse(req.body.profile) : {};
        console.log("✅ Parsed profile data:", profileData);
      } catch (error) {
        console.error("❌ Error parsing profile data:", error);
        profileData = req.body.profile || {};
      }
      
      const updateData = {
        profile: {
          fullName: profileData.fullName || '',
          bio: profileData.bio || '',
          address: profileData.address || '',
          phone: profileData.phone || '',
          occupation: profileData.occupation || ''
        }
      };
      
      // Check if required fields are filled to mark profile as complete
      if (profileData.fullName && profileData.address) {
        updateData.profileCompleted = true;
        console.log("✅ Profile marked as complete");
      }
      
      // If a photo was uploaded, add the URL to the profile
      if (req.file) {
        console.log("📸 Processing uploaded photo:", req.file.filename);
        // Create a relative URL for the uploaded file
        updateData.profile.photoUrl = `/uploads/${req.file.filename}`;
      }
      
      console.log("📝 Update data to save:", updateData);
      
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      );
      
      if (!user) {
        console.log("❌ User not found for update");
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log("✅ Profile updated successfully:", user.profile);
      res.status(200).json({ message: 'Profile updated successfully', profile: user.profile });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

// Update user preferences
router.post("/preferences", authenticateJWT, async (req, res) => {
  try {
    console.log("Received preferences update request:", req.body);
    const userId = req.user.userId;
    const preferences = req.body.preferences;
    
    // Log important preference fields explicitly for debugging
    console.log("Looking For (Gender):", preferences.gender);
    console.log("Rent Budget:", preferences.rent);
    console.log("Location:", preferences.location);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.preferences = preferences;
    user.profileCompleted = true;
    await user.save();

    console.log("Updated user preferences:", user.preferences);
    res.status(200).json({ 
      message: "Preferences updated successfully", 
      preferences: user.preferences 
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({ message: "Error updating preferences" });
  }
});

// Get potential matches based on preferences
router.get('/matches', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Find the current user with their preferences
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if user has completed profile and preferences
    if (!user.profileCompleted || !user.preferences) {
      return res.status(400).json({ message: "Please complete your profile and preferences first" });
    }
    
    // Build match query
    const matchQuery = {
      _id: { $ne: userId }, // Exclude current user
      profileCompleted: true,
      preferences: { $exists: true }
    };
    
    // Add location filter if specified
    if (user.preferences.location) {
      matchQuery['preferences.location'] = user.preferences.location;
    }
    
    // Add gender filter if specified
    if (user.preferences.gender && user.preferences.gender !== 'Any') {
      matchQuery['preferences.gender'] = user.preferences.gender;
    }
    
    // Add rent budget filter if specified
    if (user.preferences.rent) {
      const userRent = parseInt(user.preferences.rent);
      matchQuery['preferences.rent'] = { $lte: userRent * 1.2 }; // Allow 20% higher budget
    }
    
    // Find potential matches
    const potentialMatches = await User.find(matchQuery)
      .select('username profile preferences')
      .lean();
    
    // Calculate compatibility scores
    const matches = potentialMatches.map(match => {
      let score = 0;
      let totalCategories = 0;
      
      // Compare each preference category
      const categories = ['cleanliness', 'smoking', 'pets', 'workSchedule', 'socialLevel', 'guestPreference', 'music'];
      
      categories.forEach(category => {
        if (user.preferences[category] && match.preferences[category]) {
          totalCategories++;
          if (user.preferences[category] === match.preferences[category]) {
            score += 1;
          }
        }
      });
      
      // Calculate final score as percentage
      const compatibilityScore = totalCategories > 0 ? (score / totalCategories) * 100 : 0;
      
      return {
        ...match,
        compatibilityScore
      };
    });
    
    // Filter matches with score >= 50% and sort by score
    const filteredMatches = matches
      .filter(match => match.compatibilityScore >= 50)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    
    res.status(200).json({ matches: filteredMatches });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ message: 'Error fetching matches' });
  }
});

// Send friend request
router.post("/friend-request", authenticateJWT, verificationMiddleware, async (req, res) => {
  try {
    let targetUserId = req.body.targetUserId;
    
    // Check for different parameter naming conventions
    if (!targetUserId) {
      if (req.body.recipientId) {
        targetUserId = req.body.recipientId;
        console.log('Using recipientId parameter:', targetUserId);
      } else if (req.body.userId) {
        targetUserId = req.body.userId;
        console.log('Using userId parameter:', targetUserId);
      }
    }
    
    const fromUserId = req.user.userId;

    console.log('From:', fromUserId);
    console.log('To:', targetUserId);
    
    if (!targetUserId) {
      console.error('❌ Target user ID is missing in the request');
      return res.status(400).json({ message: 'Target user ID is required' });
    }

    // Find the sender user to get their profile info
    const fromUser = await User.findById(fromUserId);
    if (!fromUser) {
      return res.status(404).json({ message: 'Sender user not found' });
    }

    // Find the target user
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      console.error('❌ Target user not found with ID:', targetUserId);
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if request already exists (either pending or rejected)
    const existingRequestIndex = targetUser.friendRequests.findIndex(
      request => request.from.toString() === fromUserId
    );

    // Prepare sender's profile data
    const senderData = {
      _id: fromUser._id,
      username: fromUser.username,
      fullName: fromUser.profile?.fullName || '',
      photoUrl: fromUser.profile?.photoUrl || null,
      bio: fromUser.profile?.bio || '',
      address: fromUser.profile?.address || '',
      phone: fromUser.profile?.phone || '',
      occupation: fromUser.profile?.occupation || '',
      emailVerified: fromUser.emailVerified || false
    };

    if (existingRequestIndex !== -1) {
      const existingRequest = targetUser.friendRequests[existingRequestIndex];
      
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ message: 'Friend request already sent' });
      } else if (existingRequest.status === 'rejected') {
        // Update the existing request back to pending and update sender data
        targetUser.friendRequests[existingRequestIndex].status = 'pending';
        targetUser.friendRequests[existingRequestIndex].fromUserData = senderData;
        await targetUser.save();
        
        console.log('✅ Rejected friend request updated to pending');
        
        // Broadcast notification to the target user
        const io = req.app.get('io');
        if (io) {
          const targetUserSocketIds = [];
          const activeUsers = req.app.get('activeUsers') || new Map();
          
          if (activeUsers.has(targetUserId)) {
            targetUserSocketIds.push(...activeUsers.get(targetUserId));
          }
          
          targetUserSocketIds.forEach(socketId => {
            io.to(socketId).emit('friendRequest', {
              from: fromUserId,
              fromUserData: senderData,
              message: 'You have received a new friend request'
            });
          });
        }
        
        return res.json({ message: 'Friend request sent successfully' });
      }
    }

    // Add friend request with sender's profile data
    targetUser.friendRequests.push({
      from: fromUserId,
      status: 'pending',
      fromUserData: senderData
    });

    await targetUser.save();
    
    console.log('✅ Friend request added successfully');

    // Broadcast notification to the target user using Socket.io
    const io = req.app.get('io');
    if (io) {
      const targetUserSocketIds = [];
      const activeUsers = req.app.get('activeUsers') || new Map();
      
      if (activeUsers.has(targetUserId)) {
        targetUserSocketIds.push(...activeUsers.get(targetUserId));
      }
      
      targetUserSocketIds.forEach(socketId => {
        io.to(socketId).emit('friendRequest', {
          from: fromUserId,
          fromUserData: senderData,
          message: 'You have received a new friend request'
        });
      });
    }

    res.json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ message: 'Error sending friend request' });
  }
});

// Handle friend request response (accept/reject)
router.post("/friend-request-response", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requestId, action } = req.body;
    
    if (!requestId || !action) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Find the request in the user's friend requests
    const requestIndex = user.friendRequests.findIndex(
      request => request._id.toString() === requestId
    );
    
    if (requestIndex === -1) {
      return res.status(404).json({ message: "Friend request not found" });
    }
    
    const request = user.friendRequests[requestIndex];
    
    if (action === 'accept') {
      // Add to friends list for both users
      if (!user.friends.includes(request.from)) {
        user.friends.push(request.from);
      }
      
      // Add the current user to the requester's friends list
      const requester = await User.findById(request.from);
      if (requester && !requester.friends.includes(userId)) {
        requester.friends.push(userId);
        await requester.save();
      }
      
      // Update request status
      user.friendRequests[requestIndex].status = 'accepted';
    } else if (action === 'reject') {
      // Update request status
      user.friendRequests[requestIndex].status = 'rejected';
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }
    
    await user.save();
    
    res.status(200).json({ message: `Friend request ${action}ed successfully` });
  } catch (error) {
    console.error("Error handling friend request response:", error);
    res.status(500).json({ message: "Error handling friend request response" });
  }
});

// Get friends list
router.get("/friends", authenticateJWT, async (req, res) => {
  try {
    console.log("📩 Friends list request received");
    const userId = req.user.userId;
    
    const user = await User.findById(userId)
      .populate('friends', '-password -friendRequests')
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    console.log(`✅ Retrieved ${user.friends.length} friends`);
    res.status(200).json({ friends: user.friends });
  } catch (error) {
    console.error("❌ Error getting friends list:", error);
    res.status(500).json({ message: "Error retrieving connections" });
  }
});

// Temporary route to fix invalid social level values
router.get('/fix-preferences', async (req, res) => {
  try {
    const result = await User.updateMany(
      { 'preferences.socialLevel': 'Private' },
      { $set: { 'preferences.socialLevel': 'Not Social' } }
    );
    
    console.log('Fixed preferences for users:', result);
    
    return res.status(200).json({
      message: 'Fixed preferences for users with invalid socialLevel',
      updated: result.modifiedCount
    });
  } catch (error) {
    console.error('Error fixing preferences:', error);
    return res.status(500).json({ message: 'Server error fixing preferences' });
  }
});

// Add this new route to fix preferences
router.put('/fix-preferences', async (req, res) => {
  try {
    const result = await User.updateMany(
      { 'preferences.socialLevel': 'Private' },
      { $set: { 'preferences.socialLevel': 'Not Social' } }
    );
    console.log('Fixed preferences for users:', result);
    res.json({ message: 'Fixed preferences for users with invalid socialLevel', updated: result.modifiedCount });
  } catch (error) {
    console.error('Error fixing preferences:', error);
    res.status(500).json({ message: 'Error fixing preferences' });
  }
});

// Unfriend route
router.post('/unfriend', authenticateJWT, async (req, res) => {
  try {
    console.log("📩 Unfriend request received");
    const { friendId } = req.body;
    const userId = req.user.userId;

    // Find both users
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user || !friend) {
      return res.status(404).json({ message: 'User or friend not found' });
    }

    // Remove friend from both users' friends lists
    user.friends = user.friends.filter(id => id.toString() !== friendId);
    friend.friends = friend.friends.filter(id => id.toString() !== userId);

    // Save both users
    await user.save();
    await friend.save();

    console.log("✅ Friend removed successfully");
    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error("❌ Error removing friend:", error);
    res.status(500).json({ message: 'Error removing friend' });
  }
});

// Add this new route to save and retrieve chat messages
router.post('/send-message', authenticateJWT, async (req, res) => {
  try {
    const { recipientId, message } = req.body;
    const senderId = req.user.userId;
    
    if (!recipientId || !message) {
      return res.status(400).json({ message: 'Recipient ID and message are required' });
    }
    
    // Create a unique conversation ID (smaller ID first for consistency)
    const participants = [senderId, recipientId].sort();
    const conversationId = `${participants[0]}_${participants[1]}`;
    
    // Check if both users are friends
    const sender = await User.findById(senderId);
    if (!sender.friends.includes(recipientId)) {
      return res.status(403).json({ message: 'You can only send messages to your friends' });
    }
    
    // Create message object
    const newMessage = {
      conversationId,
      sender: senderId,
      recipient: recipientId,
      text: message,
      timestamp: new Date()
    };
    
    // Save to database (would normally use a Message model)
    // For simplicity, we'll add to both users' messages array
    await User.findByIdAndUpdate(senderId, {
      $push: { messages: newMessage }
    });
    
    await User.findByIdAndUpdate(recipientId, {
      $push: { messages: newMessage }
    });
    
    // Send the message through WebSocket if recipient is online
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach((client) => {
        if (client.userId === recipientId) {
          client.send(JSON.stringify({
            type: 'new_message',
            message: newMessage
          }));
        }
      });
    }
    
    res.status(200).json({ 
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

router.get('/messages/:friendId', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    const friendId = req.params.friendId;
    
    // Check if they are friends
    const user = await User.findById(userId);
    if (!user.friends.includes(friendId)) {
      return res.status(403).json({ message: 'Can only view messages from friends' });
    }
    
    // Create the conversation ID (smaller ID first)
    const participants = [userId, friendId].sort();
    const conversationId = `${participants[0]}_${participants[1]}`;
    
    // Get messages for this conversation
    const messages = user.messages.filter(msg => 
      msg.conversationId === conversationId
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.status(200).json({ messages });
  } catch (error) {
    console.error('Error retrieving messages:', error);
    res.status(500).json({ message: 'Failed to retrieve messages' });
  }
});

// Get user profile by ID (for chats)
router.get('/profile/:userId', authenticateJWT, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    
    const user = await User.findById(targetUserId)
      .select('username profile')
      .lean();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

// Get all messages with a specific user
router.get('/messages/:userId', authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;
    
    // Get the user's messages
    const user = await User.findById(currentUserId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Filter messages between the current user and the specified user
    const messages = user.messages.filter(msg => 
      (msg.sender.toString() === userId && msg.recipient.toString() === currentUserId.toString()) || 
      (msg.sender.toString() === currentUserId.toString() && msg.recipient.toString() === userId)
    );
    
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all conversations for the current user
router.get('/conversations', authenticateJWT, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    
    // Get the user with messages
    const user = await User.findById(currentUserId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Group messages by conversation
    const conversations = {};
    
    // Process all messages
    user.messages.forEach(msg => {
      const partnerId = msg.sender.toString() === currentUserId.toString() 
        ? msg.recipient.toString() 
        : msg.sender.toString();
      
      if (!conversations[partnerId]) {
        conversations[partnerId] = {
          partnerId,
          messages: []
        };
      }
      
      conversations[partnerId].messages.push(msg);
    });
    
    // Convert to array and sort messages by timestamp
    const conversationArray = Object.values(conversations).map(conv => {
      // Sort messages by timestamp (oldest first)
      conv.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      return conv;
    });
    
    // Sort conversations by the timestamp of their most recent message (newest first)
    conversationArray.sort((a, b) => {
      const lastMsgA = a.messages[a.messages.length - 1];
      const lastMsgB = b.messages[b.messages.length - 1];
      return new Date(lastMsgB.timestamp) - new Date(lastMsgA.timestamp);
    });
    
    res.json({ conversations: conversationArray });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add the friend requests endpoint if it doesn't exist
router.get('/friend-requests', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Find the user with their friend requests
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    console.log('Friend requests for user:', userId);
    
    // Return the friend requests directly from the user object
    return res.status(200).json({
      requests: user.friendRequests || []
    });
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    return res.status(500).json({ message: 'Error fetching friend requests' });
  }
});

// Add the profile endpoint if it doesn't exist
router.get('/profile', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Find the user with their profile data
    const user = await User.findById(userId)
      .select('-password')
      .populate('friends', 'username profile preferences')
      .populate('friendRequests.from', 'username profile.fullName profile.photoUrl');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    console.log('Profile data retrieved for user:', userId);
    
    // Return the user object directly (not wrapped in another object)
    return res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ message: 'Error fetching user profile' });
  }
});

// Add the friends endpoint if it doesn't exist
router.get('/friends', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Find the user with their friends
    const user = await User.findById(userId).populate('friends', 'username profile preferences');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    console.log('Friends retrieved for user:', userId);
    
    // Return the friends list
    return res.status(200).json({
      friends: user.friends || []
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    return res.status(500).json({ message: 'Error fetching friends' });
  }
});

module.exports = router;
