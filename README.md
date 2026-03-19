"# Online Counseling System

This is a web-based online counseling system built with Node.js backend and HTML/CSS/JavaScript frontend. It uses SQLite for data persistence and Socket.io for real-time messaging.

## Features

- User registration and authentication (Admin, Counselor, Student roles)
- Session booking
- Real-time messaging between counselors and students
- Admin dashboard for user management
- Responsive web interface

## Prerequisites

- Node.js (version 14 or higher)

## Installation

1. Clone or download the project.

2. Navigate to the backend directory:
   ```
   cd backend
   ```

3. Install dependencies:
   ```
   npm install
   ```

## Running the Application

1. Start the server:
   ```
   npm start
   ```
   or
   ```
   node server.js
   ```

2. Open your web browser and go to `http://localhost:3000`

The server will run on port 3000 and serve the frontend statically.

## Database

The application uses SQLite (`data.db`) which is created automatically on first run. The database includes tables for users, sessions, and messages.

## Default Admin Account

- Username: admin
- Password: admin123

## Technologies Used

- Backend: Node.js, Express.js, Socket.io, SQLite3
- Frontend: HTML, CSS, JavaScript
- Authentication: JWT, bcrypt" 
