import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

console.log("Signup Component is Rendering ✅");

const Signup = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    
    // Trim inputs
    const userData = { 
      username: username.trim(), 
      email: email.trim().toLowerCase(), 
      password 
    };
    
    // Client-side email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      setMessage("Please enter a valid email address format");
      setIsSuccess(false);
      setLoading(false);
      return;
    }
    
    // Validate password strength
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters long");
      setIsSuccess(false);
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post("http://localhost:5002/api/auth/register", userData);

      console.log("Signup Response:", response.data);

      if (response.status === 201) {
        // Store token in localStorage
        localStorage.setItem('token', response.data.token);
        
        // Store verification status
        localStorage.setItem('emailVerified', "false");
        
        setMessage("✅ Signup successful! Please verify your email address.");
        setIsSuccess(true);
        
        // Redirect to verification page with email info
        setTimeout(() => {
          navigate("/verify-email", { 
            state: { email: userData.email }
          });
        }, 2000);
      } else {
        setMessage(response.data.message || "❌ Signup failed. Try again.");
        setIsSuccess(false);
      }
    } catch (error) {
      console.error("Signup Error:", error);
      
      if (error.response?.data?.emailInvalid) {
        setMessage("Please enter a valid email address");
      } else if (error.response?.data?.emailExists) {
        setMessage(error.response.data.message || "This email is already registered");
      } else if (error.response?.data?.usernameExists) {
        setMessage(error.response.data.message || "This username is already taken");
      } else {
        setMessage(error.response?.data?.message || "❌ An error occurred. Please try again.");
      }
      
      setIsSuccess(false);
    } finally {
      setLoading(false);
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
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="6"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
            <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
          </div>

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
          <p className={`text-center font-semibold mt-4 ${isSuccess ? 'text-green-600' : 'text-red-500'}`}>
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
