/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import './Dashboard.css';
import PreferenceForm from '../components/PreferenceForm';
import Chat from '../components/Chat';

const Dashboard = () => {
  console.log("Dashboard component rendering");
  
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userProfile, setUserProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(true);
  const [editingPreferences, setEditingPreferences] = useState(false);
  const [sentRequests, setSentRequests] = useState({});
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
  const [viewingProfile, setViewingProfile] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typing, setTyping] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileUsername, setProfileUsername] = useState('');
  const [profileFullName, setProfileFullName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileInterests, setProfileInterests] = useState('');
  const [profileGender, setProfileGender] = useState('');
  const [profileAge, setProfileAge] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const token = localStorage.getItem('token');
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const chatWindowRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [messageInput, setMessageInput] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [renderCount, setRenderCount] = useState(0);

  // Debug render counts - run only once
  useEffect(() => {
    const currentCount = renderCount + 1;
    setRenderCount(currentCount);
    console.log(`Dashboard has rendered ${currentCount} times`);
    
    // If too many renders, this might be a loop - log a warning
    if (currentCount > 10 && currentCount % 5 === 0) {
      console.warn(`Many renders detected (${currentCount}), might be a render loop!`);
    }
  }, []); // Only run once on mount

  // Error handling function - define this before any conditional returns
  const handleApiError = useCallback((error, functionName) => {
    console.error(`Error in ${functionName}:`, error);
    
    if (error.response) {
      if (error.response.status === 401) {
        // Unauthorized - token expired or invalid
        localStorage.removeItem('token');
        alert('Your session has expired. Please log in again.');
        navigate('/login');
        return true;
      } else if (error.response.data && error.response.data.message) {
        // Server returned an error message
        console.error(`Server error in ${functionName}:`, error.response.data.message);
        setError(error.response.data.message);
      }
    } else if (error.request) {
      // Request made but no response received
      console.error(`No response received in ${functionName}:`, error.request);
      setError('No response from server. Please check your internet connection and try again.');
      return true;
    } else {
      // Error in setting up request
      console.error(`Request setup error in ${functionName}:`, error.message);
      setError('An error occurred. Please try again.');
    }
    
    return false;
  }, [navigate]);

  // Scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, []);

  // Handle chat with a friend - Define this early to avoid hook ordering issues
  const handleChat = useCallback((friend) => {
    if (!friend || !friend._id) return;
    
    // Set the selected friend
    setSelectedFriend(friend);
    
    // Find existing conversation or create a new one
    const existingConversation = conversations.find(
      conversation => conversation.friendId === friend._id
    );
    
    if (existingConversation) {
      // Use existing conversation
      setActiveConversation(existingConversation);
      
      // Mark messages as read
      if (unreadMessages[friend._id]) {
        setUnreadMessages(prev => ({ ...prev, [friend._id]: 0 }));
      }
    } else {
      // Create new conversation
      const newConversation = {
        id: `conversation-${Date.now()}`,
        friendId: friend._id,
        name: friend.username || 'Unknown',
        avatar: friend.profileImage || '',
        messages: [],
        lastMessage: '',
        lastMessageTime: null
      };
      
      setConversations(prev => [...prev, newConversation]);
      setActiveConversation(newConversation);
    }
    
    // Switch to chats tab
    setActiveTab('chats');
  }, [conversations, unreadMessages]);

  // Fetch user data function - defined at component level
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/profile`);
      const userData = response.data;
      
      console.log("Profile data:", userData);
      
      // Only check phone verification if it's a new signup
      if (userData.isNewSignup && !userData.isPhoneVerified) {
        navigate('/verify-phone');
        return;
      }
      
      setUserProfile(userData);
      setProfileIncomplete(!userData.profileCompleted);
      
      try {
        // Fetch friend requests
        const requestsResponse = await axios.get(`${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/friend-requests`);
        console.log("Friend requests data:", requestsResponse.data);
        setFriendRequests(requestsResponse.data.requests || []);
      } catch (error) {
        console.error("Error fetching friend requests:", error);
      }
      
      try {
        // Fetch friends list
        const friendsResponse = await axios.get(`${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/friends`);
        console.log("Friends data:", friendsResponse.data);
        setFriends(friendsResponse.data.friends || []);
      } catch (error) {
        console.error("Error fetching friends:", error);
      }
      
      try {
        // Fetch matches
        const matchesResponse = await axios.get(`${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/matches`);
        console.log("Matches data:", matchesResponse.data);
        setMatches(matchesResponse.data.matches || []);
      } catch (error) {
        console.error("Error fetching matches:", error);
      }
      
      setLoading(false);
    } catch (error) {
      setLoading(false);
      const redirected = handleApiError(error, 'fetchData');
      if (!redirected) {
        setError('Failed to load profile data. Please try again.');
      }
    }
  };

  // Function to update conversations with new message
  const updateConversationWithMessage = useCallback((message) => {
    if (!message || !message.sender || !message.text) {
      console.error('Invalid message data:', message);
      return;
    }

    // Ensure timestamp is a Date object
    if (typeof message.timestamp === 'string') {
      message.timestamp = new Date(message.timestamp);
    }

    // Check if message is from current user
    const isSentByMe = message.sender === userProfile?._id;
    const partnerId = isSentByMe ? message.recipient : message.sender;

    // Check if active conversation
    const isActiveConversation = activeConversation?.friendId === partnerId;

    // Mark message as read if it's in active conversation and has a real ID
    if (isActiveConversation && !isSentByMe && socketRef.current && message._id && !message._id.startsWith('temp-')) {
      socketRef.current.emit('markAsRead', { messageId: message._id });
      
      // Clear unread count for this conversation
      setUnreadMessages(prev => ({ ...prev, [partnerId]: 0 }));
    }

    // Update conversations state
    setConversations(prevConversations => {
      // Find existing conversation with this user
      const existingConversationIndex = prevConversations.findIndex(
        conversation => conversation.friendId === partnerId
      );

      if (existingConversationIndex > -1) {
        // Update existing conversation
        const updatedConversations = [...prevConversations];
        const existingConversation = { ...updatedConversations[existingConversationIndex] };
        
        // Add new message to conversation
        existingConversation.messages = [
          ...existingConversation.messages, 
          {
            _id: message._id,
            text: message.text,
            sender: isSentByMe ? 'me' : partnerId,
            timestamp: message.timestamp,
            read: message.read || false
          }
        ];
        
        // Update last message and time
        existingConversation.lastMessage = message.text;
        existingConversation.lastMessageTime = message.timestamp;
        
        // Update conversation in array
        updatedConversations[existingConversationIndex] = existingConversation;
        
        // Scroll to bottom if active conversation
        if (isActiveConversation) {
          setTimeout(() => {
            if (chatWindowRef.current) {
              chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
            }
          }, 100);
        }
        
        // Increment unread count if not active conversation and not sent by me
        if (!isActiveConversation && !isSentByMe) {
          setUnreadMessages(prev => ({
            ...prev,
            [partnerId]: (prev[partnerId] || 0) + 1
          }));
        }
        
        return updatedConversations;
      } else {
        // Create new conversation with placeholder data
        // We'll fetch user info in the background
        const newConversation = {
          friendId: partnerId,
          name: 'Loading...',
          avatar: '',
          messages: [{
            _id: message._id,
            text: message.text,
            sender: isSentByMe ? 'me' : partnerId,
            timestamp: message.timestamp,
            read: message.read || false
          }],
          lastMessage: message.text,
          lastMessageTime: message.timestamp
        };
        
        // Fetch user info in the background
        axios.get(`${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/profile/${partnerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(response => {
            const userData = response.data;
            
            setConversations(prev => prev.map(convo => 
              convo.friendId === partnerId 
                ? { 
                    ...convo, 
                    name: userData.username || 'Unknown',
                    avatar: userData.profileImage || ''
                  }
                : convo
            ));
          })
          .catch(error => {
            console.error('Error fetching user data:', error);
          });
        
        // Increment unread count if not active and not sent by me
        if (!isActiveConversation && !isSentByMe) {
          setUnreadMessages(prev => ({
            ...prev,
            [partnerId]: (prev[partnerId] || 0) + 1
          }));
        }
        
        return [...prevConversations, newConversation];
      }
    });
  }, [userProfile, activeConversation, token]);

  // First check if token exists
  useEffect(() => {
    if (!token) {
      console.error("No token found, redirecting to login");
      navigate('/login', { replace: true });
    } else {
      setInitialized(true);
    }
  }, [token, navigate]);

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    // Only scroll to bottom if there are messages and the activeConversation has changed
    const hasMessages = activeConversation && 
      activeConversation.messages &&
      activeConversation.messages.length > 0;
      
    if (hasMessages && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation]); // Now using activeConversation as the dependency

  // Validate token on component mount
  useEffect(() => {
    console.log("Dashboard useEffect running");
    
    // Skip if no token
    if (!token) return;
    
    // Check token format (only if it's a string with Bearer prefix)
    if (typeof token === 'string' && token.startsWith('Bearer ')) {
      // Remove 'Bearer ' prefix
    const cleanToken = token.replace('Bearer ', '');
    
    // Set up axios default headers
    axios.defaults.headers.common['Authorization'] = `Bearer ${cleanToken}`;
    } else {
      // Just use the token as is
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    // Don't do token validation here - the backend will handle it
    
    // Call the fetchData function to load user data
    fetchData();
    
    // Clean up function
    return () => {
      // Clear any timeouts or subscriptions if needed
    };
  }, [navigate, token, handleApiError]); // Added token dependency

  // Separate useEffect for socket connection
  useEffect(() => {
    // Only set up socket if we have a token and a user profile
    if (!token || !userProfile) {
      return;
    }

    console.log('Setting up Socket.io connection');
    
    // Don't create a new socket if we already have one
    if (socketRef.current) {
      console.log('Socket already exists, not creating a new one');
      return;
    }
    
    // Create socket connection
    const newSocket = io(window.process.env.REACT_APP_SOCKET_URL || 'http://localhost:5002', {
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    // Connection events
    newSocket.on('connect', () => {
      console.log('Socket.io Connected');
      setSocket(newSocket);
      socketRef.current = newSocket;
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Socket.io Connection Error:', error.message);
      // Don't set socket to null here to allow reconnection attempts
    });
    
    newSocket.on('disconnect', (reason) => {
      console.log('Socket.io Disconnected', reason);
      // We don't set socket to null here to allow for reconnections
    });
    
    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`Socket.io Reconnected after ${attemptNumber} attempts`);
    });
    
    newSocket.on('reconnect_error', (err) => {
      console.error('Socket.io Reconnection Error:', err.message);
    });
    
    newSocket.on('reconnect_failed', () => {
      console.error('Socket.io Reconnection Failed');
      setSocket(null);
      socketRef.current = null;
    });
    
    // Message handling
    newSocket.on('newMessage', (message) => {
      console.log('New message received:', message);
      updateConversationWithMessage(message);
    });
    
    newSocket.on('messageSent', (message) => {
      console.log('Message sent confirmation:', message);
      updateConversationWithMessage(message);
    });
    
    // Handle online users
    newSocket.on('onlineUsers', ({ users }) => {
      console.log('Online users:', users);
      setOnlineUsers(users);
    });

    // Handle user status updates
    newSocket.on('userStatus', ({ userId, status }) => {
      console.log(`User ${userId} is now ${status}`);
      if (status === 'online') {
        setOnlineUsers(prev => Array.from(new Set([...prev, userId])));
      } else {
        setOnlineUsers(prev => prev.filter(id => id !== userId));
      }
    });

    // Handle typing indicators
    newSocket.on('userTyping', ({ userId }) => {
      setTypingUsers(prev => ({ ...prev, [userId]: true }));
    });

    newSocket.on('userStopTyping', ({ userId }) => {
      setTypingUsers(prev => ({ ...prev, [userId]: false }));
    });

    // Handle read receipts
    newSocket.on('messageRead', ({ messageId }) => {
      console.log('Message read:', messageId);
      // Update UI for read receipt
      setConversations(prev => {
        return prev.map(conv => {
          const updatedMessages = conv.messages.map(msg => {
            if (msg.id === messageId) {
              return { ...msg, read: true };
            }
            return msg;
          });
          return { ...conv, messages: updatedMessages };
        });
      });
    });

    // Handle errors
    newSocket.on('error', ({ message }) => {
      console.error('Socket error:', message);
    });

    // Clean up function
    return () => {
      console.log('Cleaning up Socket.io connection');
      if (newSocket) {
        newSocket.disconnect();
      }
      setSocket(null);
      socketRef.current = null;
    };
  }, [token, userProfile, updateConversationWithMessage]);

  // Handle sending messages
  const handleSendMessage = useCallback((text) => {
    if (!activeConversation || !text.trim()) return;
    
    const friendId = activeConversation.friendId;
    
    // Create a temporary message
    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender: 'me',
      text,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Add to conversation
    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.id === activeConversation.id) {
          return {
            ...conv,
            messages: [...conv.messages, tempMessage]
          };
        }
        return conv;
      });
      return updated;
    });
    
    // Update active conversation
    setActiveConversation(prev => ({
      ...prev,
      messages: [...prev.messages, tempMessage]
    }));
    
    // Scroll to bottom
    setTimeout(() => {
      if (chatWindowRef.current) {
        chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
      }
    }, 100);
    
    // Send to API
    axios.post(`${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/send-message`, 
      { recipientId: friendId, message: text },
      { headers: { Authorization: `Bearer ${token}` } }
    ).catch(error => {
      console.error('Error sending message:', error);
      // Handle error - could remove temp message or mark as failed
    });
  }, [activeConversation, token]);

  // Initialize profile form with user data
  const initializeProfileForm = useCallback(() => {
    if (userProfile) {
      setProfileUsername(userProfile.username || '');
      setProfileFullName(userProfile.profile?.fullName || '');
      setProfileBio(userProfile.profile?.bio || '');
      setProfileInterests(userProfile.profile?.interests ? userProfile.profile.interests.join(', ') : '');
      setProfileGender(userProfile.profile?.gender || '');
      setProfileAge(userProfile.profile?.age || '');
      setProfilePhone(userProfile.phoneNumber || '');
      setProfileLocation(userProfile.profile?.location || userProfile.preferences?.location || '');
    }
  }, [userProfile]);

  // Handle photo upload for profile
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Effect to initialize the profile form fields when userProfile changes
  useEffect(() => {
    if (userProfile) {
      initializeProfileForm();
    }
  }, [userProfile, initializeProfileForm]);

  // NOW after all hooks are defined, we can have conditional returns

  // If no token, show nothing while redirecting
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Redirecting...</h2>
          <p className="text-gray-500">Please wait while we redirect you to login</p>
        </div>
      </div>
    );
  }

  // If loading, show loading indicator
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Dashboard</h2>
          <p className="text-gray-500">Please wait while we load your profile...</p>
        </div>
      </div>
    );
  }

  // If error, show error message
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
          <div className="bg-red-100 p-3 rounded-full inline-block mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Something went wrong</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // If no user profile but initialized and not loading, show error
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
          <div className="bg-yellow-100 p-3 rounded-full inline-block mb-4">
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Profile Not Found</h2>
          <p className="text-gray-500 mb-4">We couldn't load your profile information.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
          >
            Refresh
          </button>
          <button 
            onClick={() => {
          localStorage.removeItem('token');
              navigate('/login', { replace: true });
            }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  // Rest of the component handlers and functions
  const handleFriendRequestResponse = async (requestId, action) => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/respond-friend-request`,
        { requestId, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        // Filter out the processed request
        const updatedRequests = friendRequests.filter(request => request._id !== requestId);
        setFriendRequests(updatedRequests);
        
        if (action === 'accept') {
          // If accepted, add to friends list
          const newFriend = response.data.friend;
          setFriends(prevFriends => [...prevFriends, newFriend]);
          
          alert('Friend request accepted!');
          
          // Start a chat with the new friend
          if (newFriend) {
            handleChat(newFriend._id, newFriend.username);
          }
      } else {
          alert('Friend request declined.');
        }
      } else {
        alert(response.data.message || 'Failed to process friend request.');
      }
    } catch (error) {
      console.error('Error responding to friend request:', error);
      alert('Failed to process friend request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Handle viewing a user's profile
  const handleViewProfile = (user) => {
    if (!user || !user._id) return;
    
    setViewingProfile(user);
    // You could navigate to a profile view page or show a modal
    // For now we'll just show a simple alert
    alert(`Viewing profile for ${user.username || 'Unknown User'}`);
    
    // In a real implementation, you might do:
    // navigate(`/user/${user._id}`);
    // or
    // setShowProfileModal(true);
  };

  // Handle sending a friend request
  const handleSendFriendRequest = async (userId) => {
    try {
      // Check if a friend request has already been sent
      const alreadySent = friendRequests.some(
        request => request.sender._id === userProfile._id && request.recipient._id === userId
      );
      
      if (alreadySent) {
        alert('You have already sent a friend request to this user.');
        return;
      }
      
      setLoading(true);
      const response = await axios.post(
        `${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/send-friend-request`,
        { recipientId: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        alert('Friend request sent successfully!');
        // Update the friend requests list
        const updatedFriendRequests = [...friendRequests, response.data.friendRequest];
        setFriendRequests(updatedFriendRequests);
      } else {
        alert(response.data.message || 'Failed to send friend request.');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Failed to send friend request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render content based on active tab
  const renderContent = () => {
    if (loading) {
  return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Dashboard</h2>
            <p className="text-gray-500">Please wait while we load your profile...</p>
            </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="bg-red-100 p-3 rounded-full inline-block mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Something went wrong</h2>
            <p className="text-gray-500 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
  return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches && matches.length > 0 ? (
              matches.map((match) => (
                <div key={match._id} className="bg-white rounded-xl shadow-md overflow-hidden border border-blue-100 hover:shadow-lg transition-shadow">
                  <div className="flex">
                    <div className="w-1/3 bg-blue-600 text-white flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl font-bold">E</div>
            </div>
                    </div>
                    <div className="w-2/3 p-4">
                      <h3 className="text-xl font-semibold">{match.username}</h3>
                      <p className="text-gray-500 flex items-center text-sm">
                        <span className="material-icons-outlined text-sm mr-1 text-blue-400">location_on</span>
                        Greater Noida, Uttar Pradesh, India
                      </p>

                      <div className="mt-3">
                        <div className="flex justify-between">
                          <div>
                            <p className="text-gray-600 text-sm">Rent</p>
                            <p className="font-semibold">₹ {match.preferences?.minBudget || 8000}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 text-sm">Looking for</p>
                            <p className="font-semibold">Any</p>
                          </div>
                          <div>
                            <p className="text-gray-600 text-sm">Preference</p>
                            <p className="font-semibold">Roommate</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 px-4 py-2 flex justify-between items-center border-t border-blue-100">
                  <div className="flex items-center">
                      <span className="flex items-center text-sm">
                        <span className="mr-1">0 km</span> from your search
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center">
                        <span className="material-icons-outlined text-blue-500 mr-1">favorite</span>
                        <span>{match.matchPercentage || 50}% Match</span>
                      </div>
                      <button 
                        onClick={() => handleSendFriendRequest(match._id)}
                        className="text-gray-500 hover:text-blue-600"
                      >
                        <span className="material-icons-outlined">chat</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-12 bg-white rounded-lg shadow-sm">
                <div className="text-5xl mb-4 text-blue-400">
                  <span role="img" aria-label="Search">🔍</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No matches found yet</h3>
                <p className="text-gray-500 mb-6">Update your preferences to find potential roommates!</p>
                <button
                  onClick={() => setActiveTab('preferences')}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow transition-colors"
                >
                  Update Preferences
                </button>
              </div>
            )}
          </div>
        );
      case 'matches':
        return (
          <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Your Matches</h2>
            <div className="bg-white p-4 rounded-lg shadow-lg">
              {loading ? (
                <div className="flex justify-center items-center p-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
                </div>
              ) : matches && matches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {matches.map(match => (
                    <div key={match._id} className="border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-b from-white to-blue-50">
                    <div className="relative">
                        <div className="h-32 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                        <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2">
                          <div className="h-20 w-20 rounded-full bg-white p-1 shadow-lg overflow-hidden">
                            {match.profileImage ? (
                              <img src={match.profileImage} alt={match.username} className="h-full w-full object-cover rounded-full" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-gradient-to-r from-blue-300 to-indigo-300 text-white text-xl font-bold rounded-full">
                                {match.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-12 p-4 text-center">
                        <h3 className="font-bold text-lg text-gray-800">{match.username}</h3>
                        <div className="mt-1 mb-3">
                          <span className="inline-block bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium px-3 py-1 rounded-full">
                            {match.matchPercentage || '90'}% match
                          </span>
                    </div>
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{match.bio || 'Looking for a compatible roommate.'}</p>
                        
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {match.preferences && Object.entries(match.preferences).slice(0, 4).map(([key, value]) => (
                            <div key={key} className="text-xs bg-blue-50 p-1 rounded text-blue-700">
                              <span className="font-medium">{key}: </span>{value}
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewProfile(match)}
                            className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                          >
                            View Profile
                          </button>
                          <button
                            onClick={() => {
                              // Send friend request logic
                              handleSendFriendRequest(match._id);
                            }}
                            className="flex-1 px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                          >
                            Connect
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">
                    <span role="img" aria-label="Search">🔍</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No matches found yet</h3>
                  <p className="text-gray-500 mb-6">Update your preferences to find potential roommates!</p>
                  <button
                    onClick={() => setActiveTab('preferences')}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200"
                  >
                    Update Preferences
                  </button>
                          </div>
                        )}
                      </div>
          </div>
        );
      case 'connections':
        return (
          <div className="p-4">
            <h2 className="text-2xl font-bold mb-6">Your Connections</h2>
            
            {/* Friend Requests Section */}
            {friendRequests && friendRequests.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-3 text-indigo-700">Friend Requests</h3>
                <div className="bg-white p-5 rounded-xl shadow-lg mb-4">
                  {friendRequests.map(request => (
                    <div key={request._id} className="flex items-center justify-between border-b pb-4 mb-4 last:border-0 last:mb-0 last:pb-0 hover:bg-blue-50 p-3 rounded-lg transition-colors">
                      <div className="flex items-center">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200 mr-4 overflow-hidden shadow-md border-2 border-white">
                          {request.fromUserData?.profileImage ? (
                            <img src={request.fromUserData.profileImage} alt={request.fromUserData.username} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-gradient-to-r from-blue-300 to-indigo-300 text-white text-xl font-bold">
                              {request.fromUserData?.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                        <div>
                          <h4 className="font-bold text-lg text-gray-800">{request.fromUserData?.username || 'Unknown User'}</h4>
                          <p className="text-gray-600 text-sm">Wants to connect with you</p>
                  </div>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleFriendRequestResponse(request._id, 'accept')}
                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-colors shadow-md"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleFriendRequestResponse(request._id, 'reject')}
                          className="px-4 py-2 bg-gradient-to-r from-red-400 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-600 transition-colors shadow-md"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
        </div>
              </div>
            )}
            
            {/* Friends Section */}
            <h3 className="text-xl font-semibold mb-3 text-indigo-700">Friends</h3>
            <div className="bg-white p-5 rounded-xl shadow-lg">
              {friends && friends.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {friends.map(friend => (
                    <div key={friend._id} className="border rounded-xl p-5 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white via-white to-blue-50">
                      <div className="flex items-center mb-4">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200 mr-4 overflow-hidden shadow-md border-2 border-white">
                          {friend.profileImage ? (
                            <img src={friend.profileImage} alt={friend.username} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-gradient-to-r from-blue-300 to-indigo-300 text-white text-xl font-bold">
                              {friend.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-gray-800">{friend.username}</h3>
                          <p className="text-sm text-gray-600">
                            {onlineUsers.includes(friend._id) ? 
                              <span className="text-green-500 flex items-center">
                                <span className="h-2 w-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                                Online
                              </span> : 
                              <span className="text-gray-400 flex items-center">
                                <span className="h-2 w-2 bg-gray-300 rounded-full mr-1"></span>
                                Offline
                              </span>
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2 mt-4">
                        <button
                          onClick={() => handleChat(friend)}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors shadow-md"
                        >
                          Message
                        </button>
                        <button
                          onClick={() => handleViewProfile(friend)}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-lg hover:from-gray-200 hover:to-gray-300 transition-colors shadow-sm"
                        >
                          Profile
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">
                    <span role="img" aria-label="Waving hand">👋</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No connections yet</h3>
                  <p className="text-gray-500 mb-6">Find matches to connect with potential roommates!</p>
                  <button
                    onClick={() => setActiveTab('matches')}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200"
                  >
                    Find Matches
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      case 'chats':
        return (
          <div className="p-4">
            <h2 className="text-2xl font-bold mb-6">Messages</h2>
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {conversations && conversations.length > 0 ? (
                <div className="flex flex-col md:flex-row h-[600px]">
                  <div className="w-full md:w-1/3 border-r border-gray-200 overflow-y-auto">
                    {conversations.map(conversation => (
                      <div 
                        key={conversation.friendId}
                        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                          activeConversation?.friendId === conversation.friendId 
                            ? 'bg-blue-50 border-l-4 border-blue-500' 
                            : 'hover:bg-gray-50 border-l-4 border-transparent'
                        }`}
                        onClick={() => setActiveConversation(conversation)}
                      >
              <div className="flex items-center">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200 mr-3 overflow-hidden shadow-md border border-white relative">
                            {conversation.avatar ? (
                              <img src={conversation.avatar} alt={conversation.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-gradient-to-r from-blue-300 to-indigo-300 text-white text-lg font-bold">
                                {conversation.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                            {onlineUsers.includes(conversation.friendId) && (
                              <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border border-white"></div>
                            )}
                          </div>
                          <div className="pr-2">
                            <h4 className="font-medium text-gray-800">{conversation.name}</h4>
                            <p className="text-xs text-gray-500 truncate max-w-[150px]">
                              {typingUsers[conversation.friendId] 
                                ? <span className="text-blue-500">typing...</span>
                                : conversation.lastMessage || 'Start a conversation'}
                            </p>
                          </div>
                        </div>
                        {unreadMessages[conversation.friendId] > 0 && (
                          <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            {unreadMessages[conversation.friendId]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="w-full md:w-2/3 flex flex-col h-full">
                    {activeConversation ? (
                      <>
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200 mr-3 overflow-hidden shadow-sm">
                              {activeConversation.avatar ? (
                                <img src={activeConversation.avatar} alt={activeConversation.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-gradient-to-r from-blue-300 to-indigo-300 text-white text-sm font-bold">
                                  {activeConversation.name.charAt(0).toUpperCase()}
                                </div>
                  )}
                </div>
    <div>
                              <h3 className="font-medium text-gray-800">{activeConversation.name}</h3>
                              <p className="text-xs text-gray-500">
                    {onlineUsers.includes(activeConversation.friendId) 
                                  ? <span className="text-green-500">Online</span>
                      : 'Offline'}
                              </p>
                  </div>
                </div>
              <button 
                onClick={() => {
                  const friend = friends.find(f => f._id === activeConversation.friendId);
                              if (friend) handleViewProfile(friend);
                }}
                            className="text-gray-500 hover:text-gray-700"
              >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
              </button>
            </div>
            
                        <div className="flex-grow overflow-y-auto p-4 bg-gray-50" ref={chatWindowRef}>
                          {activeConversation.messages && activeConversation.messages.length > 0 ? (
                            <div className="space-y-3">
              {activeConversation.messages.map((message, index) => (
                <div 
                                  key={message._id || index} 
                                  className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                                    className={`max-w-[70%] p-3 rounded-lg shadow-sm ${
                                      message.sender === 'me' 
                                        ? 'bg-blue-500 text-white rounded-br-none' 
                                        : 'bg-white text-gray-800 rounded-bl-none'
                                    }`}
                                  >
                                    <p>{message.text}</p>
                                    <div className="text-xs mt-1 text-right">
                                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {message.sender === 'me' && (
                                        <span className="ml-1">
                                          {message.read ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
                              <div ref={messagesEndRef} />
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <div className="text-center text-gray-500">
                                <p>No messages yet</p>
                                <p className="text-sm">Start the conversation by sending a message</p>
                  </div>
                </div>
              )}
            </div>
            
                        <div className="p-4 border-t border-gray-200 bg-white">
                          <form onSubmit={(e) => {
                  e.preventDefault();
                  if (messageInput.trim()) {
                    handleSendMessage(messageInput);
                    setMessageInput('');
                  }
                          }} className="flex items-center">
                <input
                  type="text"
                  value={messageInput}
                              onChange={(e) => {
                                setMessageInput(e.target.value);
                                
                                // Handle typing indicator
                                if (!isTyping) {
                                  setIsTyping(true);
                                  if (socket) {
                                    socket.emit('typing', { recipientId: activeConversation.friendId });
                                  }
                                }
                                
                                // Clear previous timeout
                                if (typingTimeoutRef.current) {
                                  clearTimeout(typingTimeoutRef.current);
                                }
                                
                                // Set timeout to stop typing indicator
                                typingTimeoutRef.current = setTimeout(() => {
                                  setIsTyping(false);
                                  if (socket) {
                                    socket.emit('stopTyping', { recipientId: activeConversation.friendId });
                                  }
                                }, 2000);
                              }}
                  placeholder="Type a message..."
                              className="flex-grow px-4 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="submit"
                              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-r-lg hover:from-blue-600 hover:to-blue-700"
                >
                              Send
                </button>
              </form>
            </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center text-gray-500 p-6">
                          <div className="text-5xl mb-4">
                            <span role="img" aria-label="Message bubble">💬</span>
                          </div>
                          <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a conversation</h3>
                          <p className="mb-6">Choose a conversation from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>
        </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">
                    <span role="img" aria-label="Message bubble">💬</span>
        </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No messages yet</h3>
                  <p className="text-gray-500 mb-6">Connect with other users to start chatting!</p>
              <button 
                    onClick={() => setActiveTab('matches')}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200"
              >
                    Find Matches
              </button>
                        </div>
                      )}
                    </div>
                    </div>
        );
      case 'preferences':
        return (
          <div className="p-4">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Roommate Preferences</h2>
            
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {!editingPreferences ? (
                <div className="p-6">
                  {userProfile?.preferences ? (
                    <div className="mb-6">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white rounded-lg mb-6">
                        <div className="flex items-center justify-between">
                    <div>
                            <h3 className="text-xl font-bold mb-1">Your Preferences</h3>
                            <p className="text-blue-100">These help us find your perfect roommate match</p>
                    </div>
                          <div className="text-4xl">⚙️</div>
                    </div>
                  </div>
                  
                      <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 shadow-sm transition-all duration-300 hover:shadow-md">
                          <div className="flex items-center mb-4">
                            <span className="text-2xl mr-3">💰</span>
                            <h4 className="font-semibold text-lg text-blue-800">Budget</h4>
                        </div>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Min Budget:</span>
                              <span className="font-medium text-blue-700">₹{userProfile.preferences.minBudget || 0}</span>
                      </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Max Budget:</span>
                              <span className="font-medium text-blue-700">₹{userProfile.preferences.maxBudget || 0}</span>
                        </div>
                      </div>
                    </div>
                    
                        <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100 shadow-sm transition-all duration-300 hover:shadow-md">
                          <div className="flex items-center mb-4">
                            <span className="text-2xl mr-3">👤</span>
                            <h4 className="font-semibold text-lg text-indigo-800">Roommate</h4>
                      </div>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Gender:</span>
                              <span className="font-medium text-indigo-700">{userProfile.preferences.genderPreference || 'Any'}</span>
                  </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Age Range:</span>
                              <span className="font-medium text-indigo-700">{userProfile.preferences.minAge || 18} - {userProfile.preferences.maxAge || 35}</span>
                </div>
              </div>
            </div>
                        
                        <div className="bg-purple-50 rounded-xl p-5 border border-purple-100 shadow-sm transition-all duration-300 hover:shadow-md">
                          <div className="flex items-center mb-4">
                            <span className="text-2xl mr-3">🏠</span>
                            <h4 className="font-semibold text-lg text-purple-800">Location</h4>
            </div>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Area:</span>
                              <span className="font-medium text-purple-700">{userProfile.preferences.area || 'No Preference'}</span>
            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">City:</span>
                              <span className="font-medium text-purple-700">{userProfile.preferences.city || 'No Preference'}</span>
            </div>
                    </div>
                  </div>
                    </div>
                      
                      <div className="mt-6">
                        <h4 className="font-semibold text-lg mb-3 border-b pb-2">Lifestyle Preferences</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                          <div className="bg-white rounded-lg p-3 border shadow-sm">
                            <div className="flex items-center mb-1">
                              <span className="text-xl mr-2">🚬</span>
                              <h5 className="font-medium text-gray-800">Smoking</h5>
                    </div>
                            <p className="text-gray-700 mt-1">{userProfile.preferences.smoking || 'No Preference'}</p>
                  </div>
                          <div className="bg-white rounded-lg p-3 border shadow-sm">
                            <div className="flex items-center mb-1">
                              <span className="text-xl mr-2">🍷</span>
                              <h5 className="font-medium text-gray-800">Drinking</h5>
                    </div>
                            <p className="text-gray-700 mt-1">{userProfile.preferences.drinking || 'No Preference'}</p>
                  </div>
                          <div className="bg-white rounded-lg p-3 border shadow-sm">
                            <div className="flex items-center mb-1">
                              <span className="text-xl mr-2">🍲</span>
                              <h5 className="font-medium text-gray-800">Food</h5>
                    </div>
                            <p className="text-gray-700 mt-1">{userProfile.preferences.foodPreference || 'No Preference'}</p>
                  </div>
                          <div className="bg-white rounded-lg p-3 border shadow-sm">
                            <div className="flex items-center mb-1">
                              <span className="text-xl mr-2">✨</span>
                              <h5 className="font-medium text-gray-800">Cleanliness</h5>
                    </div>
                            <p className="text-gray-700 mt-1">{userProfile.preferences.cleanliness || 'No Preference'}</p>
                  </div>
                          <div className="bg-white rounded-lg p-3 border shadow-sm">
                            <div className="flex items-center mb-1">
                              <span className="text-xl mr-2">🐾</span>
                              <h5 className="font-medium text-gray-800">Pets</h5>
                    </div>
                            <p className="text-gray-700 mt-1">{userProfile.preferences.pets || 'No Preference'}</p>
                  </div>
                          <div className="bg-white rounded-lg p-3 border shadow-sm">
                            <div className="flex items-center mb-1">
                              <span className="text-xl mr-2">⏰</span>
                              <h5 className="font-medium text-gray-800">Schedule</h5>
                    </div>
                            <p className="text-gray-700 mt-1">{userProfile.preferences.workSchedule || 'No Preference'}</p>
                  </div>
                    </div>
                  </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">⚙️</span>
                  </div>
                      <h3 className="text-xl font-semibold text-gray-700 mb-2">No Preferences Set</h3>
                      <p className="text-gray-500 mb-6 max-w-md mx-auto">You haven't set your roommate preferences yet. Setting preferences helps us find better matches for you.</p>
              </div>
                  )}
              
                  <div className="mt-6 text-center">
                <button
                      onClick={() => setEditingPreferences(true)}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200"
                >
                      {userProfile?.preferences ? 'Update Preferences' : 'Set Preferences'}
                </button>
              </div>
            </div>
          ) : (
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Edit Your Preferences</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    
                    // Create a data object for the textual profile data
                    const preferencesData = {
                      minBudget: formData.get('minBudget'),
                      maxBudget: formData.get('maxBudget'),
                      genderPreference: formData.get('genderPreference'),
                      minAge: formData.get('minAge'),
                      maxAge: formData.get('maxAge'),
                      area: formData.get('area'),
                      city: formData.get('city'),
                      smoking: formData.get('smoking'),
                      drinking: formData.get('drinking'),
                      foodPreference: formData.get('foodPreference'),
                      cleanliness: formData.get('cleanliness'),
                      pets: formData.get('pets'),
                      workSchedule: formData.get('workSchedule')
                    };
                    
                    try {
                      setLoading(true);
                      
                      // Then update the preferences data
                      const response = await axios.post(
                        `${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/update-preferences`,
                        preferencesData,
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      
                      if (response.data.success) {
                        // Update user preferences with new data
                        setUserProfile({
                          ...userProfile,
                          preferences: preferencesData
                        });
                        setEditingPreferences(false);
                        alert('Preferences updated successfully!');
                      } else {
                        alert(response.data.message || 'Failed to update preferences.');
                      }
                    } catch (error) {
                      console.error('Error updating preferences:', error);
                      alert('Failed to update preferences. Please try again.');
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-gray-700 mb-1">Min Budget</label>
                          <input 
                            type="number" 
                            name="minBudget"
                            defaultValue={userProfile?.preferences?.minBudget || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
            </div>
                        
                        <div>
                          <label className="block text-gray-700 mb-1">Max Budget</label>
                          <input 
                            type="number" 
                            name="maxBudget"
                            defaultValue={userProfile?.preferences?.maxBudget || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
            </div>
                        
                        <div>
                          <label className="block text-gray-700 mb-1">Gender Preference</label>
                          <select 
                            name="genderPreference"
                            defaultValue={userProfile?.preferences?.genderPreference || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          >
                            <option value="">Any</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Non-binary">Non-binary</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                          </select>
              </div>
                        
                        <div>
                          <label className="block text-gray-700 mb-1">Age Range</label>
                          <input 
                            type="text" 
                            name="minAge"
                            defaultValue={userProfile?.preferences?.minAge || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
            </div>
                        
                        <div>
                          <label className="block text-gray-700 mb-1">Age Range</label>
                          <input 
                            type="text" 
                            name="maxAge"
                            defaultValue={userProfile?.preferences?.maxAge || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
                            </div>
                        </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-gray-700 mb-1">Area</label>
                          <input 
                            type="text" 
                            name="area"
                            defaultValue={userProfile?.preferences?.area || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-gray-700 mb-1">City</label>
                          <input 
                            type="text" 
                            name="city"
                            defaultValue={userProfile?.preferences?.city || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
                      </div>
                        
                        <div>
                          <label className="block text-gray-700 mb-1">Smoking</label>
                          <input 
                            type="text" 
                            name="smoking"
                            defaultValue={userProfile?.preferences?.smoking || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
                      </div>
                        
                        <div>
                          <label className="block text-gray-700 mb-1">Drinking</label>
                          <input 
                            type="text" 
                            name="drinking"
                            defaultValue={userProfile?.preferences?.drinking || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
                  </div>

                      <div>
                          <label className="block text-gray-700 mb-1">Food</label>
                          <input 
                            type="text" 
                            name="foodPreference"
                            defaultValue={userProfile?.preferences?.foodPreference || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
                      </div>
                        
                      <div>
                          <label className="block text-gray-700 mb-1">Cleanliness</label>
                          <input 
                            type="text" 
                            name="cleanliness"
                            defaultValue={userProfile?.preferences?.cleanliness || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
                      </div>
                        
                      <div>
                          <label className="block text-gray-700 mb-1">Pets</label>
                          <input 
                            type="text" 
                            name="pets"
                            defaultValue={userProfile?.preferences?.pets || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
                      </div>
                        
                      <div>
                          <label className="block text-gray-700 mb-1">Work Schedule</label>
                          <input 
                            type="text" 
                            name="workSchedule"
                            defaultValue={userProfile?.preferences?.workSchedule || ''}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-end space-x-4">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPreferences(false);
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                      >
                        {loading ? (
                          <>
                            <span className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Saving...
                          </>
                        ) : (
                          'Save Preferences'
                        )}
                      </button>
                    </div>
                  </form>
            </div>
          )}
        </div>
        </div>
      );
      case 'profile':
  return (
          <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Your Profile</h2>
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-24 w-24 rounded-full bg-white p-1 overflow-hidden">
                    {userProfile?.profile?.photoUrl ? (
                      <img
                        src={`${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}${userProfile.profile.photoUrl}`} 
                        alt={userProfile.username}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-r from-blue-300 to-indigo-300 text-white text-2xl font-bold rounded-full">
                        {userProfile.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="text-white">
                    <h3 className="text-2xl font-bold">{userProfile.username}</h3>
                    <p className="opacity-90">{userProfile.email}</p>
                    <div className="flex items-center mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        userProfile.isEmailVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {userProfile.isEmailVerified ? '✓ Email Verified' : '! Email Not Verified'}
                      </span>
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        userProfile.isPhoneVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {userProfile.isPhoneVerified ? '✓ Phone Verified' : '! Phone Not Verified'}
                      </span>
                    </div>
                  </div>
                </div>
                {!editingProfile && (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="px-4 py-2 bg-white text-indigo-600 rounded-lg shadow-md hover:bg-indigo-50 transition-colors"
                  >
                    ✏️ Edit Profile
                  </button>
              )}
            </div>
          </div>
            
            <div className="bg-white p-6 rounded-b-lg shadow-lg mb-6">
              {editingProfile ? (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setLoading(true);
                    
                    // Prepare form data
                    const formData = new FormData();
                    
                    // Add photo if selected
                    if (photoFile) {
                      formData.append('profileImage', photoFile);
                    }
                    
                    // First upload photo if there is one
                    let photoUrl = userProfile?.profile?.photoUrl;
                    
                    if (photoFile) {
                      try {
                        const photoResponse = await axios.post(
                          `${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/profile/image`,
                          formData,
                          { 
                            headers: { 
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'multipart/form-data'
                            } 
                          }
                        );
                        
                        if (photoResponse.data && photoResponse.data.photoUrl) {
                          photoUrl = photoResponse.data.photoUrl;
                          console.log("Photo uploaded successfully:", photoUrl);
                        }
                      } catch (photoError) {
                        console.error("Error uploading photo:", photoError);
                        // Continue with profile update even if photo upload fails
                      }
                    }
                    
                    // Now update profile data
                    const profileData = {
                      profile: {
                        fullName: profileFullName,
                        bio: profileBio,
                        interests: profileInterests.split(',').map(item => item.trim()),
                        gender: profileGender,
                        age: profileAge,
                        phoneNumber: profilePhone,
                        location: profileLocation,
                        photoUrl: photoUrl
                      }
                    };
                    
                    const response = await axios.put(
                      `${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/profile`,
                      profileData,
                      { 
                        headers: { 
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        } 
                      }
                    );
                    
                    if (response.data) {
                      // Update user profile state with the new data
                      setUserProfile(prevProfile => ({
                        ...prevProfile,
                        profile: {
                          ...prevProfile.profile,
                          fullName: profileFullName,
                          bio: profileBio,
                          interests: profileInterests.split(',').map(item => item.trim()),
                          gender: profileGender,
                          age: profileAge,
                          phoneNumber: profilePhone,
                          location: profileLocation,
                          photoUrl: photoUrl || prevProfile.profile?.photoUrl
                        }
                      }));
                      
                      setEditingProfile(false);
                      setPhotoFile(null);
                      setPhotoPreview(null);
                      
                      alert('Profile updated successfully!');
                    }
                  } catch (error) {
                    console.error('Error updating profile:', error);
                    
                    // Handle specific errors
                    if (error.response && error.response.data && error.response.data.message) {
                      alert(`Failed to update profile: ${error.response.data.message}`);
                    } else {
                      alert('Failed to update profile. Please try again.');
                    }
                  } finally {
                    setLoading(false);
                  }
                }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-lg mb-4 text-gray-700">Personal Information</h3>
                      
                      <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-medium mb-1">Username</label>
                        <input
                          type="text"
                          value={profileUsername}
                          onChange={(e) => setProfileUsername(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
          </div>
                      
                      <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-medium mb-1">Full Name</label>
                        <input
                          type="text"
                          value={profileFullName}
                          onChange={(e) => setProfileFullName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-medium mb-1">Gender</label>
                        <select
                          value={profileGender}
                          onChange={(e) => setProfileGender(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Non-binary">Non-binary</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-medium mb-1">Age</label>
                        <input
                          type="number"
                          min="18"
                          max="99"
                          value={profileAge}
                          onChange={(e) => setProfileAge(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-medium mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-medium mb-1">Location</label>
                        <input
                          type="text"
                          value={profileLocation}
                          onChange={(e) => setProfileLocation(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="City, State"
                        />
                  </div>
                </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-4 text-gray-700">About Me</h3>
                      
                      <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-medium mb-1">Profile Photo</label>
                        <div className="flex items-center space-x-4">
                          <div className="h-16 w-16 rounded-full bg-gray-200 overflow-hidden">
                            {photoPreview ? (
                              <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                            ) : userProfile?.profile?.photoUrl ? (
                              <img 
                                src={userProfile.profile.photoUrl.startsWith('http') 
                                  ? userProfile.profile.photoUrl
                                  : `${window.process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}${userProfile.profile.photoUrl}`} 
                                alt={userProfile.username} 
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  console.error("Image failed to load:", e);
                                  e.target.onerror = null;
                                  e.target.src = 'https://via.placeholder.com/150?text=Profile';
                                }}
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-gray-300 text-white text-xl font-bold">
                                {profileUsername.charAt(0).toUpperCase()}
                </div>
        )}
      </div>
                          <label className="px-4 py-2 bg-blue-50 text-blue-600 rounded-md cursor-pointer hover:bg-blue-100 transition-colors">
                            Choose Photo
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handlePhotoChange}
                            />
                          </label>
          </div>
        </div>
                      
                      <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-medium mb-1">Bio</label>
                        <textarea
                          value={profileBio}
                          onChange={(e) => setProfileBio(e.target.value)}
                          rows="4"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Tell others about yourself..."
                        ></textarea>
            </div>
            
                      <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-medium mb-1">Interests (comma separated)</label>
                        <input
                          type="text"
                          value={profileInterests}
                          onChange={(e) => setProfileInterests(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Reading, Hiking, Cooking, etc."
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProfile(false);
                        setPhotoFile(null);
                        setPhotoPreview(null);
                        // Reset form fields to current profile values
                        initializeProfileForm();
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md hover:from-blue-600 hover:to-indigo-700 transition-colors shadow-md"
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Saving...
                  </div>
                      ) : (
                        'Save Profile'
                      )}
                    </button>
                </div>
                </form>
              ) : (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-lg mb-4 text-gray-700">Personal Information</h3>
                      <table className="w-full">
                        <tbody>
                          <tr>
                            <td className="pb-2 pr-4 text-gray-500 font-medium">Full Name:</td>
                            <td className="pb-2">{userProfile?.profile?.fullName || 'Not set'}</td>
                          </tr>
                          <tr>
                            <td className="pb-2 pr-4 text-gray-500 font-medium">Gender:</td>
                            <td className="pb-2">{userProfile?.profile?.gender || 'Not set'}</td>
                          </tr>
                          <tr>
                            <td className="pb-2 pr-4 text-gray-500 font-medium">Age:</td>
                            <td className="pb-2">{userProfile?.profile?.age || 'Not set'}</td>
                          </tr>
                          <tr>
                            <td className="pb-2 pr-4 text-gray-500 font-medium">Phone:</td>
                            <td className="pb-2">{userProfile?.phoneNumber || 'Not set'}</td>
                          </tr>
                          <tr>
                            <td className="pb-2 pr-4 text-gray-500 font-medium">Location:</td>
                            <td className="pb-2">{userProfile?.profile?.location || userProfile?.preferences?.location || 'Not set'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-lg mb-4 text-gray-700">About Me</h3>
                      <div className="mb-4">
                        <h4 className="text-gray-500 font-medium mb-1">Bio</h4>
                        <p className="text-gray-800">{userProfile?.profile?.bio || 'No bio provided yet.'}</p>
                </div>
                
                      <div>
                        <h4 className="text-gray-500 font-medium mb-2">Interests</h4>
                        {userProfile?.profile?.interests && userProfile.profile.interests.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {userProfile.profile.interests.map((interest, index) => (
                            <span 
                                key={index} 
                                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                              >
                                {interest}
                            </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600">No interests added yet.</p>
                        )}
                          </div>
                        </div>
                          </div>
                        </div>
                      )}
                          </div>
                        </div>
        );
      default:
        return (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a tab</h3>
            <p className="text-gray-500">Choose a tab from the navigation menu above.</p>
                          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-6">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-800">
              <span className="text-blue-500">Roommate</span>
              <span className="text-gray-700">Finder</span>
              <sup className="text-xs">®</sup>
            </h1>
                          </div>
          <div className="flex items-center space-x-4">
            <button 
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full flex items-center"
              onClick={() => setActiveTab('matches')}
            >
              <span className="mr-1">+</span> Add Listing
            </button>
            <div className="relative">
              <img 
                src={userProfile?.profileImage ? 
                  userProfile.profileImage : 
                  `https://ui-avatars.com/api/?name=${userProfile?.username || 'User'}&background=0D8ABC&color=fff`} 
                alt="Profile" 
                className="w-10 h-10 rounded-full cursor-pointer border-2 border-white shadow-sm"
                onClick={() => setActiveTab('profile')}
              />
                        </div>
                          </div>
                        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="container mx-auto">
          <nav className="flex justify-between items-center">
            <div className="flex">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-6 py-4 font-medium flex items-center ${
                  activeTab === 'dashboard' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500'
                }`}
              >
                <span className="mr-2 text-xl">🏠</span>
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('matches')}
                className={`px-6 py-4 font-medium flex items-center ${
                  activeTab === 'matches' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500'
                }`}
              >
                <span className="mr-2 text-xl">❤️</span>
                Matches
              </button>
              <button
                onClick={() => setActiveTab('connections')}
                className={`px-6 py-4 font-medium flex items-center ${
                  activeTab === 'connections' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500'
                }`}
              >
                <span className="mr-2 text-xl">👥</span>
                Connections
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`px-6 py-4 font-medium flex items-center ${
                  activeTab === 'messages' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500'
                }`}
              >
                <span className="mr-2 text-xl">💬</span>
                Messages
              </button>
              <button
                onClick={() => setActiveTab('preferences')}
                className={`px-6 py-4 font-medium flex items-center ${
                  activeTab === 'preferences' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500'
                }`}
              >
                <span className="mr-2 text-xl">⚙️</span>
                Preferences
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-6 py-4 font-medium flex items-center ${
                  activeTab === 'profile' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500'
                }`}
              >
                <span className="mr-2 text-xl">👤</span>
                Profile
              </button>
                          </div>
            <button
              onClick={handleLogout}
              className="px-6 py-4 font-medium flex items-center text-red-500 hover:text-red-600"
            >
              <span className="mr-2 text-xl">🚪</span>
              Logout
            </button>
          </nav>
                        </div>
      </div>

      {/* Search Bar */}
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center">
          <div className="flex-grow">
            <div className="flex border border-blue-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-white px-4 py-2 flex items-center text-gray-600 border-r border-blue-100">
                <span className="material-icons-outlined text-blue-400">location_on</span>
                <input 
                  type="text" 
                  placeholder="Greater Noida, Uttar Pradesh, India" 
                  className="ml-2 outline-none w-64"
                />
                          </div>
              <div className="bg-white px-4 py-2 flex items-center">
                <span className="material-icons-outlined text-blue-400">search</span>
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="ml-2 outline-none w-40"
                />
                        </div>
                    </div>
                  </div>
          <div className="ml-4">
            <button className="bg-white px-4 py-2 rounded-lg border border-blue-200 shadow-sm flex items-center">
              <span>All</span>
              <span className="material-icons-outlined ml-1 text-blue-500">expand_more</span>
            </button>
              </div>
            </div>
          </div>

      {/* Slogan */}
      <div className="container mx-auto px-6 py-2 text-gray-700">
        <p>You can make team & find roommates together <button className="text-blue-600 font-medium">Create Team</button></p>
        </div>

      {/* Main Content - Use a lighter background */}
      <div className="container mx-auto px-6 py-4 flex-grow bg-blue-50 rounded-lg">
        {renderContent()}
      </div>
    </div>
  );
};

export default Dashboard;