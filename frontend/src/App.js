import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import React, { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import EmailVerification from "./pages/EmailVerification";
import PreferenceFormPage from './pages/PreferenceFormPage';
import About from './pages/About';

// Private route component to protect routes
const PrivateRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    // Still checking authentication
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    console.log("No token found, redirecting to login");
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // Initialize app state
  useEffect(() => {
    setIsLoading(false);
  }, []);

  // Setup socket connection
  const setupSocket = useCallback(() => {
    // Socket.io connection with error handling
    const token = localStorage.getItem('token');
    if (!token) return null; // Don't connect if no token
    
    try {
      // Get socket URL from window.process.env
      const socketUrl = window.process.env.REACT_APP_SOCKET_URL || 'http://localhost:5002';
      console.log("Using socket URL:", socketUrl);
      
      // Connect using Socket.io instead of raw WebSocket
      const socket = io(socketUrl, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      
      socket.on('connect', () => {
        console.log('Socket.io Connected');
      });
  
      socket.on('connect_error', (error) => {
        console.error('Socket.io Connection Error:', error.message);
        // If we get a connection error, it might be due to authentication
        if (error.message.includes('Authentication error')) {
          console.warn('Socket connection failed due to authentication issue');
        }
      });
  
      socket.on('disconnect', (reason) => {
        console.log('Socket.io Disconnected', reason);
        
        if (reason === 'io server disconnect') {
          // The server has forcefully disconnected the socket
          console.warn('Socket disconnected by server, possibly due to authentication issue');
        }
      });
  
      socket.on('message', (data) => {
        try {
          if (data.type === 'friendRequest') {
            // Show notification for new friend request
            alert(data.message);
          }
          
          // Handle auth error messages from server
          if (data.type === 'auth_error' && data.error === 'token_expired') {
            console.warn('Token expired, clearing and redirecting to login');
            localStorage.removeItem('token');
            alert('Your session has expired. Please log in again.');
            navigate('/login');
          }
        } catch (error) {
          console.error('Error handling socket message:', error);
        }
      });
      
      return socket;
    } catch (error) {
      console.error('Error setting up Socket.io:', error);
      return null;
    }
  }, [navigate]);

  // Set up socket when component mounts
  useEffect(() => {
    const socket = setupSocket();
    
    // Clean up on component unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [setupSocket]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Signup />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<About />} />
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } 
        />
        <Route path="/verify-email" element={<EmailVerification />} />
        <Route path="/verify-email-token" element={<EmailVerification />} />
        <Route 
          path="/preference-form" 
          element={
            <PrivateRoute>
              <PreferenceFormPage />
            </PrivateRoute>
          } 
        />
      </Routes>
    </>
  );
}

export default App;
