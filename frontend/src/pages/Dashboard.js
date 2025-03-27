import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
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
  const [sentRequests, setSentRequests] = useState({});
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
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
    if (activeConversation?.messages?.length) {
      scrollToBottom();
    }
  }, [activeConversation?.messages, scrollToBottom]);

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      navigate('/login');
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
              <div className="text-4xl mb-2">💬</div>
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

          {activeTab === 'chats' && renderChatsTab()}
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
