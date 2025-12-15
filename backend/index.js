import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectRabbitMQ, publishToQueue, consumeFromQueue } from './rabbitMQ/rabbitmq.js';

const app = express();
const httpServer = createServer(app);
const PORT = 3000;

app.get('/', async (req, res) => {
  res.send('Backend service started')
});

// Make new socket server
const io = new Server(httpServer, {
  pingTimeout: 60000,
  cors: {
    origin:true,
    methods: ['GET', 'POST']
  }
});

// Socket.io connection handler - triggered when a client connects
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Event: register-frontend
  socket.on('register-frontend', () => {
    try {
      socket.join('frontend');
      console.log('Frontend client registered:', socket.id);

      // Log total number of connected frontend clients for monitoring
      const frontendRoom = io.sockets.adapter.rooms.get('frontend');
      const totalClients = frontendRoom ? frontendRoom.size : 0;
      console.log(`Total frontend clients: ${totalClients}`);
    } catch (error) {
      console.error('Error registering frontend client:', socket.id, error.message);
    }
  })

  // Event: sensor speed reading
  socket.on('sensor speed reading', (speed) => {
    try {
      console.log('Received speed from sensor:', speed);

      // Check how many frontend clients are connected before broadcasting
      // This helps with debugging connectivity issues
      const frontendRoom = io.sockets.adapter.rooms.get('frontend');
      const clientCount = frontendRoom ? frontendRoom.size : 0;
      console.log(`Broadcasting to ${clientCount} frontend clients`);

      // Broadcast to all clients in the 'frontend' room
      io.to('frontend').emit('speed', speed);

      // Publish to RabbitMQ for asynchronous batch DB insert
      try {
        publishToQueue(speed);
        console.log('Published to RabbitMQ:', speed);
      } catch (error) {
        console.error('Failed to publish to RabbitMQ:', error.message);
        console.error('Speed data:', speed);
      }
    } catch (error) {
      console.error('Error processing sensor speed reading:', error.message);
      console.error('Stack trace:', error.stack);
    }
  })

  // Event: disconnect
  socket.on('disconnect', (reason) => {
    try {
      console.log('Socket disconnected:', socket.id);

      // Log remaining frontend client count
      const frontendRoom = io.sockets.adapter.rooms.get('frontend');
      const remainingClients = frontendRoom ? frontendRoom.size : 0;
      console.log(`Remaining frontend clients: ${remainingClients}`);
    } catch (error) {
      console.error('Error in disconnect handler:', error.message);
    }
  })

  // Event: error
  socket.on('error', (error) => {
    console.error('Socket error for client:', socket.id);
    console.error('Error details:', error.message);
  })
});

const startServer = async () => {
  try {
    
    // This establishes the connection and creates the channel for publishing/consuming
    await connectRabbitMQ();
    console.log('RabbitMQ connection established');
    
    // This sets up the batch processor that saves speed data to database
    consumeFromQueue();
    console.log('Started consuming from RabbitMQ queue');

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });

    // Handle HTTP server errors
    httpServer.on('error', (error) => {
      console.error('HTTP server error:', error.message);
      process.exit(1);
    });

  } catch (error) {
    // Catch any initialization errors
    console.error('Failed to start server:', error.message);
    console.error('Error details:', error.stack);
    process.exit(1);
  }
};

startServer();