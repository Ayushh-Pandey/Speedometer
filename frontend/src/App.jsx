import { useState, useEffect } from 'react'
import './App.css'
import { io } from 'socket.io-client';

function App() {
  const [value, setValue] = useState(null)
  const [status, setStatus] = useState('connecting') // For Tracking connection status

  useEffect(() => {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

    // Initialize Socket.io connection to the backend
    const socket = io(BACKEND_URL);

    socket.on('connect', () => {
      console.log('Connected to backend:', socket.id);
      setStatus('connected'); 

      // Register this socket as a frontend client by joining the 'frontend' room
      socket.emit('register-frontend');
      console.log('Registered as frontend client');
    })

    // Disconnet handler
    socket.on('disconnect', () => {
      console.log('Disconnected from backend');
      setStatus('disconnected');
    })

    // Event handler: Receives real-time speed updates from the backend
    socket.on('speed', (speed) => {
      console.log('Received speed:', speed);
      setValue(speed)
    })

    //Socket cleanup function Runs when component unmounts
    return () => {
      console.log('Cleaning up socket connection');
      socket.disconnect();
    };
  }, [])


  return (
    <>
      <h1>Speedometer</h1>
      <div className="status">
        Status: {status}
      </div>

      <div className="speed-display">
        {value !== null ? (
          <p className="speed-value">{value}</p>
        ) : (
          <p className="loading">Waiting for data...</p>
        )}
      </div>

    </>
  )
}

export default App;