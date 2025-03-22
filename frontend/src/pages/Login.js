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
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    
    // Trim inputs
    const trimmedEmail = email.trim().toLowerCase();
    
    try {
      // Clear any existing token to handle expired tokens
      localStorage.removeItem('token');
      
      console.log("Attempting login with:", { email: trimmedEmail, password });
      
      const response = await axios.post("http://localhost:5002/api/auth/login", {
        email: trimmedEmail,
        password
      });

      console.log("Login Response:", response.data);

      // Successfully logged in
      localStorage.setItem('token', response.data.token);
      setIsSuccess(true);
      setMessage("✅ Login successful! Redirecting...");
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (error) {
      console.error("Login Error:", error);
      setIsSuccess(false);
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (error.response.status === 400) {
          setMessage("❌ Invalid email or password. Try again.");
        } else {
          setMessage(error.response.data.message || "❌ An error occurred. Please try again.");
        }
      } else if (error.request) {
        // The request was made but no response was received
        setMessage("❌ Could not connect to the server. Please check your internet connection.");
      } else {
        // Something happened in setting up the request that triggered an Error
        setMessage("❌ An error occurred. Please try again.");
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

        {message && (
          <p className={`text-center font-semibold mt-4 ${isSuccess ? 'text-green-600' : 'text-red-500'}`}>
            {message}
          </p>
        )}

        <p className="text-center text-gray-600 mt-6">
          Don't have an account?{" "}
          <Link to="/signup" className="text-blue-500 hover:underline font-semibold">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
