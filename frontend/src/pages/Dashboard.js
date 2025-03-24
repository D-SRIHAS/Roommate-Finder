import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';
import PreferenceForm from '../components/PreferenceForm';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('matches');
  const [userProfile, setUserProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [editingPreferences, setEditingPreferences] = useState(false);
  const [sentRequests, setSentRequests] = useState({}); // Track sent requests
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [ws, setWs] = useState(null);

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
      
      // Check if profile is incomplete
      const isProfileIncomplete = !profileResponse.data.profileCompleted;
      setProfileIncomplete(isProfileIncomplete);
      
      // If profile is incomplete, set active tab to profile
      if (isProfileIncomplete) {
        setActiveTab('profile');
      }

      try {
        // Try to fetch matches (might fail if profile/preferences incomplete)
        const matchesResponse = await axios.get('http://localhost:5002/api/user/matches', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Matches response format:', matchesResponse.data);
        
        if (matchesResponse.data && matchesResponse.data.matches) {
          // Add explicit debugging for match objects
          if (matchesResponse.data.matches.length > 0) {
            console.log('First match example:', {
              id: matchesResponse.data.matches[0]._id,
              name: matchesResponse.data.matches[0].profile?.fullName || matchesResponse.data.matches[0].username,
              matchPercentage: matchesResponse.data.matches[0].matchPercentage,
              photoUrl: matchesResponse.data.matches[0].profile?.photoUrl
            });
          }
          setMatches(matchesResponse.data.matches);
        } else {
          console.log('No matches found in response');
          setMatches([]);
        }
      } catch (matchError) {
        console.error('Error fetching matches:', matchError);
        setMatches([]);
      }

      try {
        // Try to fetch friends (should work even with incomplete profile)
        const friendsResponse = await axios.get('http://localhost:5002/api/user/friends', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFriends(friendsResponse.data.friends || []);
      } catch (friendsError) {
        console.log('Error loading friends data');
        setFriends([]);
      }
      
      // Load all existing conversations for this user
      try {
        const conversationsResponse = await axios.get('http://localhost:5002/api/user/conversations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (conversationsResponse.data && conversationsResponse.data.conversations) {
          // Process and set up conversations
          const processedConversations = await Promise.all(
            conversationsResponse.data.conversations.map(async (conv) => {
              // For each conversation, fetch the friend's details
              try {
                const friendResponse = await axios.get(`http://localhost:5002/api/user/profile/${conv.partnerId}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                
                const friend = friendResponse.data;
                
                return {
                  id: conv.id || Date.now().toString(),
                  friendId: conv.partnerId,
                  friendName: friend.profile?.fullName || friend.username,
                  friendPhoto: friend.profile?.photoUrl,
                  messages: conv.messages.map(msg => ({
                    id: msg._id || Date.now().toString(),
                    sender: msg.sender === profileResponse.data._id ? 'me' : msg.sender,
                    text: msg.text,
                    timestamp: msg.timestamp
                  }))
                };
              } catch (error) {
                console.error('Error fetching conversation partner details:', error);
                return {
                  id: conv.id || Date.now().toString(),
                  friendId: conv.partnerId,
                  friendName: 'User',
                  friendPhoto: null,
                  messages: conv.messages.map(msg => ({
                    id: msg._id || Date.now().toString(),
                    sender: msg.sender === profileResponse.data._id ? 'me' : msg.sender,
                    text: msg.text,
                    timestamp: msg.timestamp
                  }))
                };
              }
            })
          );
          
          setConversations(processedConversations);
        }
      } catch (convError) {
        console.error('Error loading conversations:', convError);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading profile data:', err);
      if (err.response && err.response.status === 401) {
        // Unauthorized - token expired
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setError('Failed to load data. Please try again.');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
    // If redirecting from profile with state, set active tab to preferences
    if (location.state?.redirectToPreferences) {
      setActiveTab('preferences');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally leaving dependency array empty to avoid infinite loop

  useEffect(() => {
    // Setup WebSocket connection
    const token = localStorage.getItem('token');
    if (token) {
      console.log('Setting up WebSocket connection');
      
      // Close any existing connections before creating a new one
      if (ws) {
        console.log('Closing existing WebSocket connection');
        ws.close();
      }
      
      const connectWebSocket = () => {
        const socket = new WebSocket(`ws://localhost:5002?token=${token}`);
        
        socket.onopen = () => {
          console.log('WebSocket connected with token for user:', userProfile?._id);
        };
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);
            
            // Handle different message types
            if (data.type === 'new_message') {
              console.log('New message received:', data.message);
              handleNewMessage(data.message);
            } else if (data.type === 'message_sent') {
              console.log('Message sent confirmation:', data.message);
              updateConversationWithMessage(data.message);
            } else if (data.type === 'error') {
              console.error('WebSocket error message:', data.message);
              alert(`Error: ${data.message}`);
            } else if (data.type === 'auth_error' && data.action === 'clear_token') {
              // Handle expired token
              localStorage.removeItem('token');
              navigate('/login');
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };
        
        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
        socket.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          // Try to reconnect after 3 seconds
          setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            // Only reconnect if the token is still valid
            if (localStorage.getItem('token') === token) {
              connectWebSocket();
            }
          }, 3000);
        };
        
        setWs(socket);
        return socket;
      };
      
      const socket = connectWebSocket();
      
      // Clean up on unmount
      return () => {
        console.log('Closing WebSocket connection');
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    }
  }, [navigate, userProfile, ws]);
  
  const handleNewMessage = useCallback((message) => {
    // Add new message to the appropriate conversation
    console.log('handleNewMessage called with:', message);
    setConversations(prevConversations => {
      // Find if the conversation exists
      const existingConvIndex = prevConversations.findIndex(
        conv => conv.friendId === message.sender
      );
      
      if (existingConvIndex >= 0) {
        // Update existing conversation
        const updatedConversations = [...prevConversations];
        const newMsg = {
          id: message._id || Date.now().toString(),
          sender: message.sender,
          text: message.text,
          timestamp: message.timestamp
        };
        console.log('Adding message to existing conversation:', newMsg);
        
        updatedConversations[existingConvIndex] = {
          ...updatedConversations[existingConvIndex],
          messages: [...updatedConversations[existingConvIndex].messages, newMsg]
        };
        
        // If this is the active conversation, update it
        if (activeConversation && activeConversation.friendId === message.sender) {
          setActiveConversation(updatedConversations[existingConvIndex]);
        }
        
        return updatedConversations;
      } else {
        // Need to fetch user info for this sender
        console.log('Conversation not found, creating new one');
        fetchUserInfo(message.sender).then(senderInfo => {
          // Create a new conversation
          const newConversation = {
            id: message.conversationId,
            friendId: message.sender,
            friendName: senderInfo?.profile?.fullName || senderInfo?.username || 'User',
            friendPhoto: senderInfo?.profile?.photoUrl,
            messages: [{
              id: message._id || Date.now().toString(),
              sender: message.sender,
              text: message.text,
              timestamp: message.timestamp
            }]
          };
          
          console.log('Creating new conversation:', newConversation);
          setConversations(prev => [...prev, newConversation]);
          
          // Optionally auto-switch to this conversation
          if (!activeConversation) {
            setActiveConversation(newConversation);
            setActiveTab('chats');
          }
        });
        
        return prevConversations;
      }
    });
  }, [activeConversation, setActiveTab]);
  
  const updateConversationWithMessage = useCallback((message) => {
    // Add sent message to the active conversation
    console.log('updateConversationWithMessage called with:', message);
    setConversations(prevConversations => {
      // Find if the conversation exists
      const existingConvIndex = prevConversations.findIndex(
        conv => conv.friendId === message.recipient
      );
      
      if (existingConvIndex >= 0) {
        // Update existing conversation
        const updatedConversations = [...prevConversations];
        const newMsg = {
          id: message._id || Date.now().toString(),
          sender: 'me',
          text: message.text,
          timestamp: message.timestamp
        };
        
        console.log('Adding sent message to conversation:', newMsg);
        updatedConversations[existingConvIndex] = {
          ...updatedConversations[existingConvIndex],
          messages: [...updatedConversations[existingConvIndex].messages, newMsg]
        };
        
        // If this is the active conversation, update it
        if (activeConversation && activeConversation.friendId === message.recipient) {
          setActiveConversation(updatedConversations[existingConvIndex]);
        }
        
        return updatedConversations;
      }
      
      return prevConversations;
    });
  }, [activeConversation]);
  
  const fetchUserInfo = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5002/api/user/profile/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user info:', error);
      return { username: 'User' };
    }
  };

  const handleSendFriendRequest = async (userId) => {
    try {
      console.log('Button clicked with userId:', userId);
      console.log('Type of userId:', typeof userId);
      if (!userId) {
        console.error('userId is undefined or null!');
        alert('Cannot send request: User ID is missing');
        return;
      }
      
      const token = localStorage.getItem('token');
      const data = { targetUserId: userId };
      console.log('Sending request data:', data);
      
      const response = await axios.post('http://localhost:5002/api/user/friend-request', 
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Mark this request as sent
      setSentRequests(prev => ({
        ...prev,
        [userId]: true
      }));
      
      alert('Friend request sent successfully!');
    } catch (error) {
      console.error('Error sending friend request:', error);
      
      // If the error is that we already sent a request, mark it as sent
      if (error.response && error.response.status === 400 && 
          error.response.data.message === 'Friend request already sent') {
        setSentRequests(prev => ({
          ...prev,
          [userId]: true
        }));
      }
      
      // Display the specific error message from the backend if available
      if (error.response && error.response.data && error.response.data.message) {
        alert(`Failed to send friend request: ${error.response.data.message}`);
      } else {
        alert('Failed to send friend request');
      }
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
    // Close WebSocket connection if open
    if (ws) {
      console.log('Closing WebSocket connection before logout');
      ws.close();
      setWs(null);
    }
    
    // Clear all saved data
    localStorage.removeItem('token');
    setUserProfile(null);
    setConversations([]);
    setActiveConversation(null);
    
    navigate('/login');
  };

  const handleViewProfile = (friend) => {
    console.log('View profile - friend object:', friend);
    console.log('View profile - friend._id:', friend._id);
    console.log('View profile - friend.userId:', friend.userId);
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

  const handleChat = (friend) => {
    // Check if a conversation already exists with this friend
    const existingConversation = conversations.find(conv => conv.friendId === friend._id);
    
    if (existingConversation) {
      setActiveConversation(existingConversation);
    } else {
      // Fetch conversation history
      const token = localStorage.getItem('token');
      axios.get(`http://localhost:5002/api/user/messages/${friend._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(response => {
        // Transform messages to our format
        const messages = response.data?.messages?.map(msg => ({
          id: msg._id || Date.now().toString(),
          sender: msg.sender === userProfile?._id ? 'me' : msg.sender,
          text: msg.text,
          timestamp: msg.timestamp
        })) || [];
        
        // Create a new conversation with only real messages
        const newConversation = {
          id: Date.now().toString(),
          friendId: friend._id,
          friendName: friend.profile?.fullName || friend.username,
          friendPhoto: friend.profile?.photoUrl || null,
          messages: messages
        };
        
        setConversations(prev => [...prev, newConversation]);
        setActiveConversation(newConversation);
      }).catch(error => {
        console.error('Error fetching messages:', error);
        
        // Create a new empty conversation
        const newConversation = {
          id: Date.now().toString(),
          friendId: friend._id,
          friendName: friend.profile?.fullName || friend.username,
          friendPhoto: friend.profile?.photoUrl || null,
          messages: []
        };
        
        setConversations(prev => [...prev, newConversation]);
        setActiveConversation(newConversation);
      });
    }
    
    // Switch to chats tab
    setActiveTab('chats');
  };

  const handleSendMessage = () => {
    if (!activeConversation || currentMessage.trim() === '') return;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Sending message:', {
        type: 'chat',
        recipientId: activeConversation.friendId,
        text: currentMessage
      });
      
      // Optimistically add message to UI immediately
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        sender: 'me',
        text: currentMessage,
        timestamp: new Date().toISOString(),
        pending: true
      };
      
      setActiveConversation(prev => ({
        ...prev,
        messages: [...prev.messages, optimisticMessage]
      }));
      
      // Clear input immediately for better UX
      setCurrentMessage('');
      
      // Send message via WebSocket
      ws.send(JSON.stringify({
        type: 'chat',
        recipientId: activeConversation.friendId,
        text: optimisticMessage.text
      }));
    } else {
      console.error('WebSocket not connected, readyState:', ws ? ws.readyState : 'no ws');
      
      // Try to reconnect
      if (ws) {
        ws.close();
      }
      
      const token = localStorage.getItem('token');
      if (token) {
        const newWs = new WebSocket(`ws://localhost:5002?token=${token}`);
        setWs(newWs);
        
        // After connection, retry sending
        newWs.onopen = () => {
          console.log('WebSocket reconnected, retrying message send');
          setTimeout(() => handleSendMessage(), 500);
        };
      } else {
        alert('Connection issue. Please refresh the page.');
      }
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
                    src={userProfile.profile.photoUrl.startsWith('http') 
                      ? userProfile.profile.photoUrl 
                      : `http://localhost:5002${userProfile.profile.photoUrl}`}
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
                onClick={() => setActiveTab('chats')}
                className={`w-full px-4 py-2 text-left rounded-lg ${
                  activeTab === 'chats'
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                💬 Chats
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
              
              {profileIncomplete && (
                <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
                  <h3 className="text-lg font-semibold text-blue-800">Welcome to Roommate Finder!</h3>
                  <p className="text-blue-700 mt-2">
                    To get started, please complete your profile information. This helps potential 
                    roommates learn more about you and improves the quality of your matches.
                  </p>
                  <ul className="list-disc list-inside mt-3 text-blue-700">
                    <li>Fill in your personal information</li>
                    <li>Set your roommate preferences</li>
                    <li>Upload a profile photo</li>
                  </ul>
                </div>
              )}
              
              <p className="text-gray-600">
                Complete your profile to help potential roommates learn more about you.
              </p>
              <button
                onClick={() => navigate('/profile')}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {profileIncomplete ? 'Complete Your Profile' : 'Edit Profile'}
              </button>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Roommate Preferences</h2>
              
              {profileIncomplete && (
                <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mb-6">
                  <h3 className="text-lg font-semibold text-yellow-800">Profile Not Complete</h3>
                  <p className="text-yellow-700 mt-2">
                    Note: You should complete your profile for better roommate matching.
                    However, you can still set your preferences now.
                  </p>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                  >
                    Go to Profile
                  </button>
                </div>
              )}
              
              {userProfile && userProfile.preferences && 
               Object.values(userProfile.preferences).some(val => val !== null) ? (
                <div>
                  <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold">Your Current Preferences</h3>
                      <button 
                        onClick={() => setEditingPreferences(true)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                      >
                        Update Preferences
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userProfile.preferences.cleanliness && (
                        <div>
                          <p className="font-medium text-gray-700">Cleanliness Level</p>
                          <p className="text-gray-600">{userProfile.preferences.cleanliness}</p>
                        </div>
                      )}
                      
                      {userProfile.preferences.smoking && (
                        <div>
                          <p className="font-medium text-gray-700">Smoking Preferences</p>
                          <p className="text-gray-600">{userProfile.preferences.smoking}</p>
                        </div>
                      )}
                      
                      {userProfile.preferences.pets && (
                        <div>
                          <p className="font-medium text-gray-700">Pet Preferences</p>
                          <p className="text-gray-600">{userProfile.preferences.pets}</p>
                        </div>
                      )}
                      
                      {userProfile.preferences.workSchedule && (
                        <div>
                          <p className="font-medium text-gray-700">Work Schedule</p>
                          <p className="text-gray-600">{userProfile.preferences.workSchedule}</p>
                        </div>
                      )}
                      
                      {userProfile.preferences.socialLevel && (
                        <div>
                          <p className="font-medium text-gray-700">Social Preferences</p>
                          <p className="text-gray-600">{userProfile.preferences.socialLevel}</p>
                        </div>
                      )}
                      
                      {userProfile.preferences.guestPreference && (
                        <div>
                          <p className="font-medium text-gray-700">Guest Policy</p>
                          <p className="text-gray-600">{userProfile.preferences.guestPreference}</p>
                        </div>
                      )}
                      
                      {userProfile.preferences.music && (
                        <div>
                          <p className="font-medium text-gray-700">Music/Noise Preferences</p>
                          <p className="text-gray-600">{userProfile.preferences.music}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
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
              
              {/* Show edit form in modal when editing is true */}
              {editingPreferences && userProfile && userProfile.preferences && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold">Update Your Preferences</h3>
                      <button 
                        onClick={() => setEditingPreferences(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <PreferenceForm 
                      initialValues={userProfile.preferences}
                      onSubmit={(preferences) => {
                        // Handle preferences update
                        const token = localStorage.getItem('token');
                        axios.post('http://localhost:5002/api/user/preferences', 
                          { preferences },
                          { headers: { Authorization: `Bearer ${token}` } }
                        ).then(response => {
                          alert('Preferences updated successfully!');
                          setEditingPreferences(false);
                          fetchData();
                        }).catch(error => {
                          console.error('Error updating preferences:', error);
                          alert('Failed to update preferences');
                        });
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'matches' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Potential Roommates</h2>
              
              {profileIncomplete ? (
                <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                  <h3 className="text-lg font-semibold text-yellow-800">Profile Incomplete</h3>
                  <p className="text-yellow-700 mt-2">
                    Please complete your profile and preferences to see potential roommate matches.
                  </p>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                  >
                    Complete Profile
                  </button>
                </div>
              ) : matches && matches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {matches.map((match) => {
                    console.log('Match object:', match);
                    console.log('Match ID:', match._id);
                    console.log('Match userId:', match.userId);
                    return (
                    <div key={match._id} className="bg-white rounded-lg shadow-md p-4">
                      <div className="flex items-center space-x-4">
                        {match.profile && match.profile.photoUrl ? (
                          <img
                            src={match.profile.photoUrl.startsWith('http') 
                              ? match.profile.photoUrl 
                              : `http://localhost:5002${match.profile.photoUrl}`}
                            alt={match.profile?.fullName || 'User'}
                            className="w-16 h-16 rounded-full object-cover bg-gray-200"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-2xl">👤</span>
                          </div>
                        )}
                        <div>
                          <h3 className="text-lg font-semibold">{match.profile?.fullName || match.username || 'Anonymous'}</h3>
                          <div className="flex items-center">
                            <div className="text-green-600 font-bold">
                              {typeof match.matchPercentage === 'number' 
                                ? `${match.matchPercentage}` 
                                : '??'}%
                            </div>
                            <div className="text-gray-600 ml-1">Match</div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm text-gray-500 truncate">
                          {match.profile?.address ? `Location: ${match.profile.address}` : 'No location provided'}
                        </p>
                      </div>
                      <div className="mt-4 flex justify-between">
                        <button
                          onClick={() => handleViewProfile(match)}
                          className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-sm"
                        >
                          View Profile
                        </button>
                        <button
                          onClick={() => {
                            // Use the appropriate ID field
                            const id = match._id || match.userId;
                            console.log('Sending request with id:', id);
                            handleSendFriendRequest(id);
                          }}
                          className="bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600 text-sm"
                        >
                          Send Request
                        </button>
                      </div>
                    </div>
                  )})}
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
              
              {friendRequests.filter(request => request.status === 'pending').length > 0 ? (
                <div className="space-y-4">
                  {friendRequests.filter(request => request.status === 'pending').map((request) => (
                    <div key={request._id} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 cursor-pointer" 
                             onClick={() => {
                               // Create a temporary friend object from the request data
                               const tempFriend = {
                                 _id: request.from,
                                 username: request.fromUser?.username || 'User',
                                 profile: {
                                   fullName: request.fromUser?.fullName || request.fromUser?.username || 'User',
                                   photoUrl: request.fromUser?.photoUrl || null
                                 }
                               };
                               handleViewProfile(tempFriend);
                             }}>
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            {request.fromUser && request.fromUser.photoUrl ? (
                              <img
                                src={request.fromUser.photoUrl.startsWith('http') 
                                  ? request.fromUser.photoUrl 
                                  : `http://localhost:5002${request.fromUser.photoUrl}`}
                                alt={request.fromUser.fullName || request.fromUser.username || 'User'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-2xl">👤</span>
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">
                              {request.fromUser ? (request.fromUser.fullName || request.fromUser.username) : 'User'}
                            </h3>
                            <p className="text-sm text-gray-600">Sent you a friend request</p>
                            <p className="text-xs text-blue-500 underline">Click to view profile</p>
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
                              src={friend.profile.photoUrl.startsWith('http') 
                                ? friend.profile.photoUrl 
                                : `http://localhost:5002${friend.profile.photoUrl}`}
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
                              onClick={() => handleChat(friend)}
                              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                            >
                              Chat
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

          {activeTab === 'chats' && (
            <div className="flex h-[calc(100vh-150px)]">
              {/* Conversation list */}
              <div className="w-1/4 bg-white rounded-lg shadow mr-4 overflow-y-auto">
                <h3 className="text-lg font-semibold p-4 border-b">Your Conversations</h3>
                {conversations.length === 0 ? (
                  <div className="p-4 text-gray-500">
                    No conversations yet. Start chatting with your matches!
                  </div>
                ) : (
                  <ul>
                    {conversations.map(conversation => (
                      <li 
                        key={conversation.id}
                        onClick={() => setActiveConversation(conversation)}
                        className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                          activeConversation && activeConversation.id === conversation.id
                          ? 'bg-blue-50 border-l-4 border-l-blue-500'
                          : ''
                        }`}
                      >
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden mr-3">
                            {conversation.friendPhoto ? (
                              <img 
                                src={conversation.friendPhoto.startsWith('http') 
                                  ? conversation.friendPhoto 
                                  : `http://localhost:5002${conversation.friendPhoto}`} 
                                alt={conversation.friendName} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-xl">👤</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold">{conversation.friendName}</div>
                            <div className="text-sm text-gray-500 truncate">
                              {conversation.messages.length > 0 
                                ? `${conversation.messages[conversation.messages.length - 1].sender === 'me' 
                                  ? 'You: ' 
                                  : ''}${conversation.messages[conversation.messages.length - 1].text.slice(0, 20)}${conversation.messages[conversation.messages.length - 1].text.length > 20 ? '...' : ''}`
                                : 'Start a conversation'}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {/* Chat window with profile sidebar - Instagram style */}
              <div className="flex-1 flex bg-white rounded-lg shadow overflow-hidden">
                {activeConversation ? (
                  <>
                    {/* Main chat area */}
                    <div className="flex-1 flex flex-col">
                      {/* Chat header */}
                      <div className="p-4 border-b flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden mr-3">
                          {activeConversation.friendPhoto ? (
                            <img 
                              src={activeConversation.friendPhoto.startsWith('http') 
                                ? activeConversation.friendPhoto 
                                : `http://localhost:5002${activeConversation.friendPhoto}`} 
                              alt={activeConversation.friendName} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-xl">👤</span>
                            </div>
                          )}
                        </div>
                        <div className="font-semibold">{activeConversation.friendName}</div>
                      </div>
                      
                      {/* Chat messages */}
                      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                        {activeConversation.messages.map(message => (
                          <div 
                            key={message.id} 
                            className={`mb-4 max-w-[70%] ${
                              message.sender === 'me' 
                                ? 'ml-auto' 
                                : 'mr-auto'
                            }`}
                          >
                            <div className={`p-3 rounded-lg shadow-sm ${
                              message.sender === 'me' 
                                ? 'bg-blue-500 text-white rounded-br-none' 
                                : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
                            }`}>
                              {message.text}
                            </div>
                            <div className={`text-xs text-gray-500 mt-1 ${
                              message.sender === 'me' ? 'text-right' : 'text-left'
                            }`}>
                              {message.sender === 'me' ? 'You' : activeConversation.friendName} • {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Chat input */}
                      <div className="p-4 border-t">
                        <form 
                          onSubmit={e => {
                            e.preventDefault();
                            handleSendMessage();
                          }}
                          className="flex items-center"
                        >
                          <input
                            type="text"
                            value={currentMessage}
                            onChange={e => setCurrentMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 border rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="submit"
                            className="bg-blue-500 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600"
                          >
                            Send
                          </button>
                        </form>
                      </div>
                    </div>
                    
                    {/* Profile sidebar - Instagram style */}
                    <div className="w-1/3 border-l bg-white overflow-y-auto hidden md:block">
                      <div className="p-6 text-center border-b">
                        <div className="w-24 h-24 rounded-full bg-gray-300 overflow-hidden mx-auto mb-4">
                          {activeConversation.friendPhoto ? (
                            <img 
                              src={activeConversation.friendPhoto.startsWith('http') 
                                ? activeConversation.friendPhoto 
                                : `http://localhost:5002${activeConversation.friendPhoto}`} 
                              alt={activeConversation.friendName} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-4xl">👤</span>
                            </div>
                          )}
                        </div>
                        <h3 className="text-xl font-bold mb-1">{activeConversation.friendName}</h3>
                        
                        {/* Friend's details - will be fetched from the friend object */}
                        {friends.find(f => f._id === activeConversation.friendId)?.profile && (
                          <div className="text-sm text-gray-600 mb-3">
                            {friends.find(f => f._id === activeConversation.friendId)?.profile?.occupation || 'No occupation'}
                          </div>
                        )}
                        
                        <div className="flex justify-center mt-4 space-x-2">
                          <button 
                            onClick={() => {
                              const friend = friends.find(f => f._id === activeConversation.friendId);
                              if (friend) handleViewProfile(friend);
                            }}
                            className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-200"
                          >
                            View Full Profile
                          </button>
                        </div>
                      </div>
                      
                      {/* Friend's information */}
                      {friends.find(f => f._id === activeConversation.friendId)?.profile && (
                        <div className="px-6 py-4">
                          <h4 className="text-sm uppercase text-gray-500 font-medium mb-4">About</h4>
                          
                          <div className="space-y-4">
                            {friends.find(f => f._id === activeConversation.friendId)?.profile?.bio && (
                              <div>
                                <p className="text-sm text-gray-800">
                                  {friends.find(f => f._id === activeConversation.friendId)?.profile?.bio}
                                </p>
                              </div>
                            )}
                            
                            {friends.find(f => f._id === activeConversation.friendId)?.profile?.address && (
                              <div className="flex items-start">
                                <div className="text-gray-500 mr-2">📍</div>
                                <div>
                                  <p className="text-sm text-gray-800 font-medium">Location</p>
                                  <p className="text-sm text-gray-600">
                                    {friends.find(f => f._id === activeConversation.friendId)?.profile?.address}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {friends.find(f => f._id === activeConversation.friendId)?.profile?.phone && (
                              <div className="flex items-start">
                                <div className="text-gray-500 mr-2">📱</div>
                                <div>
                                  <p className="text-sm text-gray-800 font-medium">Phone</p>
                                  <p className="text-sm text-gray-600">
                                    {friends.find(f => f._id === activeConversation.friendId)?.profile?.phone}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {/* Show match percentage if available */}
                            {matches.find(m => m._id === activeConversation.friendId)?.matchPercentage && (
                              <div className="flex items-start">
                                <div className="text-gray-500 mr-2">🤝</div>
                                <div>
                                  <p className="text-sm text-gray-800 font-medium">Match Rate</p>
                                  <p className="text-sm text-green-600 font-bold">
                                    {matches.find(m => m._id === activeConversation.friendId)?.matchPercentage}% Match
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Preferences section */}
                          {friends.find(f => f._id === activeConversation.friendId)?.preferences && (
                            <div className="mt-6">
                              <h4 className="text-sm uppercase text-gray-500 font-medium mb-4">Roommate Preferences</h4>
                              
                              <div className="space-y-3">
                                {Object.entries(friends.find(f => f._id === activeConversation.friendId)?.preferences || {}).map(([key, value]) => 
                                  value && (
                                    <div key={key} className="flex">
                                      <div className="w-1/2 text-sm text-gray-600">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                                      <div className="w-1/2 text-sm text-gray-800 font-medium">{value}</div>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full w-full">
                    <div className="text-center p-8">
                      <div className="text-5xl mb-4">💬</div>
                      <h3 className="text-xl font-semibold mb-2">Conversations</h3>
                      <p className="text-gray-600 mb-4">
                        {conversations.length > 0 ? 
                          "Select a conversation from the list to start chatting." :
                          "No conversations yet. Start chatting with your matches and friends!"}
                      </p>
                      <div className="mt-6">
                        <button
                          onClick={() => setActiveTab('matches')}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          Find Matches to Chat With
                        </button>
                      </div>
                      
                      {friends.length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-lg font-medium mb-2">Friends</h4>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {friends.slice(0, 5).map(friend => (
                              <button
                                key={friend._id}
                                onClick={() => handleChat(friend)}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                              >
                                {friend.profile?.photoUrl && (
                                  <img 
                                    src={friend.profile.photoUrl.startsWith('http') 
                                      ? friend.profile.photoUrl 
                                      : `http://localhost:5002${friend.profile.photoUrl}`}
                                    alt={friend.profile?.fullName || friend.username}
                                    className="w-6 h-6 rounded-full mr-2"
                                  />
                                )}
                                Chat with {friend.profile?.fullName || friend.username}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile Modal */}
      {showProfileModal && selectedFriend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedFriend.matchPercentage ? 'Potential Roommate' : 'Friend Profile'}
                </h2>
                {selectedFriend.matchPercentage && (
                  <div className="mt-1 flex items-center">
                    <div className="text-green-600 font-bold text-xl">{selectedFriend.matchPercentage}%</div>
                    <div className="text-gray-600 ml-1">Match</div>
                  </div>
                )}
              </div>
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
                    src={selectedFriend.profile.photoUrl.startsWith('http') 
                      ? selectedFriend.profile.photoUrl 
                      : `http://localhost:5002${selectedFriend.profile.photoUrl}`}
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
                  
                  {/* Show similarity details if it's a match */}
                  {selectedFriend.cosineSimilarity && (
                    <div className="mt-2 text-xs text-gray-500">
                      <div>Preference Similarity: {selectedFriend.cosineSimilarity}%</div>
                      <div>Lifestyle Compatibility: {selectedFriend.jaccardSimilarity}%</div>
                    </div>
                  )}
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
