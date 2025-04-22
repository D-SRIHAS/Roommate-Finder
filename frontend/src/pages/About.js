import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/About.css';

const About = () => {
  return (
    <div className="about-container">
      <header className="about-header">
        <h1>About Roommate Finder</h1>
        <p className="tagline">Find your perfect roommate match with our intelligent matching system</p>
      </header>

      <section className="about-section">
        <h2>Our Mission</h2>
        <p>
          At Roommate Finder, we understand that finding the right roommate is crucial for a harmonious living situation. 
          Our platform is designed to connect individuals based on lifestyle preferences, habits, and personalities to 
          ensure compatible living arrangements.
        </p>
      </section>

      <section className="about-section">
        <h2>How It Works</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Create Your Profile</h3>
            <p>Sign up and build your profile with details about your lifestyle, preferences, and what you're looking for in a roommate.</p>
          </div>
          <div className="feature-card">
            <h3>Smart Matching</h3>
            <p>Our algorithm analyzes your preferences to find potential roommates who match your living style and requirements.</p>
          </div>
          <div className="feature-card">
            <h3>Connect & Chat</h3>
            <p>Connect with potential roommates, send friend requests, and chat in real-time to get to know each other better.</p>
          </div>
          <div className="feature-card">
            <h3>Find Your Match</h3>
            <p>Make an informed decision and find the perfect roommate to share your living space with.</p>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2>Why Choose Us</h2>
        <ul className="benefits-list">
          <li>Personality-based matching algorithm</li>
          <li>Secure messaging system</li>
          <li>Verified user profiles</li>
          <li>Detailed preference settings</li>
          <li>User-friendly interface</li>
        </ul>
      </section>

      <div className="cta-container">
        <p>Ready to find your ideal roommate?</p>
        <div className="button-group">
          <Link to="/signup" className="cta-button signup">Sign Up Now</Link>
          <Link to="/login" className="cta-button login">Login</Link>
        </div>
      </div>
    </div>
  );
};

export default About; 