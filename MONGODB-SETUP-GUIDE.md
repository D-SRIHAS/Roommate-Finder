# MongoDB Setup Guide for Email Verification System

This guide will help you set up MongoDB for the Email Verification System.

## Prerequisites

1. MongoDB installed locally or a MongoDB Atlas account
2. Node.js and npm installed

## Setup Steps

### 1. Install MongoDB Locally (Optional)

Skip this step if you're using MongoDB Atlas.

#### For macOS (using Homebrew):
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### For Windows:
Download and install from [MongoDB Download Center](https://www.mongodb.com/try/download/community)

#### For Linux (Ubuntu):
```bash
sudo apt update
sudo apt install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

### 2. Configure MongoDB Connection

Update the `.env` file in the backend directory:

```
PORT=5005
MONGODB_URI=mongodb://localhost:27017/email-verification
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

- For local MongoDB: `mongodb://localhost:27017/email-verification`
- For MongoDB Atlas: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/email-verification?retryWrites=true&w=majority`

### 3. Install Dependencies

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

### 4. Verify Connection

Run the server to verify the MongoDB connection:

```bash
npm run dev
```

You should see:
```
🚀 Server running on port 5005
✅ MongoDB connected successfully
📦 Database: email-verification on localhost:27017
```

## MongoDB Schema

The system uses the following MongoDB schema for OTP users:

```javascript
const otpUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  otp: {
    type: String,
    required: false
  },
  otpExpiry: {
    type: Date,
    required: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Automatically delete documents after 1 hour if not verified
  }
});
```

## Troubleshooting

1. **Connection Issues**: Check if MongoDB is running and if the connection URI is correct
2. **Authentication Failed**: Ensure you have the right username and password in your connection string
3. **Database Not Found**: The database will be created automatically if it doesn't exist
4. **Timeout Errors**: Check network connectivity or firewall settings

## MongoDB Compass (Optional)

MongoDB Compass is a GUI for MongoDB that makes it easier to view and manage your data:

1. Download and install [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Connect to your MongoDB instance:
   - Local: `mongodb://localhost:27017`
   - Atlas: Use the connection string from Atlas

## Security Considerations

1. Never commit your `.env` file to version control
2. Use a strong password for your MongoDB user
3. For production, enable authentication on your MongoDB server
4. Consider enabling SSL/TLS for secure connections

## Monitoring MongoDB

For production environments, consider monitoring your MongoDB instance using:
- MongoDB Atlas monitoring tools (if using Atlas)
- MongoDB Ops Manager
- Prometheus with MongoDB exporter
- Datadog or other monitoring services 