import React, { useState } from 'react';
import './Chat.css';

const Chat = ({ friend, messages, onSendMessage, onUnfriend }) => {
  const [message, setMessage] = useState('');
  const [showProfile, setShowProfile] = useState(false);

  const handleSend = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-user-info" onClick={() => setShowProfile(!showProfile)}>
          <img 
            src={friend.profile?.photoUrl || '/default-avatar.png'} 
            alt="Profile" 
            className="chat-profile-photo"
          />
          <div className="chat-user-details">
            <h3>{friend.profile?.fullName || friend.username}</h3>
            <p>{friend.profile?.occupation || 'No occupation listed'}</p>
          </div>
        </div>
        <button className="unfriend-btn" onClick={() => onUnfriend(friend._id)}>
          Unfriend
        </button>
      </div>

      {showProfile && (
        <div className="profile-modal">
          <div className="profile-content">
            <img 
              src={friend.profile?.photoUrl || '/default-avatar.png'} 
              alt="Profile" 
              className="large-profile-photo"
            />
            <h2>{friend.profile?.fullName || friend.username}</h2>
            <p className="occupation">{friend.profile?.occupation || 'No occupation listed'}</p>
            <p className="location">{friend.profile?.address || 'No location listed'}</p>
            <p className="bio">{friend.profile?.bio || 'No bio available'}</p>
            <button className="close-profile" onClick={() => setShowProfile(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      <div className="messages-container">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`message ${msg.sender === friend._id ? 'received' : 'sent'}`}
          >
            <p>{msg.text}</p>
            <span className="message-time">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>

      <form className="message-input" onSubmit={handleSend}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default Chat; 