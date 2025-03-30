import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

console.log("Login Component is Rendering ✅");

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      // Clear any existing token first
      localStorage.removeItem('token');
      
      const response = await axios.post('http://localhost:5002/api/auth/login', {
        email,
        password
      });
      
      // Store token in localStorage
      localStorage.setItem('token', response.data.token);
      
      // Store verification status
      localStorage.setItem('emailVerified', response.data.user.emailVerified);
      
      // Check if verification is required
      if (response.data.requireVerification) {
        // Redirect to verification page with email
        navigate('/verify-email', {
          state: { email: email }
        });
        return;
      }
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex justify-center items-center min-h-screen w-full bg-cover bg-center"
      style={{ backgroundImage: "url('/assets/bg-roommates.jpg')" }}
    >
      <div className="bg-white bg-opacity-90 p-8 rounded-xl shadow-2xl w-96">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Login to Your Account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className={`w-full bg-blue-600 text-white py-2 rounded-lg transition-all transform hover:scale-105 hover:shadow-lg ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
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
            className="text-green-500 hover:underline font-semibold"
          >
            Verify email
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
