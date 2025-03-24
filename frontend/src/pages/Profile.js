import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('http://localhost:5002/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        navigate('/login');
        return;
      }

      const data = await response.json();
      
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
          phone: data.profile.phone || '',
          occupation: data.profile.occupation || ''
        });
        
        if (data.profile.photoUrl) {
          setPhotoPreview(`http://localhost:5002${data.profile.photoUrl}`);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setLoading(false);
    }
  };

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
      
      // Add profile data as JSON
      formDataToSend.append('profile', JSON.stringify(formData));
      
      // Add photo if it exists
      if (photo) {
        formDataToSend.append('photo', photo);
      }
      
      const response = await fetch('http://localhost:5002/api/user/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Profile updated successfully!');
        // If this is the first profile setup, redirect to the preferences tab
        if (isNewUser) {
          navigate('/dashboard', { state: { redirectToPreferences: true } });
        } else {
          navigate('/dashboard');
        }
      } else {
        throw new Error(data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      
      // More descriptive error message
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert('Network error: Make sure your backend server is running on port 5002');
      } else {
        alert(error.message || 'An error occurred while updating profile');
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
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="fullName">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="phone">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="occupation">
                Occupation
              </label>
              <input
                type="text"
                id="occupation"
                name="occupation"
                value={formData.occupation}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="address">
                Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2" htmlFor="bio">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows="4"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tell others about yourself..."
            ></textarea>
          </div>
          
          <div className="flex justify-between">
            <p className="text-sm text-gray-600">
              <span className="text-red-500">*</span> Required fields
            </p>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {isNewUser ? 'Save & Continue' : 'Save Profile'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile; 