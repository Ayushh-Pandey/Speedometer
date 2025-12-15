# Speedometer

Real-time speed monitoring application that displays sensor data on a dashboard.

## Tech Stack

**Backend**
- Node.js with Express
- Socket.IO for real-time communication
- PostgreSQL database
- Prisma ORM
- RabbitMQ for message queuing

**Frontend**
- React
- Vite
- Socket.IO client

**Sensor**
- Node.js
- Socket.IO client (simulates speed sensor)

**Infrastructure**
- Docker & Docker Compose
- PostgreSQL 16
- RabbitMQ with management console

## How to Run

Make sure you have Docker and Docker Compose installed.

1. Clone the repository and navigate to project directory

2. Start all services:
```bash
docker compose up -d
```

3. Wait for all containers to start (takes about 30-40 seconds)

4. Access the application:
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000
   - RabbitMQ Management: http://localhost:15672 (username: guest, password: guest)

5. To stop the application:
```bash
docker compose down
```

## What it does

The sensor service generates random speed values every second and sends them to the backend via Socket.IO. The backend broadcasts these values to all connected frontend clients in real-time and also queues them in RabbitMQ for batch processing. Speed values are stored in PostgreSQL database in batches of 10.

## Troubleshooting

If containers fail to start, try rebuilding:
```bash
docker compose down -v
docker compose up -d --build
```