#!/bin/bash

# Script to start both frontend and backend servers

# Print helper message
echo "Starting Roommate Finder servers..."

# Start the backend server
echo "Starting backend server..."
cd backend
npm start &
BACKEND_PID=$!

# Wait a moment for backend to initialize
sleep 3

# Start the frontend server
echo "Starting frontend server..."
cd ../frontend
npm start &
FRONTEND_PID=$!

# Display information
echo ""
echo "Servers started successfully!"
echo "Backend running at http://localhost:5002"
echo "Frontend running at http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to handle process termination
function cleanup {
  echo ""
  echo "Shutting down servers..."
  kill $BACKEND_PID
  kill $FRONTEND_PID
  echo "Servers stopped."
  exit 0
}

# Set up SIGINT (Ctrl+C) handler
trap cleanup SIGINT

# Keep script running
wait 