import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

console.log("Email Verification Component is Rendering ✅");

const EmailVerification = () => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("sendOtp"); // sendOtp, verifyOtp, or verifyingToken
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState("otp"); // otp or link
  const navigate = useNavigate();
  const location = useLocation();

  // Check for token in URL when component mounts
  useEffect(() => {
    // Check for email in location state (set during registration)
    if (location.state && location.state.email) {
      setEmail(location.state.email);
      console.log("Email pre-filled from registration:", location.state.email);
    }
    
    // Check for token in URL parameters
    const query = new URLSearchParams(location.search);
    const token = query.get('token');
    
    if (token) {
      setStep("verifyingToken");
      verifyEmailWithToken(token);
    }
  }, [location]);

  const verifyEmailWithToken = async (token) => {
    setIsLoading(true);
    setMessage("Verifying your email...");
    
    try {
      const response = await axios.post("http://localhost:5005/api/auth/verify-email-token", { token });
      
      if (response.data.success) {
        setIsSuccess(true);
        setMessage("Email verified successfully! Redirecting...");
        
        // Update localStorage to reflect verified status
        localStorage.setItem('emailVerified', 'true');
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        setIsSuccess(false);
        setMessage(response.data.message || "Failed to verify email. Please try using the OTP method instead.");
        setStep("sendOtp");
      }
    } catch (error) {
      console.error("Token Verification Error:", error);
      setIsSuccess(false);
      setMessage(error.response?.data?.message || "Token verification failed. Please try using the OTP method.");
      setStep("sendOtp");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");
    
    try {
      // Determine which endpoint to use based on verification method
      const endpoint = verificationMethod === 'otp' 
        ? "http://localhost:5005/api/auth/send-otp" 
        : "http://localhost:5005/api/auth/send-verification-email";
      
      const response = await axios.post(endpoint, { email });
      
      if (response.data.success) {
        setIsSuccess(true);
        if (verificationMethod === 'otp') {
          setMessage(`Verification code sent to ${email}. Please check your inbox and enter the code below.`);
          setStep("verifyOtp");
        } else {
          setMessage(`Verification link sent to ${email}! Please check your email and click the link to verify.`);
        }
      } else {
        setIsSuccess(false);
        setMessage(response.data.message || "Failed to send verification. Please try again.");
      }
    } catch (error) {
      console.error("Send Verification Error:", error);
      setIsSuccess(false);
      
      if (error.response?.status === 404 && error.response?.data?.message) {
        // Email not found error
        setMessage(error.response.data.message);
      } else if (error.response?.status === 422 || 
                (error.response?.data?.errorType === 'email_undeliverable')) {
        // Undeliverable email address
        setMessage("This email address could not be found or is unable to receive mail. Please check the email address and try again.");
      } else {
        setMessage(error.response?.data?.message || "An error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");
    
    try {
      const response = await axios.post("http://localhost:5005/api/auth/verify-otp", { 
        email, 
        otp 
      });
      
      if (response.data.success) {
        setIsSuccess(true);
        setMessage("Email verified successfully! Redirecting...");
        
        // Update localStorage to reflect verified status
        localStorage.setItem('emailVerified', 'true');
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        setIsSuccess(false);
        setMessage(response.data.message || "Failed to verify OTP. Please try again.");
      }
    } catch (error) {
      console.error("Verify OTP Error:", error);
      setIsSuccess(false);
      setMessage(error.response?.data?.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    setMessage("");
    
    try {
      const response = await axios.post("http://localhost:5005/api/auth/resend-verification", { 
        email,
        method: verificationMethod
      });
      
      if (response.data.success) {
        setIsSuccess(true);
        if (verificationMethod === 'otp') {
          setMessage("New OTP sent successfully!");
        } else {
          setMessage("New verification link sent! Please check your email.");
        }
      } else {
        setIsSuccess(false);
        setMessage(response.data.message || "Failed to resend verification. Please try again.");
      }
    } catch (error) {
      console.error("Resend Verification Error:", error);
      setIsSuccess(false);
      
      if (error.response?.status === 404 && error.response?.data?.message) {
        // Email not found error
        setMessage(error.response.data.message);
      } else if (error.response?.status === 422 || 
                (error.response?.data?.errorType === 'email_undeliverable')) {
        // Undeliverable email address
        setMessage("This email address could not be found or is unable to receive mail. Please go back and try a different email address.");
        // Set a flag to show additional information
        setStep("sendOtp"); // Return to email input step
      } else {
        setMessage(error.response?.data?.message || "An error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new form submission handler for "register first" option
  const handleRegisterRedirect = () => {
    navigate('/signup');
  };

  // Add a function to handle checking if email exists
  const validateEmailWithGmailApi = async (email) => {
    // This would be a client-side email validation
    // Actual email verification requires server-side checks
    if (!email || !email.includes('@')) {
      return false;
    }

    // Basic pattern check - a more comprehensive check happens on the server
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  };

  // Add email validation before submission
  const handleEmailValidation = async () => {
    if (!email) {
      setMessage("Please enter an email address");
      setIsSuccess(false);
      return false;
    }

    // Basic client-side validation
    const isValidFormat = await validateEmailWithGmailApi(email);
    if (!isValidFormat) {
      setMessage("Please enter a valid email address format");
      setIsSuccess(false);
      return false;
    }

    return true;
  };

  // Update the form submission to include validation
  const handleSubmitWithValidation = async (e) => {
    e.preventDefault();
    
    // Validate email first
    const isValid = await handleEmailValidation();
    if (!isValid) return;
    
    // Proceed with sending OTP
    handleSendOtp(e);
  };

  // Loading state while verifying token
  if (step === "verifyingToken") {
    return (
      <div
        className="flex justify-center items-center min-h-screen bg-cover bg-center"
        style={{ backgroundImage: "url('/assets/bg-roommates.jpg')" }}
      >
        <div className="bg-white bg-opacity-90 p-8 rounded-xl shadow-2xl w-96">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
            Verifying Your Email
          </h2>
          <div className="flex justify-center my-6">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-center text-gray-700">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex justify-center items-center min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/assets/bg-roommates.jpg')" }}
    >
      <div className="bg-white bg-opacity-90 p-8 rounded-xl shadow-2xl w-96">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
          {step === "sendOtp" ? "Verify Your Email" : "Enter Verification Code"}
        </h2>

        {step === "sendOtp" ? (
          <form onSubmit={handleSubmitWithValidation} className="space-y-5">
            <div>
              <label className="block text-gray-700 font-medium">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium">Select Verification Method</label>
              <div className="flex mt-2 space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="otp"
                    checked={verificationMethod === 'otp'}
                    onChange={() => setVerificationMethod('otp')}
                    className="form-radio h-5 w-5 text-blue-600"
                  />
                  <span className="ml-2 text-gray-700">Verification Code</span>
                </label>
                
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="link"
                    checked={verificationMethod === 'link'}
                    onChange={() => setVerificationMethod('link')}
                    className="form-radio h-5 w-5 text-blue-600"
                  />
                  <span className="ml-2 text-gray-700">Email Link</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {verificationMethod === 'otp' 
                  ? "We'll send a 6-digit code to your email" 
                  : "We'll send a verification link to your email"}
              </p>
            </div>

            <button
              type="submit"
              className={`w-full bg-blue-600 text-white py-2 rounded-lg transition-all transform hover:scale-105 hover:shadow-lg ${
                isLoading ? "opacity-70 cursor-not-allowed" : ""
              }`}
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : `Send ${verificationMethod === 'otp' ? 'Verification Code' : 'Verification Link'}`}
            </button>
            
            {message && (
              <>
                {message.includes("does not exist") && (
                  <button
                    type="button"
                    onClick={handleRegisterRedirect}
                    className="w-full mt-2 bg-green-600 text-white py-2 rounded-lg transition-all transform hover:scale-105 hover:shadow-lg"
                  >
                    Register Now
                  </button>
                )}
                
                {message.includes("unable to receive mail") && (
                  <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Email Delivery Problem:</strong> The email address you entered appears to be invalid or unable to receive mail. 
                      Please double-check your email address or try a different one.
                    </p>
                  </div>
                )}
              </>
            )}
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label className="block text-gray-700 font-medium">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition bg-gray-100"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">
                We've sent a verification code to this email
              </p>
            </div>

            <div>
              <label className="block text-gray-700 font-medium">Verification Code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className={`w-full bg-blue-600 text-white py-2 rounded-lg transition-all transform hover:scale-105 hover:shadow-lg ${
                isLoading ? "opacity-70 cursor-not-allowed" : ""
              }`}
              disabled={isLoading}
            >
              {isLoading ? "Verifying..." : "Verify Email"}
            </button>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep("sendOtp")}
                className="w-1/2 mr-2 bg-gray-200 text-gray-700 py-2 rounded-lg transition-all hover:bg-gray-300"
              >
                Back
              </button>
              
              <button
                type="button"
                onClick={handleResendVerification}
                className="w-1/2 ml-2 bg-gray-200 text-gray-700 py-2 rounded-lg transition-all hover:bg-gray-300"
                disabled={isLoading}
              >
                Resend Code
              </button>
            </div>
          </form>
        )}

        {message && (
          <p
            className={`text-center font-semibold mt-4 ${
              isSuccess ? "text-green-600" : "text-red-500"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default EmailVerification; 