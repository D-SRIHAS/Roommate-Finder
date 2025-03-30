# Email Verification with OTP

This project implements email verification using OTP (One-Time Password) in a MERN (MongoDB, Express, React, Node.js) stack application.

## Features

- Send 6-digit OTP to user's email
- Verify OTP with expiration time (5 minutes)
- Resend OTP functionality
- User-friendly UI with timer countdown
- Secure OTP generation using Node.js crypto module
- Email notifications using Nodemailer

## Project Structure

```
/backend
  ├── config/
  │   └── nodemailer.js       # Email configuration
  ├── controllers/
  │   └── authController.js   # OTP generation and verification logic
  ├── models/
  │   └── OtpUser.js          # User model for OTP storage
  ├── routes/
  │   └── auth.js             # API routes
  ├── .env                    # Environment variables
  ├── email-server.js         # Express server setup
  └── package.json            # Dependencies

/frontend
  ├── src/
  │   ├── components/
  │   │   ├── EmailVerification.js        # Email input component
  │   │   ├── OTPVerificationComponent.js # OTP verification component
  │   │   └── EmailOtpVerification.js     # Main component
  │   └── api.js              # API service
  └── package.json            # Dependencies
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   PORT=5005
   MONGODB_URI=mongodb://localhost:27017/email-verification
   EMAIL_USERNAME=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   ```
   
   Note: For Gmail, you need to use an app password. Generate one at: https://myaccount.google.com/security → App passwords

4. Start the server:
   ```
   npm start
   ```
   
   For development with auto-restart:
   ```
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file (optional):
   ```
   REACT_APP_API_URL=http://localhost:5005/api
   ```

4. Start the development server:
   ```
   npm start
   ```

## Usage

1. Enter your email address and click "Send OTP"
2. Check your email for the 6-digit OTP
3. Enter the OTP in the verification screen
4. If the OTP is correct, you'll see the successful verification screen

## API Endpoints

- `POST /api/auth/send-otp`: Send OTP to email
  - Request: `{ "email": "user@example.com" }`
  - Response: `{ "success": true, "message": "OTP sent to your email", "expiresIn": "5 minutes" }`

- `POST /api/auth/verify-otp`: Verify OTP
  - Request: `{ "email": "user@example.com", "otp": "123456" }`
  - Response: `{ "success": true, "message": "Email verified successfully" }` 