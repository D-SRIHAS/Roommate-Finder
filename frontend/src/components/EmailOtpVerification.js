import React, { useState } from 'react';
import EmailVerification from './EmailVerification';
import OTPVerificationComponent from './OTPVerificationComponent';

const EmailOtpVerification = ({ onVerificationComplete }) => {
  const [step, setStep] = useState('email'); // 'email', 'otp', or 'completed'
  const [email, setEmail] = useState('');
  
  const handleOtpSent = (userEmail) => {
    setEmail(userEmail);
    setStep('otp');
  };
  
  const handleBackToEmail = () => {
    setStep('email');
  };
  
  const handleVerificationSuccess = () => {
    setStep('completed');
    
    // Call the parent component callback if provided
    if (onVerificationComplete) {
      onVerificationComplete(email);
    }
  };
  
  return (
    <div>
      {step === 'email' && (
        <EmailVerification onOtpSent={handleOtpSent} />
      )}
      
      {step === 'otp' && (
        <OTPVerificationComponent 
          email={email}
          onVerificationSuccess={handleVerificationSuccess}
          onBackToEmail={handleBackToEmail}
        />
      )}
      
      {step === 'completed' && (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md text-center">
          <svg 
            className="w-16 h-16 mx-auto text-green-500 mb-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M5 13l4 4L19 7"
            />
          </svg>
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Verification Completed!</h2>
          <p className="text-gray-600 mb-6">
            Your email {email} has been successfully verified.
          </p>
        </div>
      )}
    </div>
  );
};

export default EmailOtpVerification; 