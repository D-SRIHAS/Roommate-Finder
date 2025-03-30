const express = require("express");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const verificationMiddleware = require("../middleware/verificationMiddleware");
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const router = express.Router();

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
  .get(authMiddleware, async (req, res) => {
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

      if (user.friendRequests && user.friendRequests.length > 0) {
        user.friendRequests = user.friendRequests.map(request => {
          // Return fromUserData if available, otherwise fallback to populated from field
          // This ensures compatibility with both old and new request formats
          const fromUserData = request.fromUserData || {
            username: request.from.username,
            fullName: request.from.profile?.fullName || '',
            photoUrl: request.from.profile?.photoUrl || null,
            bio: request.from.profile?.bio || '',
            address: request.from.profile?.address || '',
            phone: request.from.profile?.phone || '',
            occupation: request.from.profile?.occupation || '',
            emailVerified: request.from.emailVerified || false
          };
          
          return {
            _id: request._id,
            from: request.from._id,
            status: request.status,
            createdAt: request.createdAt,
            fromUser: {
              username: request.from.username,
              fullName: request.from.profile?.fullName || '',
              photoUrl: request.from.profile?.photoUrl || null,
              bio: request.from.profile?.bio || '',
              address: request.from.profile?.address || '',
              phone: request.from.profile?.phone || '',
              occupation: request.from.profile?.occupation || '',
              emailVerified: request.from.emailVerified || false
            },
            fromUserData: fromUserData
          };
        });
      }

      console.log("✅ Sending profile data");
      res.status(200).json(user);
    } catch (error) {
      console.error("🚨 Error fetching profile:", error);
      res.status(500).json({ message: "Error fetching profile" });
    }
  })
  .put(authMiddleware, upload.single('photo'), async (req, res) => {
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
router.post("/preferences", authMiddleware, async (req, res) => {
  try {
    console.log("Received preferences update request:", req.body);
    const userId = req.user.userId;
    const preferences = req.body.preferences;

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

// Get matches with profile information
router.get('/matches', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log("📩 Matches request received for user:", userId);
    
    const currentUser = await User.findById(userId);
    
    if (!currentUser.preferences || !currentUser.profileCompleted) {
      console.log("❌ User has not completed profile or preferences");
      return res.status(400).json({ message: "Please complete your preferences first" });
    }
    
    // Find all users except current user who have completed their profiles
    const potentialMatches = await User.find({
      _id: { $ne: userId },
      profileCompleted: true
    });
    
    console.log(`📊 Found ${potentialMatches.length} potential matches`);
    
    const matchesWithScores = potentialMatches.map(user => {
      console.log(`Processing match with user: ${user.username}`);

      // Set default numerical values for categories based on preference values
      const numericalPrefs = {
        // Cleanliness: Very Clean (4), Moderately Clean (3), Somewhat Messy (2), Messy (1)
        cleanliness: { 'Very Clean': 4, 'Moderately Clean': 3, 'Somewhat Messy': 2, 'Messy': 1 },
        // Smoking: No Smoking (1), Outside Only (2), Smoking Friendly (3)
        smoking: { 'No Smoking': 1, 'Outside Only': 2, 'Smoking Friendly': 3 },
        // Pets: No Pets (1), Pet Friendly (2), Has Pets (3)
        pets: { 'No Pets': 1, 'Pet Friendly': 2, 'Has Pets': 3 },
        // Work Schedule: Regular Hours (1), Flexible Hours (2), Night Owl (3)
        workSchedule: { 'Regular Hours': 1, 'Flexible Hours': 2, 'Night Owl': 3 },
        // Social Level: Very Social (4), Moderately Social (3), Occasionally Social (2), Not Social (1)
        socialLevel: { 'Very Social': 4, 'Moderately Social': 3, 'Occasionally Social': 2, 'Not Social': 1 },
        // Guest Preference: Frequent Guests (4), Occasional Guests (3), Rare Guests (2), No Guests (1)
        guestPreference: { 'Frequent Guests': 4, 'Occasional Guests': 3, 'Rare Guests': 2, 'No Guests': 1 },
        // Music: Shared Music OK (3), With Headphones (2), Quiet Environment (1)
        music: { 'Shared Music OK': 3, 'With Headphones': 2, 'Quiet Environment': 1 }
      };
      
      // Track similarities
      let similarityScore = 0;
      let maxPossibleScore = 0;
      
      // Calculate similarity for each preference category
      for (const category in numericalPrefs) {
        const currentUserValue = currentUser.preferences[category];
        const matchUserValue = user.preferences[category];
        
        // Skip if either user doesn't have this preference set
        if (!currentUserValue || !matchUserValue) {
          console.log(`Skipping ${category} - values missing (current: ${currentUserValue}, match: ${matchUserValue})`);
          continue;
        }
        
        // Get numerical values
        const currentUserNum = numericalPrefs[category][currentUserValue];
        const matchUserNum = numericalPrefs[category][matchUserValue];
        
        if (typeof currentUserNum !== 'number' || typeof matchUserNum !== 'number') {
          console.log(`Invalid numerical mapping for ${category}: ${currentUserValue}=${currentUserNum}, ${matchUserValue}=${matchUserNum}`);
          continue;
        }
        
        // Calculate how similar they are (closer = better match)
        const diff = Math.abs(currentUserNum - matchUserNum);
        const maxDiff = Math.max(...Object.values(numericalPrefs[category])) - 
                      Math.min(...Object.values(numericalPrefs[category]));
        const categoryScore = 1 - (diff / maxDiff);
        
        console.log(`${category}: ${currentUserValue}(${currentUserNum}) vs ${matchUserValue}(${matchUserNum}) = ${categoryScore.toFixed(2)}`);
        
        // Add to total scores
        similarityScore += categoryScore;
        maxPossibleScore += 1;
      }
      
      // Calculate final percentage
      let matchPercentage = 0;
      if (maxPossibleScore > 0) {
        matchPercentage = Math.round((similarityScore / maxPossibleScore) * 100);
      }
      
      console.log(`Final match with ${user.username}: ${matchPercentage}%`);
      
      return {
        _id: user._id,
        userId: user._id,
        username: user.username,
        profile: user.profile,
        preferences: user.preferences,
        matchPercentage: matchPercentage,
        cosineSimilarity: Math.round(matchPercentage * 0.7),
        jaccardSimilarity: Math.round(matchPercentage * 0.3)
      };
    });
    
    // Sort by match percentage (highest first)
    const sortedMatches = matchesWithScores.sort((a, b) => b.matchPercentage - a.matchPercentage);
    
    if (sortedMatches.length > 0) {
      console.log("✅ First match example:", {
        matchPercentage: sortedMatches[0].matchPercentage,
        username: sortedMatches[0].username
      });
    }
    
    console.log(`✅ Sending ${sortedMatches.length} matches`);
    res.status(200).json({ matches: sortedMatches });
  } catch (error) {
    console.error('Error finding matches:', error);
    res.status(500).json({ message: 'Error finding matches' });
  }
});

// Send friend request
router.post("/friend-request", authMiddleware, verificationMiddleware, async (req, res) => {
  try {
    let targetUserId = req.body.targetUserId;
    
    // Fallback to userId if targetUserId is not provided
    if (!targetUserId && req.body.userId) {
      targetUserId = req.body.userId;
      console.log('Found userId instead of targetUserId, using it as fallback');
    }
    
    const fromUserId = req.user.userId;

    console.log('From:', fromUserId);
    console.log('To:', targetUserId);
    
    if (!targetUserId) {
      console.error('❌ targetUserId is missing in the request');
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
router.post("/friend-request-response", authMiddleware, async (req, res) => {
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
router.get("/friends", authMiddleware, async (req, res) => {
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
router.post('/unfriend', authMiddleware, async (req, res) => {
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
router.post('/send-message', authMiddleware, async (req, res) => {
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

router.get('/messages/:friendId', authMiddleware, async (req, res) => {
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
router.get('/profile/:userId', authMiddleware, async (req, res) => {
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
router.get('/messages/:userId', authMiddleware, async (req, res) => {
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
router.get('/conversations', authMiddleware, async (req, res) => {
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

module.exports = router;
