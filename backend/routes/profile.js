const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateJWT } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Get profile
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile
router.put('/', authenticateJWT, async (req, res) => {
  try {
    console.log('Profile update request received');
    console.log('Request body:', req.body);
    
    let profileData = req.body.profile;
    
    // Handle the case where profile might be a JSON string
    if (typeof profileData === 'string') {
      try {
        profileData = JSON.parse(profileData);
        console.log('Successfully parsed profile data from JSON string');
      } catch (parseError) {
        console.error('Error parsing profile data:', parseError);
        return res.status(400).json({ message: 'Invalid profile data format' });
      }
    }
    
    if (!profileData) {
      console.error('Missing profile data in request');
      return res.status(400).json({ message: 'Profile data is required' });
    }
    
    console.log('Processed profile data:', profileData);
    
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      console.error('User not found:', req.user.userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update profile fields
    user.profile = { ...user.profile, ...profileData };
    
    // Check if required fields are filled to mark profile as complete
    if (profileData.fullName && profileData.address) {
      user.profileCompleted = true;
      console.log('Profile marked as complete');
    }
    
    await user.save();
    
    console.log('Profile updated successfully:', user.profile);
    res.json({ 
      message: 'Profile updated successfully', 
      profile: user.profile,
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        profile: user.profile,
        profileCompleted: user.profileCompleted
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload profile photo
router.post('/photo', authenticateJWT, upload.single('photo'), async (req, res) => {
  try {
    console.log('Photo upload request received');
    
    if (!req.file) {
      console.error('No file uploaded in request');
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    console.log('Uploaded file:', req.file);
    
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      console.error('User not found:', req.user.userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    // If user already has a profile photo, delete it
    if (user.profile?.photoUrl && !user.profile.photoUrl.startsWith('http')) {
      const oldPhotoPath = path.join(__dirname, '..', user.profile.photoUrl);
      console.log('Checking for existing photo at:', oldPhotoPath);
      
      if (fs.existsSync(oldPhotoPath)) {
        console.log('Deleting old photo:', oldPhotoPath);
        fs.unlinkSync(oldPhotoPath);
      }
    }
    
    // Update photo URL in user profile
    const photoUrl = `/uploads/${req.file.filename}`;
    console.log('New photo URL:', photoUrl);
    
    if (!user.profile) {
      user.profile = { photoUrl };
    } else {
      user.profile.photoUrl = photoUrl;
    }
    
    await user.save();
    
    console.log('Profile photo updated successfully');
    res.json({ 
      message: 'Profile photo uploaded successfully', 
      photoUrl: photoUrl,
      user: {
        _id: user._id,
        profile: {
          photoUrl: user.profile.photoUrl
        }
      }
    });
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update preferences
router.put('/preferences', authenticateJWT, async (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!preferences) {
      return res.status(400).json({ message: 'Preferences data is required' });
    }
    
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update preferences
    user.preferences = { ...user.preferences, ...preferences };
    
    await user.save();
    
    res.json({ message: 'Preferences updated successfully', user });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 