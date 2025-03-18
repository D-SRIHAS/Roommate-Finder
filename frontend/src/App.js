import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";

// WebSocket connection with error handling
const token = localStorage.getItem('token');
const ws = new WebSocket(`ws://localhost:5002/ws?token=${token}`);

ws.onopen = () => {
  console.log('WebSocket Connected');
};

ws.onerror = (error) => {
  console.error('WebSocket Error:', error);
};

ws.onclose = () => {
  console.log('WebSocket Disconnected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'friendRequest') {
    // Show notification for new friend request
    alert(data.message);
  }
};

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Signup />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </>
  );
}

export default App;
