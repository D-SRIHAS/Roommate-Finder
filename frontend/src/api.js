import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5005/api';

// API service for email verification
const api = {
  // Send OTP to email
  sendOTP: async (email) => {
    try {
      const response = await axios.post(`${API_URL}/auth/send-otp`, { email });
      return response.data;
    } catch (error) {
      console.error('Error sending OTP:', error.response?.data || error.message);
      throw error.response?.data || { success: false, message: error.message };
    }
  },
  
  // Verify OTP
  verifyOTP: async (email, otp) => {
    try {
      const response = await axios.post(`${API_URL}/auth/verify-otp`, { email, otp });
      return response.data;
    } catch (error) {
      console.error('Error verifying OTP:', error.response?.data || error.message);
      throw error.response?.data || { success: false, message: error.message };
    }
  },
};

export default api; 