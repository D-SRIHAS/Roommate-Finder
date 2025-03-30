import React, { useState, useEffect, useRef } from 'react';
import api from '../api';

const OTPVerificationComponent = ({ email, onVerificationSuccess, onBackToEmail }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(300); // 5 minutes in seconds
  const [isResending, setIsResending] = useState(false);
  
  const inputRefs = useRef([]);

  // Initialize input refs
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  // Format timer to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (index, value) => {
    // Allow only digits
    if (/^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Clear messages when OTP changes
      setMessage('');
      setError('');

      // Auto-focus to next input field
      if (value && index < 5) {
        inputRefs.current[index + 1].focus();
      }
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace to move to previous input
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    
    // If pasted data is a 6-digit number
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtp(digits);
      
      // Focus the last input
      inputRefs.current[5].focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous messages
    setMessage('');
    setError('');

    // Validate OTP
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      const response = await api.verifyOTP(email, otpValue);
      
      if (response.success) {
        setMessage(response.message || 'Email verified successfully');
        
        // Call the success callback
        if (onVerificationSuccess) {
          setTimeout(() => {
            onVerificationSuccess();
          }, 1500);
        }
      } else {
        setError(response.message || 'Failed to verify OTP');
      }
    } catch (error) {
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (isResending) return;
    
    try {
      setIsResending(true);
      setError('');
      setMessage('');
      
      const response = await api.sendOTP(email);
      
      if (response.success) {
        setMessage('OTP has been resent to your email');
        setTimer(300); // Reset timer to 5 minutes
        setOtp(['', '', '', '', '', '']); // Clear OTP fields
      } else {
        setError(response.message || 'Failed to resend OTP');
      }
    } catch (error) {
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">OTP Verification</h2>
      
      <p className="text-center text-gray-600 mb-6">
        Enter the 6-digit code sent to {email}
      </p>
      
      <form onSubmit={handleSubmit} onPaste={handlePaste}>
        <div className="flex justify-center mb-6 gap-2">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              maxLength={1}
              className="w-12 h-12 text-center text-xl border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={loading}
              autoFocus={index === 0}
            />
          ))}
        </div>
        
        <div className="text-center mb-4">
          <p className="text-sm text-gray-600">
            Time remaining: <span className={timer < 60 ? 'text-red-500' : 'text-gray-600'}>{formatTime(timer)}</span>
          </p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        {message && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
            {message}
          </div>
        )}
        
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors mb-4"
          disabled={loading || otp.join('').length !== 6}
        >
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>
        
        <div className="flex justify-between">
          <button
            type="button"
            className="text-sm text-blue-600 hover:text-blue-800"
            onClick={onBackToEmail}
          >
            Change Email
          </button>
          
          <button
            type="button"
            className={`text-sm ${timer > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
            onClick={handleResendOtp}
            disabled={timer > 0 || isResending}
          >
            {isResending ? 'Resending...' : 'Resend OTP'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OTPVerificationComponent; 