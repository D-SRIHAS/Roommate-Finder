import React, { useState } from 'react';

const PreferenceForm = ({ onSubmit }) => {
  const [preferences, setPreferences] = useState({
    cleanliness: '',
    smoking: '',
    pets: '',
    workSchedule: '',
    socialLevel: '',
    guestPreference: '',
    music: ''
  });

  const preferenceOptions = {
    cleanliness: ['Very Clean', 'Moderately Clean', 'Somewhat Messy', 'Messy'],
    smoking: ['No Smoking', 'Outside Only', 'Smoking Friendly'],
    pets: ['No Pets', 'Pet Friendly', 'Has Pets'],
    workSchedule: ['Regular Hours', 'Flexible Hours', 'Night Owl'],
    socialLevel: ['Very Social', 'Moderately Social', 'Occasionally Social', 'Not Social'],
    guestPreference: ['Frequent Guests', 'Occasional Guests', 'Rare Guests', 'No Guests'],
    music: ['Shared Music OK', 'With Headphones', 'Quiet Environment']
  };

  const handleChange = (category, value) => {
    setPreferences(prev => ({
      ...prev,
      [category]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(preferences);
  };

  const preferenceLabels = {
    cleanliness: 'Cleanliness Level',
    smoking: 'Smoking Preferences',
    pets: 'Pet Preferences',
    workSchedule: 'Work Schedule',
    socialLevel: 'Social Preferences',
    guestPreference: 'Guest Policy',
    music: 'Music/Noise Preferences'
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Set Your Preferences</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {Object.keys(preferences).map((category) => (
          <div key={category} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {preferenceLabels[category]}
            </label>
            <select
              value={preferences[category]}
              onChange={(e) => handleChange(category, e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select {preferenceLabels[category]}</option>
              {preferenceOptions[category].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
        >
          Save Preferences
        </button>
      </form>
    </div>
  );
};

export default PreferenceForm; 