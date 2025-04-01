import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import './Dashboard.css';
import PreferenceForm from '../components/PreferenceForm';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('profile');
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
  const [sentRequests, setSentRequests] = useState({});
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
  const [viewingProfile, setViewingProfile] = useState(null);
  const token = localStorage.getItem('token');
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const chatWindowRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, []);

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

  // Check verification status and redirect if needed
  useEffect(() => {
    // First check if token exists
    if (!token) {
      navigate('/login');
      return;
    }
    
    // Check verification status
    const emailVerified = localStorage.getItem('emailVerified') === 'true';
    const phoneVerified = localStorage.getItem('phoneVerified') === 'true';
    
    if (!emailVerified && !phoneVerified) {
      // Neither email nor phone verified
      navigate('/verify-email');
    } else if (!emailVerified) {
      // Email not verified
      navigate('/verify-email');
    } else if (!phoneVerified) {
      // Phone not verified
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      navigate('/phone-verification', { 
        state: { phoneNumber: user.phoneNumber || '' }
      });
    }
  }, [token, navigate]);

  // Socket.io connection
  useEffect(() => {
    if (!token || !userProfile?._id) return;

    // Connect to Socket.io server
    const newSocket = io('http://localhost:5002', {
      auth: { token },
      query: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    
    socketRef.current = newSocket;
    setSocket(newSocket);

    // Socket event listeners
    newSocket.on('connect', () => {
      console.log('Connected to Socket.io server');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (!newSocket.connected) {
          newSocket.connect();
        }
      }, 5000);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from Socket.io server:', reason);
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        newSocket.connect();
      }
    });

    // Handle new message
    newSocket.on('newMessage', (message) => {
      console.log('New message received:', message);
      
      // Convert ISO timestamp string to Date object
      if (typeof message.timestamp === 'string') {
        message.timestamp = new Date(message.timestamp);
      }
      
      const isSentByMe = message.sender === userProfile._id;
      const partnerId = isSentByMe ? message.recipient : message.sender;
      
      setConversations(prevConversations => {
        // Find existing conversation
        const existingConversationIndex = prevConversations.findIndex(
          conversation => conversation.friendId === partnerId
        );
        
        if (existingConversationIndex > -1) {
          // Update existing conversation
          const updatedConversations = [...prevConversations];
          const existingConversation = { ...updatedConversations[existingConversationIndex] };
          
          // Format the message for the UI
          const formattedMessage = {
            _id: message._id,
            text: message.text,
            sender: isSentByMe ? 'me' : partnerId,
            timestamp: message.timestamp,
            read: message.read || false
          };
          
          // Add message to conversation
          existingConversation.messages = [
            ...existingConversation.messages,
            formattedMessage
          ];
          
          // Update last message info
          existingConversation.lastMessage = message.text;
          existingConversation.lastMessageTime = message.timestamp;
          
          // Update in array
          updatedConversations[existingConversationIndex] = existingConversation;
          
          // If not active conversation and not sent by me, increment unread count
          if (!activeConversation || activeConversation.friendId !== partnerId) {
            if (!isSentByMe) {
              setUnreadMessages(prev => ({
                ...prev,
                [partnerId]: (prev[partnerId] || 0) + 1
              }));
            }
          } else {
            // If this is the active conversation, mark as read
            if (!isSentByMe && socket) {
              socket.emit('markAsRead', { messageId: message._id });
            }
            
            // Scroll to bottom
            setTimeout(() => {
              if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }, 100);
          }
          
          // Move conversation to top
          const [updated] = updatedConversations.splice(existingConversationIndex, 1);
          return [updated, ...updatedConversations];
        } else {
          // Create new conversation
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
          
          // Fetch user info
          axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/profile/${partnerId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(response => {
              const userData = response.data;
              setConversations(prev => 
                prev.map(convo => 
                  convo.friendId === partnerId 
                    ? {
                        ...convo,
                        name: userData.username || 'Unknown',
                        avatar: userData.profileImage || ''
                      }
                    : convo
                )
              );
            })
            .catch(error => {
              console.error('Error fetching user data:', error);
            });
          
          // If not sent by me, increment unread count
          if (!isSentByMe) {
            setUnreadMessages(prev => ({
              ...prev,
              [partnerId]: (prev[partnerId] || 0) + 1
            }));
          }
          
          return [newConversation, ...prevConversations];
        }
      });
    });

    // Handle message sent confirmation
    newSocket.on('messageSent', (message) => {
      console.log('Message sent confirmation received:', message);
      
      // Convert the ISO timestamp string back to a Date object if needed
      if (typeof message.timestamp === 'string') {
        message.timestamp = new Date(message.timestamp);
      }
      
      setConversations(prev => {
        return prev.map(convo => {
          if (convo.friendId === message.recipient) {
            // Find and update the temporary message
            const updatedMessages = convo.messages.map(msg => {
              // Add null/undefined check for msg._id
              if (msg._id && (
                  msg._id === `temp-${message.timestamp instanceof Date ? message.timestamp.getTime() : Date.now()}` || 
                  (msg._id.startsWith && msg._id.startsWith('temp-') && msg.text === message.text))
              ) {
                return { ...msg, _id: message._id || msg._id, sending: false };
              }
              return msg;
            });
            
            return { ...convo, messages: updatedMessages };
          }
          return convo;
        });
      });
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

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [token, userProfile, activeConversation]);

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
    if (isActiveConversation && !isSentByMe && socket && message._id && !message._id.startsWith('temp-')) {
      socket.emit('markAsRead', { messageId: message._id });
      
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
        axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002'}/api/user/profile/${partnerId}`, {
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
  }, [userProfile, activeConversation, socket]);

  // Handle sending messages
  const handleSendMessage = useCallback(() => {
    if (!activeConversation || !currentMessage.trim() || !socket) {
      console.error('Cannot send message:', { 
        hasActiveConversation: !!activeConversation, 
        messageContent: currentMessage, 
        hasSocket: !!socket 
      });
      return;
    }
    
    const messageText = currentMessage.trim();
    
    // Create message object
    const messageData = {
      recipientId: activeConversation.friendId,
      text: messageText
    };
    
    // Create optimistic message for UI
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      sender: 'me',
      text: messageText,
      timestamp: new Date().toISOString(),
      pending: true
    };
    
    // Update UI immediately
    setActiveConversation(prev => ({
      ...prev,
      messages: [...prev.messages, optimisticMessage]
    }));
    
    // Update conversations list
    setConversations(prevConversations => {
      const convIndex = prevConversations.findIndex(c => 
        c.friendId === activeConversation.friendId
      );
      
      if (convIndex === -1) return prevConversations;
      
      const updatedConversations = [...prevConversations];
      const updatedConv = {
        ...updatedConversations[convIndex],
        messages: [...updatedConversations[convIndex].messages, optimisticMessage]
      };
      
      updatedConversations[convIndex] = updatedConv;
      
      // Move to top
      const [movedConv] = updatedConversations.splice(convIndex, 1);
      return [movedConv, ...updatedConversations];
    });
    
    // Clear input
    setCurrentMessage('');
    
    // Scroll to bottom
    setTimeout(scrollToBottom, 50);
    
    // Stop typing indicator
    socket.emit('stopTyping', { recipientId: activeConversation.friendId });
    
    // Actually send via socket.io
    socket.emit('sendMessage', messageData);
  }, [activeConversation, currentMessage, socket, scrollToBottom]);

  // Handle input change with typing indicator
  const handleInputChange = useCallback((e) => {
    setCurrentMessage(e.target.value);
    
    if (socket && activeConversation) {
      // Send typing indicator
      socket.emit('typing', { recipientId: activeConversation.friendId });
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopTyping', { recipientId: activeConversation.friendId });
      }, 2000);
    }
  }, [socket, activeConversation]);

  // Start chat with a friend
  const handleChat = useCallback((friend) => {
    // Check if conversation already exists
    const existingConversation = conversations.find(conv => conv.friendId === friend._id);
    
    if (existingConversation) {
      setActiveConversation(existingConversation);
      
      // Mark messages as read
      if (socket) {
        existingConversation.messages.forEach(msg => {
          if (msg.sender !== 'me' && !msg.read && msg._id && !msg._id.startsWith('temp-')) {
            socket.emit('markAsRead', { messageId: msg._id });
          }
        });
      }
      
      // Clear unread count
      setUnreadMessages(prev => ({ ...prev, [friend._id]: 0 }));
    } else {
      // Fetch conversation history
      axios.get(`http://localhost:5002/api/user/messages/${friend._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(response => {
        // Transform messages
        const messages = response.data?.messages?.map(msg => ({
          id: msg._id || Date.now().toString(),
          sender: msg.sender === userProfile?._id ? 'me' : msg.sender,
          text: msg.text,
          timestamp: msg.timestamp,
          read: msg.read || false
        })) || [];
        
        // Create new conversation
        const newConversation = {
          id: Date.now().toString(),
          friendId: friend._id,
          friendName: friend.profile?.fullName || friend.username,
          friendPhoto: friend.profile?.photoUrl || null,
          messages: messages
        };
        
        setConversations(prev => [newConversation, ...prev]);
        setActiveConversation(newConversation);
        
        // Mark messages as read
        if (socket) {
          messages.forEach(msg => {
            if (msg.sender !== 'me' && !msg.read && msg._id && !msg._id.startsWith('temp-')) {
              socket.emit('markAsRead', { messageId: msg._id });
            }
          });
        }
        
        // Clear unread count
        setUnreadMessages(prev => ({ ...prev, [friend._id]: 0 }));
      })
      .catch(error => {
        console.error('Error fetching messages:', error);
        
        // Create empty conversation
        const newConversation = {
          id: Date.now().toString(),
          friendId: friend._id,
          friendName: friend.profile?.fullName || friend.username,
          friendPhoto: friend.profile?.photoUrl || null,
          messages: []
        };
        
        setConversations(prev => [newConversation, ...prev]);
        setActiveConversation(newConversation);
      });
    }
    
    // Join room for this conversation
    if (socket) {
      const roomId = [userProfile._id, friend._id].sort().join('_');
      socket.emit('joinRoom', roomId);
    }
    
    // Switch to chats tab
    setActiveTab('chats');
  }, [conversations, userProfile?._id, socket, token]);

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
              photoUrl: matchesResponse.data.matches[0].profile?.photoUrl,
              location: matchesResponse.data.matches[0].preferences?.location,
              isLocationMatch: matchesResponse.data.matches[0].isLocationMatch
            });
          }
          
          // Log location match statistics
          const locationMatches = matchesResponse.data.matches.filter(match => match.isLocationMatch);
          console.log(`Total matches: ${matchesResponse.data.matches.length}, Location matches: ${locationMatches.length}`);
          
          if (matchesResponse.data.locationMatchCount !== undefined) {
            console.log(`Location match count from API: ${matchesResponse.data.locationMatchCount}`);
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

  // Add this function to handle API errors
  const handleApiError = (error, functionName) => {
    console.error(`Error in ${functionName}:`, error);
    
    // Check if error is related to verification requirement
    if (error.response && error.response.data && error.response.data.requireVerification) {
      alert(error.response.data.message || 'Email verification required for this action');
      
      // Redirect to verification page
      navigate('/verify-email');
      return true;
    }
    
    return false;
  };

  // Update the handleSendFriendRequest function
  const handleSendFriendRequest = useCallback(async (userId) => {
    try {
      setLoading(true);
      console.log("Sending friend request to:", userId);
      
      const response = await axios.post(
        `http://localhost:5002/api/user/friend-request`,
        { recipientId: userId }, // Use recipientId instead of userId
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      alert("Friend request sent successfully!");
      
      setSentRequests(prev => ({
        ...prev,
        [userId]: true
      }));
      
      setTimeout(() => setSentRequests(prev => ({ ...prev, [userId]: false })), 3000);
      return response.data;
    } catch (error) {
      if (handleApiError(error, 'handleSendFriendRequest')) {
        return;
      }
      
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
    } finally {
      setLoading(false);
    }
  }, [token, handleApiError]);

  // Update the handleFriendRequestResponse function
  const handleFriendRequestResponse = async (requestId, action) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5002/api/user/friend-request-response',
        { requestId, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // If accepting the request, start a chat and switch to chat tab
      if (action === 'accept') {
        // Refresh data first to get updated friends list
        await fetchData();
        
        // Find the friend from the request
        const request = userProfile.friendRequests.find(req => req._id === requestId);
        if (request) {
          const friendId = request.from;
          // Find the friend in the friends list
          const friend = friends.find(f => f._id.toString() === friendId.toString());
          if (friend) {
            // Start a chat with this friend
            handleChat(friend);
            // Switch to chats tab
            setActiveTab('chats');
          }
        }
      } else {
        // If rejecting, just refresh data
        fetchData();
      }
    } catch (error) {
      if (handleApiError(error, 'handleFriendRequestResponse')) {
        return;
      }
      
      console.error('Error responding to friend request:', error);
      alert('Failed to process friend request');
    }
  };

  const handleLogout = () => {
    // Close WebSocket connection if open
    if (socket) {
      console.log('Closing Socket.io connection before logout');
      socket.disconnect();
      setSocket(null);
    }
    
    // Clear all saved data
    localStorage.removeItem('token');
    setUserProfile(null);
    setConversations([]);
    setActiveConversation(null);
    
    navigate('/login');
  };

  // Update the handleViewProfile function
  const handleViewProfile = useCallback((user) => {
    setViewingProfile(user);
  }, []);

  // Add function to close profile modal
  const closeProfileModal = () => {
    setViewingProfile(null);
  };

  // Update the handleUnfriend function
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
      if (handleApiError(error, 'handleUnfriend')) {
        return;
      }
      
      console.error('Error removing friend:', error);
      alert('Failed to remove friend');
    }
  };

  // Render the Chats tab
  const renderChatsTab = () => {
  return (
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
                  onClick={() => {
                    setActiveConversation(conversation);
                    // Mark as read
                    if (socket && unreadMessages[conversation.friendId]) {
                      conversation.messages.forEach(msg => {
                        if (msg.sender !== 'me' && !msg.read && msg._id && !msg._id.startsWith('temp-')) {
                          socket.emit('markAsRead', { messageId: msg._id });
                        }
                      });
                      
                      // Clear unread count
                      setUnreadMessages(prev => ({ ...prev, [conversation.friendId]: 0 }));
                    }
                  }}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                    activeConversation && activeConversation.id === conversation.id
                    ? 'bg-blue-50 border-l-4 border-l-blue-500'
                    : ''
                  }`}
                >
                  <div className="flex items-center">
                    <div className="relative">
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
                      
                      {/* Online indicator */}
                      {onlineUsers.includes(conversation.friendId) && (
                        <div className="absolute bottom-0 right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <div className="font-semibold">{conversation.friendName}</div>
                        
                        {/* Unread message count */}
                        {unreadMessages[conversation.friendId] > 0 && (
                          <div className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                            {unreadMessages[conversation.friendId]}
                          </div>
                        )}
                      </div>
                      
                      {/* Last message preview */}
                      {conversation.messages.length > 0 && (
                        <div className="text-gray-500 text-sm truncate">
                          {conversation.messages[conversation.messages.length - 1].text}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Chat window */}
        {activeConversation ? (
          <div className="flex-1 bg-white rounded-lg shadow flex flex-col">
            {/* Chat header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center">
                <div className="relative">
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
                  
                  {/* Online indicator */}
                  {onlineUsers.includes(activeConversation.friendId) && (
                    <div className="absolute bottom-0 right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
    <div>
                  <div className="font-semibold">{activeConversation.friendName}</div>
                  <div className="text-xs text-gray-500">
                    {onlineUsers.includes(activeConversation.friendId) 
                      ? 'Online' 
                      : 'Offline'}
                  </div>
                </div>
              </div>
              
              {/* View profile button */}
              <button 
                onClick={() => {
                  const friend = friends.find(f => f._id === activeConversation.friendId);
                  if (friend) {
                    setSelectedFriend(friend);
                    setShowProfileModal(true);
                  }
                }}
                className="text-blue-500 hover:text-blue-700"
              >
                View Profile
              </button>
            </div>
            
            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50" ref={chatWindowRef}>
              {activeConversation.messages.map((message, index) => (
                <div 
                  key={message.id || index} 
                  className={`mb-4 flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`
                      max-w-[70%] rounded-lg px-4 py-2 
                      ${message.sender === 'me' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-800'}
                    `}
                  >
                    <p className="break-words">{message.text}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-400">
                        {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      
                      {/* Read receipt for sent messages */}
                      {message.sender === 'me' && (
                        <span className="text-xs ml-2">
                          {message.sending ? (
                            <span>Sending...</span>
                          ) : message.read ? (
                            <span>✓✓</span>
                          ) : (
                            <span>✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Typing indicator */}
              {typingUsers[activeConversation.friendId] && (
                <div className="flex items-center text-gray-500 text-sm">
                  <span className="mr-2">{activeConversation.friendName} is typing</span>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Input area */}
            <div className="p-3 border-t bg-white">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={currentMessage}
                  onChange={handleInputChange}
                  className="flex-1 p-2 border rounded-lg"
                  placeholder="Type a message..."
                />
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-lg shadow flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-2">
                <span role="img" aria-label="Chat">💬</span>
              </div>
              <div>Select a conversation or start a new chat with a friend</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50">
      {/* Navbar */}
      <nav className="bg-gradient-to-r from-blue-500 to-sky-500 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-white">RoommateMatch</h1>
              </div>
            </div>
            <div className="flex items-center">
              {userProfile && (
                <div className="flex items-center space-x-4">
                  <span className="text-white">{userProfile.username}</span>
                  <div className="relative">
                    {userProfile.profile && userProfile.profile.photoUrl ? (
                      <img
                        src={userProfile.profile.photoUrl.startsWith('http')
                          ? userProfile.profile.photoUrl
                          : `http://localhost:5002${userProfile.profile.photoUrl}`}
                        alt={userProfile.username}
                        className="h-8 w-8 rounded-full object-cover border-2 border-white"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white">
                        <span className="text-sm font-medium text-gray-600">
                          {userProfile.username?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading and Error States */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
            <p className="mt-4 text-blue-600 font-medium">Loading your dashboard...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md">
            <p>{error}</p>
          </div>
        )}

        {/* Dashboard Tabs */}
        {!loading && !error && (
          <>
            <div className="mb-6 bg-white rounded-xl shadow-md overflow-hidden">
              <div className="flex flex-wrap">
                {/* Tab navigation */}
                <div className="w-full md:w-64 bg-gradient-to-b from-blue-400 to-sky-500 p-4 md:p-6">
                  <div className="space-y-2">
                    <button
                      onClick={() => setActiveTab('profile')}
                      className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                        activeTab === 'profile'
                          ? 'bg-white text-blue-600 font-semibold shadow-md transform scale-105'
                          : 'text-white hover:bg-white hover:bg-opacity-20'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className="text-xl mr-3">👤</span>
                        Profile
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('preferences')}
                      className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                        activeTab === 'preferences'
                          ? 'bg-white text-blue-600 font-semibold shadow-md transform scale-105'
                          : 'text-white hover:bg-white hover:bg-opacity-20'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className="text-xl mr-3">⚙️</span>
                        Preferences
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('matches')}
                      className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                        activeTab === 'matches'
                          ? 'bg-white text-blue-600 font-semibold shadow-md transform scale-105'
                          : 'text-white hover:bg-white hover:bg-opacity-20'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className="text-xl mr-3">🔍</span>
                        Matches
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('messages')}
                      className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                        activeTab === 'messages'
                          ? 'bg-white text-blue-600 font-semibold shadow-md transform scale-105'
                          : 'text-white hover:bg-white hover:bg-opacity-20'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className="text-xl mr-3">💬</span>
                        Connections
                        {friendRequests.filter(request => request.status === 'pending').length > 0 && (
                          <span className="ml-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {friendRequests.filter(request => request.status === 'pending').length}
                          </span>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('chats')}
                      className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                        activeTab === 'chats'
                          ? 'bg-white text-blue-600 font-semibold shadow-md transform scale-105'
                          : 'text-white hover:bg-white hover:bg-opacity-20'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className="text-xl mr-3">📱</span>
                        Chats
                      </div>
                    </button>
                  </div>
                </div>

                {/* Tab content */}
                <div className="w-full md:w-[calc(100%-16rem)] p-6">
                  {/* Each tab content will be displayed here */}
                  {activeTab === 'profile' && (
                    <div className="space-y-6 bg-white p-8 rounded-lg shadow-sm">
                      <h2 className="text-3xl font-bold text-gray-800 mb-6">Your Profile</h2>
                      
                      {profileIncomplete && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200 mb-6">
                          <h3 className="text-xl font-semibold text-blue-700">Welcome to Roommate Finder!</h3>
                          <p className="text-blue-600 mt-2">
                            To get started, please complete your profile information. This helps potential 
                            roommates learn more about you and improves the quality of your matches.
                          </p>
                          <ul className="list-disc list-inside mt-3 text-blue-600">
                            <li>Fill in your personal information</li>
                            <li>Set your roommate preferences</li>
                            <li>Upload a profile photo</li>
                          </ul>
                        </div>
                      )}
                      
                      <div className="flex flex-col md:flex-row items-start gap-8">
                        <div className="w-full md:w-1/3">
                          <div className="bg-gradient-to-b from-indigo-100 to-purple-100 p-6 rounded-xl shadow-sm">
                            <div className="w-40 h-40 mx-auto rounded-full bg-white p-2 shadow-md overflow-hidden">
                              {userProfile && userProfile.profile && userProfile.profile.photoUrl ? (
                                <img
                                  src={userProfile.profile.photoUrl.startsWith('http')
                                    ? userProfile.profile.photoUrl
                                    : `http://localhost:5002${userProfile.profile.photoUrl}`}
                                  alt="Profile" 
                                  className="w-full h-full object-cover rounded-full"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center rounded-full bg-gray-200">
                                  <span className="text-5xl">👤</span>
                                </div>
                              )}
                            </div>
                            
                            <h3 className="text-xl font-bold text-center mt-4 text-gray-800">
                              {userProfile && userProfile.profile && userProfile.profile.fullName 
                                ? userProfile.profile.fullName 
                                : userProfile?.username || 'Welcome Back!'}
                            </h3>
                            
                            {userProfile?.profile?.occupation && (
                              <p className="text-center text-purple-600">{userProfile.profile.occupation}</p>
                            )}
                          </div>
                          
                          <div className="mt-6 bg-white p-6 rounded-xl shadow-sm">
                            <h3 className="text-lg font-semibold mb-3 text-gray-700">Verification Status</h3>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">Email</span>
                                {userProfile?.emailVerified ? (
                                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                    </svg>
                                    Verified
                                  </span>
                                ) : (
                                  <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                                    </svg>
                                    Not Verified
                                  </span>
                                )}
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">Phone</span>
                                {userProfile?.isPhoneVerified ? (
                                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                    </svg>
                                    Verified
                                  </span>
                                ) : (
                                  <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                                    </svg>
                                    Not Verified
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="w-full md:w-2/3 space-y-6">
                          <div className="bg-white p-6 rounded-xl shadow-sm">
                            <h3 className="text-xl font-semibold mb-6 text-gray-700">Profile Details</h3>
                            
                            {userProfile?.profile && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <p className="text-sm text-gray-500">Full Name</p>
                                  <p className="text-gray-800 font-medium">{userProfile.profile.fullName || 'Not provided'}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Username</p>
                                  <p className="text-gray-800 font-medium">{userProfile.username}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Email</p>
                                  <p className="text-gray-800 font-medium">{userProfile.email}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Phone</p>
                                  <p className="text-gray-800 font-medium">{userProfile.profile.phone || userProfile.phoneNumber || 'Not provided'}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Address</p>
                                  <p className="text-gray-800 font-medium">{userProfile.profile.address || 'Not provided'}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Occupation</p>
                                  <p className="text-gray-800 font-medium">{userProfile.profile.occupation || 'Not provided'}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-sm text-gray-500">Bio</p>
                                  <p className="text-gray-800">{userProfile.profile.bio || 'No bio provided'}</p>
                                </div>
                              </div>
                            )}
                            
                            <div className="mt-8 flex flex-wrap gap-4">
                              <button
                                onClick={() => navigate('/profile')}
                                className="px-6 py-3 bg-gradient-to-r from-blue-400 to-sky-500 text-white rounded-full hover:from-blue-500 hover:to-sky-600 shadow-md hover:shadow-lg transition-all"
                              >
                                {profileIncomplete ? 'Complete Your Profile' : 'Edit Profile'}
                              </button>
                              <Link
                                to="/verify-email"
                                className="px-6 py-3 bg-gradient-to-r from-teal-400 to-cyan-500 text-white rounded-full hover:from-teal-500 hover:to-cyan-600 shadow-md hover:shadow-lg transition-all"
                              >
                                Verify Email
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'preferences' && (
                    <div className="bg-white p-8 rounded-lg shadow-sm">
                      {/* Preferences content from PreferenceForm component */}
                      {userProfile && userProfile.preferences && 
                        Object.values(userProfile.preferences).some(val => val !== null) ? (
                        <div>
                          <div className="mb-6">
                            <h2 className="text-3xl font-bold text-gray-800 mb-2">Your Preferences</h2>
                            <p className="text-gray-600">These preferences help us find compatible roommates for you.</p>
                          </div>
                          
                          <div className="flex justify-end mb-6">
                            <button 
                              onClick={() => setEditingPreferences(true)}
                              className="px-6 py-3 bg-gradient-to-r from-blue-400 to-sky-500 text-white rounded-full hover:from-blue-500 hover:to-sky-600 shadow-md hover:shadow-lg transition-all"
                            >
                              Update Preferences
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {userProfile.preferences.location && (
                              <div className="col-span-full bg-white p-4 rounded-xl border border-gray-200 shadow-md mb-4">
                                <div className="flex items-center">
                                  <span className="text-3xl mr-3">📍</span>
                                  <div>
                                    <p className="font-semibold text-gray-600">Preferred Location</p>
                                    <p className="text-blue-600 text-xl font-bold">{userProfile.preferences.location}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {userProfile.preferences.gender && (
                              <div className="col-span-full bg-white p-4 rounded-xl border border-gray-200 shadow-md mb-4">
                                <div className="flex items-center">
                                  <span className="text-3xl mr-3">{userProfile.preferences.gender === 'Male' ? '👨' : userProfile.preferences.gender === 'Female' ? '👩' : '👥'}</span>
                                  <div>
                                    <p className="font-semibold text-gray-600">Looking For</p>
                                    <p className="text-blue-600 text-xl font-bold">{userProfile.preferences.gender} Roommate</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {userProfile.preferences.rent && (
                              <div className="col-span-full bg-white p-4 rounded-xl border border-gray-200 shadow-md mb-4">
                                <div className="flex items-center">
                                  <span className="text-3xl mr-3">₹</span>
                                  <div>
                                    <p className="font-semibold text-gray-600">Budget</p>
                                    <p className="text-blue-600 text-xl font-bold">₹ {userProfile.preferences.rent}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {userProfile.preferences.cleanliness && (
                              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-md">
                                <p className="font-medium text-gray-600">Cleanliness</p>
                                <div className="flex items-center mt-2">
                                  <span className="text-2xl mr-2">✨</span>
                                  <p className="text-gray-800 font-medium">{userProfile.preferences.cleanliness}</p>
                                </div>
                              </div>
                            )}
                            
                            {userProfile.preferences.smoking && (
                              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-md">
                                <p className="font-medium text-gray-600">Smoking</p>
                                <div className="flex items-center mt-2">
                                  <span className="text-2xl mr-2">🚭</span>
                                  <p className="text-gray-800 font-medium">{userProfile.preferences.smoking}</p>
                                </div>
                              </div>
                            )}
                            
                            {userProfile.preferences.pets && (
                              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-md">
                                <p className="font-medium text-gray-600">Pets</p>
                                <div className="flex items-center mt-2">
                                  <span className="text-2xl mr-2">🐾</span>
                                  <p className="text-gray-800 font-medium">{userProfile.preferences.pets}</p>
                                </div>
                              </div>
                            )}
                            
                            {userProfile.preferences.workSchedule && (
                              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-md">
                                <p className="font-medium text-gray-600">Work Schedule</p>
                                <div className="flex items-center mt-2">
                                  <span className="text-2xl mr-2">
                                    {userProfile.preferences.workSchedule === 'Night Owl' ? '🦉' : 
                                     userProfile.preferences.workSchedule === 'Regular Hours' ? '☀️' : '⏱️'}
                                  </span>
                                  <p className="text-gray-800 font-medium">{userProfile.preferences.workSchedule}</p>
                                </div>
                              </div>
                            )}
                            
                            {userProfile.preferences.socialLevel && (
                              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-md">
                                <p className="font-medium text-gray-600">Social Level</p>
                                <div className="flex items-center mt-2">
                                  <span className="text-2xl mr-2">
                                    {userProfile.preferences.socialLevel === 'Very Social' ? '🎉' : 
                                     userProfile.preferences.socialLevel === 'Not Social' ? '🧘' : '👥'}
                                  </span>
                                  <p className="text-gray-800 font-medium">{userProfile.preferences.socialLevel}</p>
                                </div>
                              </div>
                            )}
                            
                            {userProfile.preferences.guestPreference && (
                              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-md">
                                <p className="font-medium text-gray-600">Guest Policy</p>
                                <div className="flex items-center mt-2">
                                  <span className="text-2xl mr-2">
                                    {userProfile.preferences.guestPreference === 'Frequent Guests' ? '👋👋' : 
                                     userProfile.preferences.guestPreference === 'No Guests' ? '🔒' : '👋'}
                                  </span>
                                  <p className="text-gray-800 font-medium">{userProfile.preferences.guestPreference}</p>
                                </div>
                              </div>
                            )}
                            
                            {userProfile.preferences.music && (
                              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-md">
                                <p className="font-medium text-gray-600">Music/Noise</p>
                                <div className="flex items-center mt-2">
                                  <span className="text-2xl mr-2">
                                    {userProfile.preferences.music === 'Shared Music OK' ? '🎵' : 
                                     userProfile.preferences.music === 'Quiet Environment' ? '🤫' : '🎧'}
                                  </span>
                                  <p className="text-gray-800 font-medium">{userProfile.preferences.music}</p>
                                </div>
                              </div>
                            )}
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
                          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-2xl font-bold text-gray-800">Update Your Preferences</h3>
                              <button
                                onClick={() => setEditingPreferences(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
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
                      <h2 className="text-3xl font-bold text-gray-800 mb-6">Potential Roommates</h2>
                      
                      {profileIncomplete ? (
                        <div className="bg-gradient-to-r from-blue-50 to-sky-50 p-6 rounded-xl border border-blue-200">
                          <h3 className="text-xl font-semibold text-blue-700">Profile Incomplete</h3>
                          <p className="text-blue-600 mt-2">
                            Please complete your profile and preferences to see potential roommate matches.
                          </p>
                          <button
                            onClick={() => setActiveTab('profile')}
                            className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-400 to-sky-500 text-white rounded-full hover:from-blue-500 hover:to-sky-600 shadow-md hover:shadow-lg transition-all"
                          >
                            Complete Profile
                          </button>
                        </div>
                      ) : matches && matches.length > 0 ? (
                        <div className="space-y-8">
                          {/* Location Matches */}
                          {matches.some(match => match.isLocationMatch) && (
                            <div>
                              <h3 className="text-xl font-semibold text-blue-700 mb-4 flex items-center">
                                <span className="mr-2">📍</span> 
                                Matches in {userProfile?.preferences?.location || 'Your Area'}
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {matches
                                  .filter(match => match.isLocationMatch)
                                  .map((match) => (
                                    <div key={match._id || match.userId} className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                                      <div className="flex">
                                        {/* Left side - profile photo */}
                                        <div className="w-1/3 bg-gray-100 flex items-center justify-center p-4">
                                          {match.profile && match.profile.photoUrl ? (
                                            <img
                                              src={match.profile.photoUrl.startsWith('http') 
                                                ? match.profile.photoUrl 
                                                : `http://localhost:5002${match.profile.photoUrl}`}
                                              alt={match.profile?.fullName || 'User'}
                                              className="w-full h-48 object-cover"
                                            />
                                          ) : (
                                            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                                              <span className="text-5xl">👤</span>
                                            </div>
                                          )}
                                        </div>
                                        
                                        {/* Right side - profile details */}
                                        <div className="w-2/3 p-5">
                                          <h3 className="text-2xl font-semibold mb-2">{match.profile?.fullName || match.username}</h3>
                                          
                                          <div className="flex items-center text-gray-500 mb-4">
                                            <span className="mr-2">📍</span>
                                            <span>{match.profile?.address || match.preferences?.location || 'Location not specified'}</span>
                                          </div>
                                          
                                          <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div>
                                              <p className="text-gray-500">Rent</p>
                                              <p className="text-xl font-semibold">₹ {match.preferences?.rent || '8000'}</p>
                                            </div>
                                            <div>
                                              <p className="text-gray-500">Looking for</p>
                                              <p className="text-xl font-semibold">{match.preferences?.gender || 'Any'} Roommate</p>
                                            </div>
                                            <div>
                                              <p className="text-gray-500">Distance</p>
                                              <p className="text-xl font-semibold">
                                                {match.distance ? `${match.distance} km` : 'Same area'}
                                              </p>
                                            </div>
                                          </div>
                                          
                                          <div className="border-t pt-3 flex items-center justify-between">
                                            <div className="flex items-center">
                                              <span className="text-blue-600 font-semibold">Match Score:</span>
                                            </div>
                                            <div className="flex items-center bg-blue-100 px-3 py-1 rounded-full">
                                              <span className="text-blue-700 font-bold">{match.matchPercentage}%</span>
                                            </div>
                                          </div>
                                          
                                          <div className="flex justify-between mt-4 gap-2">
                                            <button
                                              onClick={() => handleViewProfile(match)}
                                              className="flex-1 bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center"
                                            >
                                              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                                              </svg>
                                              View
                                            </button>
                                            <button
                                              onClick={() => {
                                                const id = match._id || match.userId;
                                                handleSendFriendRequest(id);
                                              }}
                                              className="flex-1 bg-sky-500 text-white py-2 rounded-md hover:bg-sky-600 transition-colors flex items-center justify-center"
                                            >
                                              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
                                              </svg>
                                              Connect
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Other Matches */}
                          {matches.some(match => !match.isLocationMatch) && (
                            <div className="mt-12">
                              <h3 className="text-xl font-semibold text-gray-700 mb-4">Other Potential Matches</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {matches
                                  .filter(match => !match.isLocationMatch)
                                  .map((match) => (
                                    <div key={match._id || match.userId} className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                                      <div className="flex">
                                        {/* Left side - profile photo */}
                                        <div className="w-1/3 bg-gray-100 flex items-center justify-center p-4">
                                          {match.profile && match.profile.photoUrl ? (
                                            <img
                                              src={match.profile.photoUrl.startsWith('http') 
                                                ? match.profile.photoUrl 
                                                : `http://localhost:5002${match.profile.photoUrl}`}
                                              alt={match.profile?.fullName || 'User'}
                                              className="w-full h-48 object-cover"
                                            />
                                          ) : (
                                            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                                              <span className="text-5xl">👤</span>
                                            </div>
                                          )}
                                        </div>
                                        
                                        {/* Right side - profile details */}
                                        <div className="w-2/3 p-5">
                                          <h3 className="text-2xl font-semibold mb-2">{match.profile?.fullName || match.username}</h3>
                                          
                                          <div className="flex items-center text-gray-500 mb-4">
                                            <span className="mr-2">📍</span>
                                            <span>{match.profile?.address || match.preferences?.location || 'Location not specified'}</span>
                                          </div>
                                          
                                          <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div>
                                              <p className="text-gray-500">Rent</p>
                                              <p className="text-xl font-semibold">₹ {match.preferences?.rent || '10000'}</p>
                                            </div>
                                            <div>
                                              <p className="text-gray-500">Looking for</p>
                                              <p className="text-xl font-semibold">{match.preferences?.gender || 'Any'} Roommate</p>
                                            </div>
                                            <div>
                                              <p className="text-gray-500">Distance</p>
                                              <p className="text-xl font-semibold">
                                                {match.distance ? `${match.distance} km` : 'Same area'}
                                              </p>
                                            </div>
                                          </div>
                                          
                                          <div className="border-t pt-3 flex items-center justify-between">
                                            <div className="flex items-center">
                                              <span className="text-blue-600 font-semibold">Match Score:</span>
                                            </div>
                                            <div className="flex items-center bg-blue-100 px-3 py-1 rounded-full">
                                              <span className="text-blue-700 font-bold">{match.matchPercentage}%</span>
                                            </div>
                                          </div>
                                          
                                          <div className="flex justify-between mt-4 gap-2">
                                            <button
                                              onClick={() => handleViewProfile(match)}
                                              className="flex-1 bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center"
                                            >
                                              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                                              </svg>
                                              View
                                            </button>
                                            <button
                                              onClick={() => {
                                                const id = match._id || match.userId;
                                                handleSendFriendRequest(id);
                                              }}
                                              className="flex-1 bg-sky-500 text-white py-2 rounded-md hover:bg-sky-600 transition-colors flex items-center justify-center"
                                            >
                                              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
                                              </svg>
                                              Connect
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl p-8 shadow-sm">
                          <div className="text-6xl mb-4">🔍</div>
                          <h3 className="text-xl font-semibold text-gray-800 mb-2">No matches found yet</h3>
                          <p className="text-gray-600 text-center max-w-md">
                            We're looking for compatible roommates based on your preferences! Make sure your preferences are set and check back later.
                          </p>
                          
                          {userProfile && (!userProfile.preferences || Object.values(userProfile.preferences).every(val => val === null)) && (
                            <button
                              onClick={() => setActiveTab('preferences')}
                              className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-400 to-sky-500 text-white rounded-full hover:from-blue-500 hover:to-sky-600 shadow-md hover:shadow-lg transition-all"
                            >
                              Set Your Preferences
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'messages' && (
                    <div className="space-y-6 bg-white p-8 rounded-lg shadow-sm">
                      <h2 className="text-3xl font-bold text-gray-800 mb-6">Connection Requests</h2>
                      
                      {/* Pending friend requests section */}
                      {friendRequests.filter(request => request.status === 'pending').length > 0 ? (
                        <div className="space-y-4">
                          <h3 className="text-xl font-semibold text-gray-700 mb-4">Pending Requests</h3>
                          <div className="divide-y">
                            {friendRequests
                              .filter(request => request.status === 'pending')
                              .map(request => (
                                <div key={request._id} className="py-4 flex items-center justify-between">
                                  <div className="flex items-center">
                                    <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden mr-4">
                                      {request.fromUser?.photoUrl ? (
                                        <img 
                                          src={request.fromUser.photoUrl.startsWith('http') 
                                            ? request.fromUser.photoUrl 
                                            : `http://localhost:5002${request.fromUser.photoUrl}`}
                                          alt={request.fromUser?.fullName || 'User'}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <span className="text-xl">👤</span>
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-semibold">{request.fromUser?.fullName || request.fromUser?.username || 'User'}</p>
                                      <p className="text-sm text-gray-500">
                                        {request.fromUser?.occupation && <span>{request.fromUser.occupation} • </span>}
                                        {request.fromUser?.address || 'No location provided'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex space-x-3">
                                    <button
                                      onClick={() => handleFriendRequestResponse(request._id, 'accept')}
                                      className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() => handleFriendRequestResponse(request._id, 'reject')}
                                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-6 rounded-xl text-center">
                          <div className="text-5xl mb-4">💌</div>
                          <h3 className="text-xl font-semibold text-gray-800 mb-2">No pending connection requests</h3>
                          <p className="text-gray-600">
                            When someone wants to connect with you, their request will appear here.
                          </p>
                        </div>
                      )}

                      {/* Accepted connections section */}
                      {friends.length > 0 && (
                        <div className="mt-8 space-y-4">
                          <h3 className="text-xl font-semibold text-gray-700 mb-4">Your Connections</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {friends.map(friend => (
                              <div key={friend._id} className="border rounded-lg shadow-sm overflow-hidden">
                                <div className="flex items-center p-4">
                                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden mr-4">
                                    {friend.profile?.photoUrl ? (
                                      <img 
                                        src={friend.profile.photoUrl.startsWith('http') 
                                          ? friend.profile.photoUrl 
                                          : `http://localhost:5002${friend.profile.photoUrl}`}
                                        alt={friend.profile?.fullName || friend.username}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-xl">👤</span>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-semibold">{friend.profile?.fullName || friend.username}</p>
                                    <p className="text-sm text-gray-500">
                                      {friend.profile?.occupation && <span>{friend.profile.occupation} • </span>}
                                      {friend.profile?.address || 'No location provided'}
                                    </p>
                                  </div>
                                </div>
                                <div className="bg-gray-50 p-3 flex justify-between items-center">
                                  <button
                                    onClick={() => handleChat(friend)}
                                    className="w-full px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center"
                                  >
                                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    Chat
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'chats' && (
                    <div className="space-y-6">
                      {renderChatsTab()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Profile Modal */}
      {showProfileModal && selectedFriend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Profile modal content would go here */}
          </div>
        </div>
      )}

      {/* Profile View Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">User Profile</h3>
              <button
                onClick={closeProfileModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-8">
              {/* Profile Photo */}
              <div className="w-full md:w-1/3">
                <div className="bg-gradient-to-b from-blue-100 to-indigo-100 p-6 rounded-xl shadow-sm">
                  <div className="w-40 h-40 mx-auto rounded-full bg-white p-2 shadow-md overflow-hidden">
                    {viewingProfile.profile && viewingProfile.profile.photoUrl ? (
                      <img
                        src={viewingProfile.profile.photoUrl.startsWith('http')
                          ? viewingProfile.profile.photoUrl
                          : `http://localhost:5002${viewingProfile.profile.photoUrl}`}
                        alt="Profile" 
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center rounded-full bg-gray-200">
                        <span className="text-5xl">👤</span>
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-center mt-4 text-gray-800">
                    {viewingProfile.profile?.fullName || viewingProfile.username}
                  </h3>
                  
                  {viewingProfile.profile?.occupation && (
                    <p className="text-center text-blue-600">{viewingProfile.profile.occupation}</p>
                  )}

                  <div className="mt-6 text-center">
                    <button
                      onClick={() => {
                        console.log("Sending friend request from modal to:", viewingProfile._id);
                        handleSendFriendRequest(viewingProfile._id);
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-sky-600 text-white rounded-full font-medium shadow-md hover:from-blue-600 hover:to-sky-700 transition-all"
                    >
                      Connect as Roommate
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Profile Details */}
              <div className="w-full md:w-2/3 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm">
                  <h3 className="text-xl font-semibold mb-6 text-gray-700">Profile Details</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="text-gray-800 font-medium">{viewingProfile.profile?.address || viewingProfile.preferences?.location || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Looking For</p>
                      <p className="text-gray-800 font-medium">{viewingProfile.preferences?.gender || 'Any'} Roommate</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Budget</p>
                      <p className="text-gray-800 font-medium">
                        {viewingProfile.preferences?.rent ? `₹ ${viewingProfile.preferences.rent}` : 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Occupation</p>
                      <p className="text-gray-800 font-medium">{viewingProfile.profile?.occupation || 'Not provided'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Bio</p>
                      <p className="text-gray-800">{viewingProfile.profile?.bio || 'No bio provided'}</p>
                    </div>
                  </div>
                </div>
                
                {viewingProfile.preferences && Object.keys(viewingProfile.preferences).length > 0 && (
                  <div className="bg-white p-6 rounded-xl shadow-sm">
                    <h3 className="text-xl font-semibold mb-6 text-gray-700">Roommate Preferences</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {viewingProfile.preferences.gender && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <p className="font-medium text-gray-600">Looking For</p>
                          <div className="flex items-center mt-2">
                            <span className="text-2xl mr-2">
                              {viewingProfile.preferences.gender === 'Male' ? '👨' : 
                               viewingProfile.preferences.gender === 'Female' ? '👩' : '👥'}
                            </span>
                            <p className="text-gray-800 font-medium">{viewingProfile.preferences.gender} Roommate</p>
                          </div>
                        </div>
                      )}
                      
                      {viewingProfile.preferences.rent && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <p className="font-medium text-gray-600">Rent Budget</p>
                          <div className="flex items-center mt-2">
                            <span className="text-2xl mr-2">₹</span>
                            <p className="text-gray-800 font-medium">{viewingProfile.preferences.rent}</p>
                          </div>
                        </div>
                      )}
                      
                      {viewingProfile.preferences.cleanliness && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <p className="font-medium text-gray-600">Cleanliness</p>
                          <div className="flex items-center mt-2">
                            <span className="text-2xl mr-2">✨</span>
                            <p className="text-gray-800 font-medium">{viewingProfile.preferences.cleanliness}</p>
                          </div>
                        </div>
                      )}
                      
                      {viewingProfile.preferences.smoking && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <p className="font-medium text-gray-600">Smoking</p>
                          <div className="flex items-center mt-2">
                            <span className="text-2xl mr-2">🚭</span>
                            <p className="text-gray-800 font-medium">{viewingProfile.preferences.smoking}</p>
                          </div>
                        </div>
                      )}
                      
                      {viewingProfile.preferences.pets && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <p className="font-medium text-gray-600">Pets</p>
                          <div className="flex items-center mt-2">
                            <span className="text-2xl mr-2">🐾</span>
                            <p className="text-gray-800 font-medium">{viewingProfile.preferences.pets}</p>
                          </div>
                        </div>
                      )}
                      
                      {viewingProfile.preferences.workSchedule && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <p className="font-medium text-gray-600">Work Schedule</p>
                          <div className="flex items-center mt-2">
                            <span className="text-2xl mr-2">⏱️</span>
                            <p className="text-gray-800 font-medium">{viewingProfile.preferences.workSchedule}</p>
                          </div>
                        </div>
                      )}
                      
                      {viewingProfile.preferences.socialLevel && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <p className="font-medium text-gray-600">Social Level</p>
                          <div className="flex items-center mt-2">
                            <span className="text-2xl mr-2">👥</span>
                            <p className="text-gray-800 font-medium">{viewingProfile.preferences.socialLevel}</p>
                          </div>
                        </div>
                      )}
                      
                      {viewingProfile.preferences.guestPreference && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <p className="font-medium text-gray-600">Guest Policy</p>
                          <div className="flex items-center mt-2">
                            <span className="text-2xl mr-2">👋</span>
                            <p className="text-gray-800 font-medium">{viewingProfile.preferences.guestPreference}</p>
                          </div>
                        </div>
                      )}
                      
                      {viewingProfile.preferences.music && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <p className="font-medium text-gray-600">Music/Noise</p>
                          <div className="flex items-center mt-2">
                            <span className="text-2xl mr-2">🎵</span>
                            <p className="text-gray-800 font-medium">{viewingProfile.preferences.music}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
