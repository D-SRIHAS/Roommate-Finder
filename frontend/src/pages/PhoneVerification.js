import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './PhoneVerification.css';

const PhoneVerification = () => {
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const phoneNumber = location.state?.phoneNumber;

  const sendOTP = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5002/api/phone-verification/send-otp',
        { phoneNumber },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Check if we're in development mode and received an OTP
      if (response.data.developmentOtp) {
        setDevOtp(response.data.developmentOtp);
      }
      
      setMessage('OTP sent successfully');
      setCountdown(60);
      setError('');
    } catch (error) {
      setError(error.response?.data?.message || 'Error sending OTP');
    }
  }, [phoneNumber]);

  useEffect(() => {
    if (!phoneNumber) {
      navigate('/signup');
      return;
    }
    sendOTP();
  }, [phoneNumber, navigate, sendOTP]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:5002/api/phone-verification/verify-otp',
        { phoneNumber, otp },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setMessage('Phone number verified successfully');
      localStorage.setItem('phoneVerified', 'true');
      
      // Check if email is already verified
      const emailVerified = localStorage.getItem('emailVerified') === 'true';
      
      // Redirect to email verification if not verified, otherwise to dashboard
      setTimeout(() => {
        if (emailVerified) {
          navigate('/dashboard');
        } else {
          navigate('/verify-email');
        }
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.message || 'Error verifying OTP');
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5002/api/phone-verification/resend-otp',
        { phoneNumber },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Check if we're in development mode and received an OTP
      if (response.data.developmentOtp) {
        setDevOtp(response.data.developmentOtp);
      }
      
      setMessage('New OTP sent successfully');
      setCountdown(60);
      setError('');
    } catch (error) {
      setError(error.response?.data?.message || 'Error resending OTP');
    }
  };

  const handleDevOtpClick = () => {
    setOtp(devOtp);
  };

  return (
    <div className="phone-verification-container">
      <div className="phone-verification-box">
        <h2>Verify Your Phone Number</h2>
        <p>Enter the verification code sent to {phoneNumber}</p>
        
        <form onSubmit={handleVerifyOtp}>
          <div className="otp-input">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter OTP"
              maxLength="6"
              required
            />
          </div>
          
          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}
          
          {/* Development OTP helper */}
          {devOtp && (
            <div className="dev-otp-helper" onClick={handleDevOtpClick}>
              <p className="text-sm bg-yellow-100 p-2 rounded cursor-pointer border border-yellow-500 my-2">
                Development OTP: <strong>{devOtp}</strong> (Click to autofill)
              </p>
            </div>
          )}
          
          <button type="submit" className="verify-button">
            Verify OTP
          </button>
        </form>

        <div className="resend-section">
          {countdown > 0 ? (
            <p>Resend OTP in {countdown} seconds</p>
          ) : (
            <button onClick={handleResendOTP} className="resend-button">
              Resend OTP
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhoneVerification; 