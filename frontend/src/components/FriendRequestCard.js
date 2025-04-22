import React from 'react';
import './FriendRequestCard.css';

const FriendRequestCard = ({ request, onAccept, onReject }) => {
  const { fromUserData } = request;

  return (
    <div className="friend-request-card">
      <div className="request-profile">
        <img 
          src={fromUserData.photoUrl || '/default-avatar.png'} 
          alt="Profile" 
          className="profile-photo"
        />
        <div className="profile-info">
          <h3>{fromUserData.fullName || fromUserData.username}</h3>
          <p className="occupation">{fromUserData.occupation || 'No occupation listed'}</p>
          <p className="location">{fromUserData.address || 'No location listed'}</p>
          <p className="bio">{fromUserData.bio || 'No bio available'}</p>
        </div>
      </div>
      <div className="request-actions">
        <button className="accept-btn" onClick={() => onAccept(request._id)}>
          Accept
        </button>
        <button className="reject-btn" onClick={() => onReject(request._id)}>
          Reject
        </button>
      </div>
    </div>
  );
};

export default FriendRequestCard; 