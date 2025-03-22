const express = require("express");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
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
          return {
            _id: request._id,
            from: request.from._id,
            status: request.status,
            createdAt: request.createdAt,
            fromUser: {
              username: request.from.username,
              fullName: request.from.profile?.fullName || '',
              photoUrl: request.from.profile?.photoUrl || null
            }
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

// Utility functions for matching algorithm
// Calculate cosine similarity between two users' preferences
const calculateCosineSimilarity = (user1Prefs, user2Prefs) => {
  // Map preference categories to numerical values for calculation
  const prefValues = {
    // Cleanliness (1-4)
    'Very Clean': 4, 'Clean': 3, 'Moderately Clean': 2, 'Relaxed': 1,
    
    // Smoking (1-3)
    'No Smoking': 1, 'Outside Only': 2, 'Yes': 3,
    
    // Pets (1-3)
    'No Pets': 1, 'Has Pets': 2, 'Pet Friendly': 3,
    
    // Work Schedule (1-4)
    'Early Bird': 1, 'Night Owl': 2, 'Regular Hours': 3, 'Flexible': 4,
    
    // Social Level (1-4)
    'Very Social': 4, 'Moderately Social': 3, 'Private': 1, 'Varies': 2,
    
    // Guest Preference (1-3)
    'No Guests': 1, 'Occasional Guests': 2, 'Frequent Guests': 3,
    
    // Music (1-3)
    'Quiet Environment': 1, 'With Headphones': 2, 'Shared Music OK': 3
  };
  
  // Create vectors for both users
  const categories = ['cleanliness', 'smoking', 'pets', 'workSchedule', 'socialLevel', 'guestPreference', 'music'];
  const vector1 = [];
  const vector2 = [];
  
  // Build preference vectors
  categories.forEach(category => {
    const val1 = user1Prefs[category] ? prefValues[user1Prefs[category]] : 0;
    const val2 = user2Prefs[category] ? prefValues[user2Prefs[category]] : 0;
    vector1.push(val1);
    vector2.push(val2);
  });
  
  // Calculate cosine similarity
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  // Avoid division by zero
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  return dotProduct / (magnitude1 * magnitude2);
};

// Calculate Jaccard similarity for categorical data
const calculateJaccardSimilarity = (user1Prefs, user2Prefs) => {
  // Categories where exact matches are important
  const categories = ['cleanliness', 'smoking', 'pets', 'workSchedule', 'socialLevel', 'guestPreference', 'music'];
  
  let intersection = 0;
  let union = 0;
  
  categories.forEach(category => {
    const val1 = user1Prefs[category];
    const val2 = user2Prefs[category];
    
    if (val1 && val2) {
      union++;
      if (val1 === val2) {
        intersection++;
      }
    } else if (val1 || val2) {
      union++;
    }
  });
  
  // Avoid division by zero
  if (union === 0) return 0;
  
  return intersection / union;
};

// Get matches with profile information
router.get('/matches', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const currentUser = await User.findById(userId);
    
    if (!currentUser.preferences || !currentUser.profileCompleted) {
      return res.status(400).json({ message: "Please complete your preferences first" });
    }
    
    // Find all users except current user who have completed their profiles
    const potentialMatches = await User.find({
      _id: { $ne: userId },
      profileCompleted: true
    });
    
    const matchesWithScores = potentialMatches.map(user => {
      const cosineSimilarity = calculateCosineSimilarity(currentUser.preferences, user.preferences);
      const jaccardSimilarity = calculateJaccardSimilarity(currentUser.preferences, user.preferences);
      
      // Use weighted combination of both similarity measures
      const combinedScore = (cosineSimilarity * 0.7) + (jaccardSimilarity * 0.3);
      
      return {
        _id: user._id,
        userId: user._id,
        username: user.username,
        profile: user.profile, // Include the user's profile
        preferences: user.preferences,
        matchPercentage: Math.round(combinedScore * 100),
        cosineSimilarity: Math.round(cosineSimilarity * 100),
        jaccardSimilarity: Math.round(jaccardSimilarity * 100)
      };
    });
    
    // Sort by match percentage (highest first)
    const sortedMatches = matchesWithScores.sort((a, b) => b.matchPercentage - a.matchPercentage);
    
    res.status(200).json({ matches: sortedMatches });
  } catch (error) {
    console.error('Error finding matches:', error);
    res.status(500).json({ message: 'Error finding matches' });
  }
});

// Friend request routes
router.post('/friend-request', authMiddleware, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const fromUserId = req.user.userId;

    console.log('📩 Friend request received');
    console.log('From:', fromUserId);
    console.log('To:', targetUserId);

    // Find the target user
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if request already exists
    const existingRequest = targetUser.friendRequests.find(
      request => request.from.toString() === fromUserId && request.status === 'pending'
    );

    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    // Add friend request
    targetUser.friendRequests.push({
      from: fromUserId,
      status: 'pending'
    });

    await targetUser.save();

    // Broadcast notification to the target user
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach((client) => {
        if (client.userId === targetUserId.toString()) {
          client.send(JSON.stringify({
            type: 'friendRequest',
            from: fromUserId,
            message: 'You have received a new friend request'
          }));
        }
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

module.exports = router;
