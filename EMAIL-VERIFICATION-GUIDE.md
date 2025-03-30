# Email Verification System Guide

## Overview

The email verification system for Roommate Finder allows users to verify their email addresses through two methods:
1. **One-Time Password (OTP)** - A 6-digit code sent to the user's email
2. **Verification Link** - A link with a JWT token that verifies the user's email when clicked

This system ensures that users have access to the email addresses they registered with, increasing security and reliability.

## Features

- **Dual Verification Methods**: Users can choose between OTP or email link verification
- **Automatic Verification on Registration**: Both verification methods are sent upon registration
- **Required Verification for Critical Actions**: Friend requests, messaging, and other sensitive actions require verified emails
- **Secure Token Management**: JWT tokens for verification links expire after 24 hours
- **OTP Expiry**: One-time passwords expire after 5 minutes
- **Resend Functionality**: Users can request new verification emails/OTPs if needed
- **Seamless Redirection**: After successful verification, users are automatically redirected to the dashboard
- **Email Validation**: System checks if the email exists before sending verification to prevent misuse
- **Signup Guidance**: Redirects users to registration when attempting to verify non-registered emails
- **Email Deliverability Checks**: Detects and reports when emails cannot be delivered due to invalid addresses

## Technical Implementation

### Backend (Express.js)

#### Routes
- `POST /api/auth/send-otp`: Send a 6-digit verification code
- `POST /api/auth/verify-otp`: Verify the 6-digit code
- `POST /api/auth/send-verification-email`: Send an email with a verification link
- `POST /api/auth/verify-email-token`: Verify the token from the link
- `POST /api/auth/resend-verification`: Resend either OTP or verification link

#### Models
- `User`: Contains `emailVerified` flag to track verification status
- `OtpUser`: Temporarily stores OTPs and their expiry times

#### Middleware
- `verificationMiddleware`: Protects routes that require email verification

### Frontend (React)

#### Components
- `EmailVerification`: Handles both OTP and link verification methods
- Token verification is handled automatically when users click email links

#### Routes
- `/verify-email`: Manual verification page where users can request and enter OTPs
- `/verify-email-token`: Handles verification via email links with token parameter

### Email Deliverability Handling

The system includes comprehensive error handling for email deliverability issues:

- **Client-side Validation**: Validates email format before sending to server
- **Server-side Validation**: Checks email format and existence in database
- **SMTP Error Detection**: Captures specific SMTP errors like "Address not found" or "Unable to receive mail"
- **User-friendly Messages**: Displays clear error messages when emails cannot be delivered
- **Alternative Actions**: Provides options to try a different email address or register when appropriate
- **Visual Indicators**: Shows warning banners for email deliverability issues

## Security Features

- OTPs expire after 5 minutes
- Verification tokens expire after 24 hours
- Hashed passwords and secure token creation
- Protection against brute force attempts
- Rate limiting for verification requests
- Email existence validation to prevent spamming non-existent addresses
- Clear error messaging for non-existent emails with guidance to register
- Detection of undeliverable email addresses

## User Flow

### Registration
1. User registers with email and password
2. Registration validates email format before creating the account
3. User is directed to dashboard but with limited functionality until verification

### Manual Verification
1. User navigates to `/verify-email`
2. User enters their email and chooses verification method
3. If email exists, OTP or link is sent to their email
4. If email doesn't exist, user is prompted to register first
5. If email is undeliverable, user receives a clear error message
6. User completes verification 
7. User can now access all features

### Link Verification
1. User clicks on verification link in email
2. System validates the token
3. User's email is marked as verified
4. User is redirected to dashboard with full functionality

## Environment Configuration

Required environment variables:
- `JWT_SECRET`: Secret key for JWT token generation
- `EMAIL_USERNAME`: Email account for sending verification emails
- `EMAIL_PASSWORD`: Password or app password for the email account
- `FRONTEND_URL`: Base URL for the frontend (for email links)

## Troubleshooting

- If verification emails aren't received, check spam folders
- For persistent issues, users can try the alternative verification method
- If verification link doesn't work, users should try the OTP method
- If OTP verification fails, users can request a new code or try the link method
- If the system indicates an email doesn't exist, the user needs to register first
- If emails can't be delivered to an address, check the email is spelled correctly and is a valid address
- For undeliverable email errors, try using a different email provider (Gmail, Outlook, etc.)

## Development Notes

- Debug mode can be enabled in `nodemailer.js` to log emails instead of sending them
- MongoDB connection can be configured through environment variables
- Email templates can be customized in the `nodemailer.js` file
- Check server logs for OTP or verification links during testing
- Look for "Email delivery error" messages in logs to diagnose email sending issues 