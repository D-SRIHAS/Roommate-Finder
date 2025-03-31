import { Routes, Route, useNavigate } from "react-router-dom";
import React, { useEffect } from "react";
import { io } from "socket.io-client";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import EmailVerification from "./pages/EmailVerification";
import PhoneVerification from './pages/PhoneVerification';

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    // Socket.io connection with error handling
    const token = localStorage.getItem('token');
    if (!token) return; // Don't connect if no token
    
    let socket = null;
    
    try {
      // Connect using Socket.io instead of raw WebSocket
      socket = io('http://localhost:5002', {
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
    } catch (error) {
      console.error('Error setting up Socket.io:', error);
    }

    // Clean up on component unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [navigate]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Signup />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/verify-email" element={<EmailVerification />} />
        <Route path="/verify-email-token" element={<EmailVerification />} />
        <Route path="/phone-verification" element={<PhoneVerification />} />
      </Routes>
    </>
  );
}

export default App;
