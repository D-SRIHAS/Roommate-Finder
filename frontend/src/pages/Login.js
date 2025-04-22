import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

console.log("Login Component is Rendering ✅");

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const isRedirectingRef = useRef(false);

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !isRedirectingRef.current) {
      isRedirectingRef.current = true;
      console.log("Token found, redirecting to dashboard");
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isRedirectingRef.current) {
      console.log("Already redirecting, ignoring duplicate submit");
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Clear any existing token first
      localStorage.removeItem('token');
      
      console.log("Attempting login with:", email);
      
      // Ensure we're using the correct URL with window.process.env
      const backendUrl = window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';
      console.log("Using backend URL:", backendUrl);
      
      const response = await axios.post(`${backendUrl}/api/auth/login`, {
        email,
        password
      });
      
      console.log("Login successful, response:", response.data);
      
      // Store token in localStorage
      localStorage.setItem('token', response.data.token);
      
      // Store verification status
      localStorage.setItem('emailVerified', response.data.user.emailVerified);
      
      // Store user data
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Check if email verification is required
      if (response.data.requireVerification) {
        // Redirect to verification page with email
        console.log("Email verification required, redirecting to verification page");
        navigate('/verify-email', {
          state: { email: email },
          replace: true
        });
        return;
      }
      
      // If verification is complete, go to dashboard
      console.log("Redirecting to dashboard...");
      isRedirectingRef.current = true;
      
      // Using replace: true to prevent back button from returning to login
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      setError(error.response?.data?.message || 'An error occurred during login');
      isRedirectingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    console.log("Email changed:", e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    console.log("Password changed:", e.target.value);
  };

  return (
    <div
      className="flex justify-center items-center min-h-screen w-full bg-cover bg-center bg-blue-50"
      style={{ backgroundImage: "url('/assets/bg-roommates.jpg')" }}
    >
      <div className="bg-white bg-opacity-90 p-8 rounded-xl shadow-lg w-96 border border-blue-100">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            <span className="text-blue-500">Roommate</span>
            <span className="text-gray-700">Finder</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Find your perfect roommate match</p>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Login to Your Account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-gray-700 font-medium">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
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
              type="password"
              value={password}
              onChange={handlePasswordChange}
              required
              autoComplete="current-password"
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className={`w-full bg-blue-500 text-white py-2 rounded-lg transition-all transform hover:bg-blue-600 hover:shadow-lg ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        {error && (
          <p className="text-center font-semibold mt-4 text-red-500">
            {error}
          </p>
        )}

        <p className="text-center text-gray-600 mt-6">
          Don't have an account?{" "}
          <Link to="/signup" className="text-blue-500 hover:underline font-semibold">
            Sign up
          </Link>
        </p>
        
        <p className="text-center text-gray-600 mt-3">
          Need to verify your email?{" "}
          <Link 
            to="/verify-email" 
            state={{ email: email }} 
            className="text-blue-500 hover:underline font-semibold"
          >
            Verify email
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
