# Roommate Finder

A web application to help users find compatible roommates based on their preferences and lifestyle.

## Features

- User authentication (signup/login)
- Profile management
- Roommate preferences setup
- Matching algorithm based on compatibility
- Friend request system with real-time notifications
- View detailed profiles of potential roommates
- Add/remove connections

## Tech Stack

### Frontend
- React.js
- TailwindCSS for styling
- Axios for API requests
- React Router for navigation

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- WebSocket for real-time notifications
- Multer for file uploads

## Getting Started

### Prerequisites
- Node.js
- MongoDB

### Installation

1. Clone the repository
   ```
   git clone https://github.com/D-SRIHAS/Roommate-Finder.git
   cd Roommate-Finder
   ```

2. Install backend dependencies
   ```
   cd backend
   npm install
   ```

3. Install frontend dependencies
   ```
   cd ../frontend
   npm install
   ```

4. Create a `.env` file in the backend directory with the following:
   ```
   PORT=5002
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   ```

### Running the application

#### Option 1: Using the convenience script (recommended)

Run both servers with one command:
```
./start-servers.sh
```
This will start both backend and frontend servers and provide a convenient way to stop them with Ctrl+C.

#### Option 2: Running servers separately

1. Start the backend server
   ```
   cd backend
   node server.js
   ```

2. Start the frontend development server
   ```
   cd ../frontend
   npm start
   ```

3. Open your browser and navigate to `http://localhost:3000`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.