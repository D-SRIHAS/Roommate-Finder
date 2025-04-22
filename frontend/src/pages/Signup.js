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
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    console.log(`${name} changed:`, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    
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
        setLoading(false);
        return;
      }

      // Validate phone number format (basic validation)
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(trimmedData.phoneNumber)) {
        setError('Please enter a valid phone number');
        setLoading(false);
        return;
      }

      // Get backend URL from window.process.env
      const backendUrl = window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';
      console.log("Using backend URL for signup:", backendUrl);

      const response = await axios.post(`${backendUrl}/api/auth/register`, trimmedData);
      
      if (response.status === 201) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('emailVerified', 'false');
        localStorage.setItem('phoneVerified', 'false');
        
        // Store user data
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        setMessage('Account created successfully! Please verify your email and phone number.');
        setTimeout(() => {
          navigate('/verify-email', { state: { email: trimmedData.email } });
        }, 2000);
      }
    } catch (error) {
      console.error("Signup error:", error);
      setError(error.response?.data?.message || 'Error creating account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex justify-center items-center min-h-screen bg-blue-50 bg-cover bg-center"
      style={{ backgroundImage: "url('/assets/bg-roommates.jpg')" }}
    >
      <div
        className="bg-white bg-opacity-90 p-8 rounded-xl shadow-lg w-96 transform transition-all 
                 hover:shadow-xl border border-blue-100"
      >
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            <span className="text-blue-500">Roommate</span>
            <span className="text-gray-700">Finder</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Find your perfect roommate match</p>
        </div>

        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Create an Account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-gray-700 font-medium">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              required
              autoComplete="username"
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-gray-700 font-medium">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-gray-700 font-medium">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
              autoComplete="new-password"
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
          </div>

          <div>
            <label htmlFor="phoneNumber" className="block text-gray-700 font-medium">Phone Number</label>
            <input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={handleChange}
              required
              autoComplete="tel"
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              disabled={loading}
            />
          </div>

          {error && <div className="text-red-500 text-center font-semibold">{error}</div>}

          <button
            type="submit"
            className={`w-full bg-blue-500 text-white py-2 rounded-lg transition-all transform 
                    hover:bg-blue-600 hover:shadow-lg ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            disabled={loading}
          >
            {loading ? 'Signing Up...' : 'Sign Up'}
          </button>
        </form>

        {/* Signup Message */}
        {message && (
          <p className="text-center font-semibold mt-4 text-blue-500">
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
