import { Routes, Route, useNavigate } from "react-router-dom";
import React, { useEffect } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import EmailVerification from "./pages/EmailVerification";

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    // WebSocket connection with error handling
    const token = localStorage.getItem('token');
    if (!token) return; // Don't connect if no token
    
    let ws = null;
    
    try {
      ws = new WebSocket(`ws://localhost:5002/ws?token=${token}`);
      
      ws.onopen = () => {
        console.log('WebSocket Connected');
      };
  
      ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        // If we get an error, the token might be expired
        // We'll leave the error handling to onclose
      };
  
      ws.onclose = (event) => {
        console.log('WebSocket Disconnected', event.code, event.reason);
        
        // If closed with certain codes that suggest authentication issues
        if (event.code === 1000 || event.code === 1006) {
          console.warn('WebSocket closed, possibly due to authentication issue');
          // Don't remove token here, let the API requests handle auth failures
        }
      };
  
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
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
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
    }

    // Clean up on component unmount
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
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
      </Routes>
    </>
  );
}

export default App;
