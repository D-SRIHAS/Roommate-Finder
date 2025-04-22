import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Profile = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    bio: '',
    address: '',
    phone: '',
    occupation: ''
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [error, setError] = useState(null);
  
  // Get verification status from localStorage
  const emailVerified = localStorage.getItem('emailVerified') === 'true';
  const phoneVerified = localStorage.getItem('phoneVerified') === 'true';
  const userData = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchUserProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axios.get('http://localhost:5002/api/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        navigate('/login');
        return;
      }

      const data = response.data;
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch profile');
      }

      // Check if profile is new/empty
      const profileEmpty = !data.profile.fullName && !data.profile.bio && !data.profile.address;
      setIsNewUser(profileEmpty);

      // If profile data exists, populate the form
      if (data.profile) {
        setFormData({
          fullName: data.profile.fullName || '',
          bio: data.profile.bio || '',
          address: data.profile.address || '',
          phone: data.profile.phone || userData.phoneNumber || '',
          occupation: data.profile.occupation || ''
        });
        
        if (data.profile.photoUrl) {
          setPhotoPreview(`http://localhost:5002${data.profile.photoUrl}`);
        }
      } else {
        // For new users, pre-fill with user data from localStorage
        setFormData(prev => ({
          ...prev,
          phone: userData.phoneNumber || ''
        }));
      }
      
      setUserProfile(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile');
      setLoading(false);
    }
  }, [navigate, userData.phoneNumber]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.address) {
      alert('Please fill in at least your full name and address');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found, redirecting to login');
        navigate('/login');
        return;
      }
      
      // Create form data for file upload
      const formDataToSend = new FormData();
      
      // Format profile data in a compatible format for both API endpoints
      const profileData = {
        fullName: formData.fullName,
        bio: formData.bio || '',
        address: formData.address,
        phone: phoneVerified ? userData.phoneNumber : formData.phone,
        occupation: formData.occupation || ''
      };
      
      console.log('Submitting profile data:', profileData);
      
      // Add profile data as JSON string
      formDataToSend.append('profile', JSON.stringify(profileData));
      
      // Add photo if it exists
      if (photo) {
        formDataToSend.append('photo', photo);
      }
      
      // Attempt to update profile using the user route first
      let response;
      try {
        console.log('Attempting to update profile using /api/user/profile endpoint');
        response = await axios.put('http://localhost:5002/api/user/profile', formDataToSend, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        console.log('Profile updated successfully using /api/user/profile endpoint');
      } catch (userProfileErr) {
        console.error('Error with /api/user/profile endpoint:', userProfileErr);
        
        // If the first attempt fails, try the profile route
        try {
          console.log('Falling back to /api/profile endpoint');
          // For the /api/profile endpoint, it expects a different structure
          const profileFormData = new FormData();
          profileFormData.append('profile', JSON.stringify(profileData));
          
          if (photo) {
            // For this endpoint, upload photo separately
            const photoFormData = new FormData();
            photoFormData.append('photo', photo);
            
            try {
              await axios.post('http://localhost:5002/api/profile/photo', photoFormData, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'multipart/form-data'
                }
              });
              console.log('Photo uploaded successfully using /api/profile/photo endpoint');
            } catch (photoErr) {
              console.error('Error uploading photo:', photoErr);
            }
          }
          
          response = await axios.put('http://localhost:5002/api/profile', {
            profile: profileData
          }, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('Profile updated successfully using /api/profile endpoint');
        } catch (profileErr) {
          console.error('Error with /api/profile endpoint:', profileErr);
          throw profileErr; // Re-throw the error from the second attempt
        }
      }
      
      console.log('Profile update response:', response);
      
      // Check HTTP status directly from the response
      if (response.status >= 200 && response.status < 300) {
        alert('Profile updated successfully!');
        // If this is the first profile setup, redirect to the preferences tab
        if (isNewUser) {
          navigate('/dashboard', { state: { redirectToPreferences: true } });
        } else {
          navigate('/dashboard');
        }
      } else {
        throw new Error(response.data?.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      
      // More descriptive error message
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Response data:', error.response.data);
        alert(`Error ${error.response.status}: ${error.response.data?.message || error.response.statusText}`);
      } else if (error.request) {
        // The request was made but no response was received
        alert('Network error: No response received from server');
      } else {
        // Something happened in setting up the request that triggered an Error
        alert('Error: ' + error.message);
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-10">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-center mb-8">
          {isNewUser ? 'Complete Your Profile' : 'Edit Your Profile'}
        </h1>
        
        {isNewUser && (
          <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-6">
            <h2 className="font-semibold text-blue-800 text-lg">Welcome to Roommate Finder!</h2>
            <p className="text-blue-700 mt-1">
              Let's set up your profile so potential roommates can learn more about you.
              Please fill out the form below with your information.
            </p>
            <p className="text-blue-700 mt-2">
              <strong>Required fields:</strong> Full Name and Address
            </p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-36 h-36 rounded-full bg-gray-200 mb-3 overflow-hidden">
              {photoPreview ? (
                <img 
                  src={photoPreview} 
                  alt="Profile Preview" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  No Photo
                </div>
              )}
            </div>
            <label className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md cursor-pointer">
              Upload Photo
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Full Name *</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Your full name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Phone Number
                {phoneVerified && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    ✓ Verified
                  </span>
                )}
              </label>
              <input
                type="tel"
                name="phone"
                value={userData.phoneNumber || formData.phone}
                onChange={phoneVerified ? undefined : handleChange}
                className={`w-full p-2 border border-gray-300 rounded-md ${
                  phoneVerified 
                    ? 'bg-gray-100 cursor-not-allowed' 
                    : 'focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Your phone number"
                disabled={phoneVerified}
              />
              {phoneVerified && (
                <p className="text-xs text-gray-500">
                  Your phone number has been verified and cannot be changed.
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Email
                {emailVerified && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    ✓ Verified
                  </span>
                )}
              </label>
              <input
                type="email"
                name="email"
                value={userData.email || ''}
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                disabled={true}
              />
              <p className="text-xs text-gray-500">
                Email cannot be changed.
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Occupation</label>
              <input
                type="text"
                name="occupation"
                value={formData.occupation}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Your occupation"
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Address *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Your address"
                required
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows="4"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Tell potential roommates about yourself..."
              ></textarea>
            </div>
          </div>
          
          <div className="flex justify-center pt-4">
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isNewUser ? 'Save & Continue' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile; 