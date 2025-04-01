import React, { useState, useEffect } from 'react';

const PreferenceForm = ({ onSubmit, initialValues }) => {
  const [preferences, setPreferences] = useState({
    location: '',
    gender: '',
    rent: '',
    cleanliness: '',
    smoking: '',
    pets: '',
    workSchedule: '',
    socialLevel: '',
    guestPreference: '',
    music: ''
  });

  // Initialize with existing preferences if provided
  useEffect(() => {
    if (initialValues) {
      setPreferences(prev => ({
        ...prev,
        ...initialValues
      }));
      console.log("Initialized preferences from props:", initialValues);
    }
  }, [initialValues]);

  const preferenceOptions = {
    location: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Other'],
    gender: ['Male', 'Female', 'Any'],
    rent: ['5000', '8000', '10000', '12000', '15000', '20000', 'Other'],
    cleanliness: ['Very Clean', 'Moderately Clean', 'Somewhat Messy', 'Messy'],
    smoking: ['No Smoking', 'Outside Only', 'Smoking Friendly'],
    pets: ['No Pets', 'Pet Friendly', 'Has Pets'],
    workSchedule: ['Regular Hours', 'Flexible Hours', 'Night Owl'],
    socialLevel: ['Very Social', 'Moderately Social', 'Occasionally Social', 'Not Social'],
    guestPreference: ['Frequent Guests', 'Occasional Guests', 'Rare Guests', 'No Guests'],
    music: ['Shared Music OK', 'With Headphones', 'Quiet Environment']
  };

  const preferenceIcons = {
    workSchedule: {
      'Regular Hours': '☀️',
      'Flexible Hours': '⏱️',
      'Night Owl': '🦉'
    },
    socialLevel: {
      'Very Social': '🎉',
      'Moderately Social': '👥',
      'Occasionally Social': '👤',
      'Not Social': '🧘'
    },
    cleanliness: {
      'Very Clean': '✨',
      'Moderately Clean': '🧼',
      'Somewhat Messy': '📚',
      'Messy': '🌪️'
    },
    smoking: {
      'No Smoking': '🚭',
      'Outside Only': '🚪',
      'Smoking Friendly': '🚬'
    },
    pets: {
      'No Pets': '❌🐾',
      'Pet Friendly': '❤️🐾',
      'Has Pets': '🐶🐱'
    },
    guestPreference: {
      'Frequent Guests': '👋👋',
      'Occasional Guests': '👋',
      'Rare Guests': '🕰️👋',
      'No Guests': '🔒'
    },
    music: {
      'Shared Music OK': '🎵',
      'With Headphones': '🎧',
      'Quiet Environment': '🤫'
    },
    location: {
      'Mumbai': '🏙️',
      'Delhi': '🏛️',
      'Bangalore': '💻',
      'Hyderabad': '🍗',
      'Chennai': '🌊',
      'Kolkata': '🌉',
      'Pune': '🏞️',
      'Ahmedabad': '🏫',
      'Jaipur': '🏰',
      'Surat': '💎',
      'Other': '📍'
    },
    gender: {
      'Male': '👨',
      'Female': '👩',
      'Any': '👥'
    },
    rent: {
      '5000': '₹',
      '8000': '₹',
      '10000': '₹',
      '12000': '₹',
      '15000': '₹',
      '20000': '₹',
      'Other': '₹'
    }
  };

  const preferenceColors = {
    workSchedule: ['bg-white', 'bg-white', 'text-gray-800'],
    socialLevel: ['bg-white', 'bg-white', 'text-gray-800'],
    cleanliness: ['bg-white', 'bg-white', 'text-gray-800'],
    smoking: ['bg-white', 'bg-white', 'text-gray-800'],
    pets: ['bg-white', 'bg-white', 'text-gray-800'],
    guestPreference: ['bg-white', 'bg-white', 'text-gray-800'],
    music: ['bg-white', 'bg-white', 'text-gray-800'],
    location: ['bg-white', 'bg-white', 'text-gray-800'],
    gender: ['bg-white', 'bg-white', 'text-gray-800'],
    rent: ['bg-white', 'bg-white', 'text-gray-800']
  };

  const handleChange = (category, value) => {
    setPreferences(prev => {
      const updated = {
        ...prev,
        [category]: value
      };
      console.log(`Updated ${category} preference to: ${value}`);
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Submitting preferences:", preferences);
    
    // Ensure the required preferences are set
    if (!preferences.location) {
      alert('Please select a preferred location');
      return;
    }
    
    if (!preferences.gender) {
      alert('Please select who you are looking for (Male/Female/Any)');
      return;
    }
    
    if (!preferences.rent) {
      alert('Please select your rent budget');
      return;
    }
    
    onSubmit(preferences);
  };

  const preferenceLabels = {
    location: 'Preferred Location',
    gender: 'Looking For',
    rent: 'Rent Budget (₹)',
    cleanliness: 'Cleanliness Level',
    smoking: 'Smoking Preferences',
    pets: 'Pet Preferences',
    workSchedule: 'Work Schedule',
    socialLevel: 'Social Preferences',
    guestPreference: 'Guest Policy',
    music: 'Music/Noise Preferences'
  };

  const preferenceOrder = [
    'location',
    'gender',
    'rent',
    'workSchedule',
    'socialLevel',
    'cleanliness',
    'smoking',
    'pets',
    'guestPreference',
    'music'
  ];

  const validateForm = () => {
    // Check that at least 5 preferences are set (not empty string)
    const requiredFields = ['location', 'gender', 'rent'];
    const selectedCount = Object.values(preferences).filter(value => value !== '').length;
    const hasRequiredFields = requiredFields.every(field => preferences[field] !== '');
    
    console.log("Required fields check:", hasRequiredFields, "Selected count:", selectedCount);
    return hasRequiredFields && selectedCount >= 5;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">
          Your Preferences
        </h2>
        <p className="text-center text-gray-600 mb-8">
          It will show others what kind of flatmate you prefer.<br />
          Please select at least 5 preferences to update.
        </p>
        
        <form onSubmit={handleSubmit}>
          {preferenceOrder.map((category) => (
            <div key={category} className="mb-10">
              <h3 className={`text-xl font-semibold mb-4 bg-white inline-block px-4 py-1 rounded-full text-blue-600 border border-blue-200`}>
                {preferenceLabels[category]}
              </h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-3">
                {preferenceOptions[category].map((option) => (
                  <div
                    key={option}
                    onClick={() => handleChange(category, option)}
                    className={`
                      cursor-pointer rounded-lg p-4 flex flex-col items-center justify-center transition-all transform hover:scale-105
                      ${preferences[category] === option 
                        ? `bg-white text-blue-600 border-2 border-blue-400 shadow-lg` 
                        : `bg-white text-gray-800 border border-gray-200 shadow-sm`
                      }
                    `}
                  >
                    <div className="text-4xl mb-2">
                      {preferenceIcons[category][option] || '📋'}
                    </div>
                    <div className="text-center font-medium">
                      {category === 'rent' ? `₹ ${option}` : option}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div className="mt-8 flex justify-center">
            <button
              type="submit"
              disabled={!validateForm()}
              className={`
                py-3 px-8 rounded-full text-white font-bold text-lg shadow-lg transform transition-all
                ${validateForm()
                  ? 'bg-gradient-to-r from-blue-400 to-sky-500 hover:from-blue-500 hover:to-sky-600 hover:scale-105'
                  : 'bg-gray-400 cursor-not-allowed'
                }
              `}
            >
              {initialValues ? 'Update Preferences' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PreferenceForm; 