import express from 'express';
import { createServer } from 'http';
import { io } from 'socket.io-client';

const app = express();
const httpServer = createServer(app);
const port = 5000;

// Environment variable for backend URL
// In Docker: BACKEND_URL=http://backend:3000
// Local dev: BACKEND_URL=http://localhost:3000
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// Initialize Socket.io connection to the backend
const socket = io(BACKEND_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity
})

socket.on('connect', () => {
    console.log('Socket connected to backend', socket.id);

    // Send value every second to the backend server
    setInterval(() => {
        const speed = Math.floor(Math.random() * 100);
        socket.emit('sensor speed reading', speed);
    }, 1000);
})

// Event: connect_error
socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);
})

// Event: disconnect
socket.on('disconnect', () => {
    console.warn('Socket disconnected from backend');
})

// Start HTTP server
httpServer.listen(port, () => {
    console.log(`Sensor working on http://localhost:${port}`);
})