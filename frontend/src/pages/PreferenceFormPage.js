import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import PreferenceForm from '../components/PreferenceForm';

const PreferenceFormPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  const handleSubmitPreferences = async (preferences) => {
    try {
      setLoading(true);
      console.log('Submitting preferences to backend:', JSON.stringify(preferences));
      
      // Ensure gender and rent are properly set if they exist
      if (preferences.gender === '') {
        console.warn('Gender preference is empty, setting to "Any"');
        preferences.gender = 'Any';
      }
      
      if (preferences.rent === '') {
        console.warn('Rent preference is empty, setting to "10000"');
        preferences.rent = '10000';
      }
      
      const response = await axios.post('http://localhost:5002/api/user/preferences', 
        { preferences },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Preferences update response:', response.data);
      
      if (response.data) {
        alert('Preferences updated successfully!');
        navigate('/dashboard', { state: { redirectToPreferences: true } });
      } else {
        setError('Failed to update preferences. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      if (error.response) {
        console.error('Server response:', error.response.data);
        setError(error.response.data.message || 'Failed to update preferences. Please try again.');
      } else {
        setError('Failed to connect to server. Please try again.');
      }
      setLoading(false);
    }
  };

  if (!token) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50 py-12">
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500 mx-auto"></div>
            <p className="text-center mt-4">Updating preferences...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
            <p>{error}</p>
          </div>
        </div>
      )}
      
      <PreferenceForm onSubmit={handleSubmitPreferences} />
    </div>
  );
};

export default PreferenceFormPage; 