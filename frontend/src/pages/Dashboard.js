import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';
import PreferenceForm from '../components/PreferenceForm';

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('matches');
  const [userProfile, setUserProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Fetch profile
      const profileResponse = await axios.get('http://localhost:5002/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUserProfile(profileResponse.data);
      setFriendRequests(profileResponse.data.friendRequests || []);

      // Fetch matches
      const matchesResponse = await axios.get('http://localhost:5002/api/user/matches', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMatches(matchesResponse.data.matches || []);

      // Fetch friends
      const friendsResponse = await axios.get('http://localhost:5002/api/user/friends', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setFriends(friendsResponse.data.friends || []);
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally leaving dependency array empty to avoid infinite loop

  const handleSendFriendRequest = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5002/api/user/friend-request', 
        { userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Friend request sent successfully!');
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Failed to send friend request');
    }
  };

  const handleFriendRequestResponse = async (requestId, action) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5002/api/user/friend-request-response',
        { requestId, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData(); // Refresh all data
    } catch (error) {
      console.error('Error responding to friend request:', error);
      alert('Failed to process friend request');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleViewProfile = (friend) => {
    setSelectedFriend(friend);
    setShowProfileModal(true);
  };

  const handleUnfriend = async (friendId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5002/api/user/unfriend', 
        { friendId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData(); // Refresh the data
      alert('Friend removed successfully');
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Failed to remove friend');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 min-h-screen bg-white shadow-lg fixed">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gray-300 overflow-hidden">
                {userProfile && userProfile.profile && userProfile.profile.photoUrl ? (
                  <img 
                    src={`http://localhost:5002${userProfile.profile.photoUrl}`} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-4xl">👤</span>
                  </div>
                )}
              </div>
            </div>
            <h2 className="text-xl font-bold text-center">
              {userProfile && userProfile.profile && userProfile.profile.fullName 
                ? userProfile.profile.fullName 
                : 'Welcome Back!'}
            </h2>
            <hr className="my-4" />
            
            <nav className="space-y-2">
              <button 
                onClick={() => setActiveTab('profile')}
                className={`w-full px-4 py-2 text-left rounded-lg ${
                  activeTab === 'profile'
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                👤 Profile
              </button>
              <button 
                onClick={() => setActiveTab('preferences')}
                className={`w-full px-4 py-2 text-left rounded-lg ${
                  activeTab === 'preferences'
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                ⚙️ Preferences
              </button>
              <button 
                onClick={() => setActiveTab('matches')}
                className={`w-full px-4 py-2 text-left rounded-lg ${
                  activeTab === 'matches'
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                🤝 Matches
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`w-full px-4 py-2 text-left rounded-lg ${
                  activeTab === 'messages'
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                📩 Requests
              </button>
              <button
                onClick={handleLogout}
                className="w-full mt-10 px-4 py-2 text-left rounded-lg text-red-500 hover:bg-red-50"
              >
                🚪 Logout
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="ml-64 p-8 w-full">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Your Profile</h2>
              <p className="text-gray-600">
                Complete your profile to help potential roommates learn more about you.
              </p>
              <button
                onClick={() => navigate('/profile')}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Edit Profile
              </button>
            </div>
          )}

          {activeTab === 'preferences' && (
            <PreferenceForm onSubmit={(preferences) => {
              // Handle preferences submission
              const token = localStorage.getItem('token');
              axios.post('http://localhost:5002/api/user/preferences', 
                { preferences },
                { headers: { Authorization: `Bearer ${token}` } }
              ).then(response => {
                alert('Preferences saved successfully!');
                fetchData();
                setActiveTab('matches');
              }).catch(error => {
                console.error('Error saving preferences:', error);
                alert('Failed to save preferences');
              });
            }} />
          )}

          {activeTab === 'matches' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Potential Roommates</h2>
              {matches && matches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {matches.map((match) => (
                    <div key={match._id} className="bg-white rounded-lg shadow-md p-4">
                      <div className="flex items-center space-x-4">
                        <img
                          src={match.profile?.photoUrl || '/default-avatar.png'}
                          alt={match.profile?.fullName || 'User'}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                        <div>
                          <h3 className="text-lg font-semibold">{match.profile?.fullName || 'Anonymous'}</h3>
                          <p className="text-gray-600">{match.matchScore}% Match</p>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => handleSendFriendRequest(match._id)}
                          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                          Send Friend Request
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">No matches found yet. We're looking for compatible roommates based on your preferences!</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Connection Requests</h2>
              
              {friendRequests.length > 0 ? (
                <div className="space-y-4">
                  {friendRequests.map((request) => (
                    <div key={request._id} className="bg-white rounded-lg shadow-md p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <img
                            src={request.from.profile?.photoUrl || '/default-avatar.png'}
                            alt={request.from.profile?.fullName || 'User'}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <div>
                            <h3 className="font-semibold">{request.from.profile?.fullName || 'Anonymous'}</h3>
                            <p className="text-sm text-gray-600">Sent you a friend request</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleFriendRequestResponse(request._id, 'accept')}
                            className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleFriendRequestResponse(request._id, 'reject')}
                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">No connection requests yet.</p>
                </div>
              )}

              {friends.length > 0 && (
                <div className="mt-10">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Friends</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {friends.map((friend) => (
                      <div key={friend._id} className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="h-48 bg-gray-200">
                          {friend.profile && friend.profile.photoUrl ? (
                            <img 
                              src={`http://localhost:5002${friend.profile.photoUrl}`} 
                              alt={friend.username} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                              <span className="text-4xl">👤</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="p-6">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {friend.profile && friend.profile.fullName ? friend.profile.fullName : friend.username}
                          </h3>
                          
                          {friend.profile && friend.profile.address && (
                            <p className="text-gray-600 mb-2">
                              <span className="font-medium">Location:</span> {friend.profile.address}
                            </p>
                          )}
                          
                          <div className="flex space-x-2 mt-4">
                            <button
                              onClick={() => handleViewProfile(friend)}
                              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                            >
                              View Profile
                            </button>
                            <button
                              onClick={() => handleUnfriend(friend._id)}
                              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                            >
                              Unfriend
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile Modal */}
      {showProfileModal && selectedFriend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Friend Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                {selectedFriend.profile && selectedFriend.profile.photoUrl ? (
                  <img 
                    src={`http://localhost:5002${selectedFriend.profile.photoUrl}`} 
                    alt={selectedFriend.username} 
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-4xl">👤</span>
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedFriend.profile && selectedFriend.profile.fullName 
                      ? selectedFriend.profile.fullName 
                      : selectedFriend.username}
                  </h3>
                  <p className="text-gray-600">{selectedFriend.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedFriend.profile && (
                  <>
                    <div>
                      <p className="font-medium text-gray-700">Bio</p>
                      <p className="text-gray-600">{selectedFriend.profile.bio || 'No bio available'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Address</p>
                      <p className="text-gray-600">{selectedFriend.profile.address || 'No address available'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Phone</p>
                      <p className="text-gray-600">{selectedFriend.profile.phone || 'No phone available'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Occupation</p>
                      <p className="text-gray-600">{selectedFriend.profile.occupation || 'No occupation available'}</p>
                    </div>
                  </>
                )}
              </div>

              {selectedFriend.preferences && (
                <div className="mt-6">
                  <h4 className="text-lg font-semibold mb-2">Preferences</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium text-gray-700">Cleanliness</p>
                      <p className="text-gray-600">{selectedFriend.preferences.cleanliness}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Smoking</p>
                      <p className="text-gray-600">{selectedFriend.preferences.smoking}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Pets</p>
                      <p className="text-gray-600">{selectedFriend.preferences.pets}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Work Schedule</p>
                      <p className="text-gray-600">{selectedFriend.preferences.workSchedule}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Social Level</p>
                      <p className="text-gray-600">{selectedFriend.preferences.socialLevel}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Guest Preference</p>
                      <p className="text-gray-600">{selectedFriend.preferences.guestPreference}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Music</p>
                      <p className="text-gray-600">{selectedFriend.preferences.music}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
