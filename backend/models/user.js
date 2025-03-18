const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  preferences: {
    cleanliness: {
      type: String,
      enum: ['Very Clean', 'Moderately Clean', 'Somewhat Messy', 'Messy'],
      default: null,
    },
    smoking: {
      type: String,
      enum: ['No Smoking', 'Outside Only', 'Smoking Friendly'],
      default: null,
    },
    pets: {
      type: String,
      enum: ['No Pets', 'Pet Friendly', 'Has Pets'],
      default: null,
    },
    workSchedule: {
      type: String,
      enum: ['Regular Hours', 'Flexible Hours', 'Night Owl'],
      default: null,
    },
    socialLevel: {
      type: String,
      enum: ['Very Social', 'Moderately Social', 'Occasionally Social', 'Not Social'],
      default: null,
    },
    guestPreference: {
      type: String,
      enum: ['Frequent Guests', 'Occasional Guests', 'Rare Guests', 'No Guests'],
      default: null,
    },
    music: {
      type: String,
      enum: ['Shared Music OK', 'With Headphones', 'Quiet Environment'],
      default: null,
    },
  },
  profile: {
    fullName: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    occupation: {
      type: String,
      default: "",
    },
    photoUrl: {
      type: String,
      default: null,
    },
  },
  profileCompleted: {
    type: Boolean,
    default: false,
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  friendRequests: [{
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending"
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

const User = mongoose.model("User", userSchema);

module.exports = User;
