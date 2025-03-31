import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

console.log("Signup Component is Rendering ✅");

const Signup = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phoneNumber: ''
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    try {
      // Trim all inputs
      const trimmedData = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password.trim(),
        phoneNumber: formData.phoneNumber.trim()
      };

      // Validate password strength
      if (trimmedData.password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      // Validate phone number format (basic validation)
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(trimmedData.phoneNumber)) {
        setError('Please enter a valid phone number');
        return;
      }

      const response = await axios.post('http://localhost:5002/api/auth/register', trimmedData);
      
      if (response.status === 201) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('emailVerified', 'false');
        localStorage.setItem('phoneVerified', 'false');
        
        // Store user data
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        setMessage('Account created successfully! Please verify your email and phone number.');
        setTimeout(() => {
          navigate('/phone-verification', { state: { phoneNumber: trimmedData.phoneNumber } });
        }, 2000);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error creating account');
    }
  };

  return (
    <div
      className="flex justify-center items-center min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/assets/bg-roommates.jpg')" }}
    >
      <div
        className="bg-white bg-opacity-80 p-8 rounded-xl shadow-2xl w-96 transform transition-all 
                   hover:translate-x-2 hover:shadow-lg"
        style={{ marginLeft: "5vw" }} // Slightly moved to the right
      >
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Create an Account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-medium">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength="6"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
            <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
          </div>

          <div>
            <label className="block text-gray-700 font-medium">Phone Number</label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg transition-all transform 
                       hover:translate-x-2 hover:shadow-lg hover:scale-105"
          >
            Sign Up
          </button>
        </form>

        {/* Signup Message */}
        {message && (
          <p className="text-center font-semibold mt-4">
            {message}
          </p>
        )}

        {/* "Already have an account?" stays inside the signup box */}
        <p className="text-center text-gray-600 mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-500 hover:underline font-semibold">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
