import amqp from 'amqplib';
import prisma from '../db/index.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'sensor data queue';
const BATCH_SIZE = 10;           // Process batch when we have 10 messages
const BATCH_TIMEOUT = 10000;     // Or after 10 seconds (whichever comes first)
const MAX_RETRIES = 3;           // Maximum retries for failed batch inserts
const RETRY_DELAY = 5000;        // Wait 5 seconds before retrying failed batch

let connection = null;           // RabbitMQ connection object
let channel = null;              // RabbitMQ channel for pub/sub
let buffer = [];                 // In-memory buffer of messages waiting to be processed
let pendingMessages = [];        // Messages awaiting acknowledgment (for retry logic)
let timer = null;                // Timeout timer for batch processing
let isProcessing = false;        // Flag to prevent concurrent batch processing

export const connectRabbitMQ = async () => {
    try {
        console.log('Connecting to RabbitMQ at', RABBITMQ_URL);

        // Establish connection to RabbitMQ server
        connection = await amqp.connect(RABBITMQ_URL);
        console.log('RabbitMQ connection established');

        // Create a channel for message operations
        channel = await connection.createChannel();
        console.log('RabbitMQ channel created');

        // Assert queue exists (create if doesn't exist)
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log('Queue asserted:', QUEUE_NAME);

        // Error handlers for connection failures
        connection.on('error', (error) => {
            console.error('RabbitMQ connection error:', error.message);
        });

        connection.on('close', () => {
            console.warn('RabbitMQ connection closed');
        });

        channel.on('error', (error) => {
            console.error('RabbitMQ channel error:', error.message);
        });

        channel.on('close', () => {
            console.warn('RabbitMQ channel closed');
        });

    } catch (error) {
        console.error('Failed to connect to RabbitMQ:', error.message);
        throw error;
    }
}

// Function for publishing value to queue
export const publishToQueue = (message) => {
    // Validate channel is initialized
    if (!channel) {
        console.warn('RabbitMQ channel not initialized. Call connectRabbitMQ() first', message);
        return false; // By this it will not cresh, will skip
    }

    try {
        // Convert message to Buffer and send to queue
        const sent = channel.sendToQueue(
            QUEUE_NAME,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        );

        // Check if message was queued successfully
        if (!sent) {
            console.warn('Message could not be sent (channel buffer full)');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error publishing to queue:', error.message);
        return false; // By this it will not cresh, will skip
    }
}

// Function to consume messages from queue
export const consumeFromQueue = () => {
    // Limit how many unacknowledged messages we can have
    channel.prefetch(BATCH_SIZE * 2);

    
    // Process buffered messages by inserting them into database
    const processBatch = async (retryCount = 0) => {
        // Prevent concurrent batch processing
        if (isProcessing) {
            console.log('Batch processing already in progress, skipping');
            return;
        }

        if (buffer.length === 0) {
            return;
        }

        isProcessing = true;

        // Copy buffer and clear immediately
        // This prevents memory leak if database insert fails
        const batchToProcess = [...buffer];
        const messagesToAck = [...pendingMessages];
        buffer = [];
        pendingMessages = [];

        if (timer) {
            clearTimeout(timer);
            timer = null;
        }

        console.log(`Processing batch of ${batchToProcess.length} messages (attempt ${retryCount + 1}/${MAX_RETRIES})`);

        try {
            // Insert batch into database
            await prisma.speedValues.createMany({
                data: batchToProcess.map((speed) => ({ speed }))
            });

            console.log(`Successfully inserted ${batchToProcess.length} records into database`);

            // Acknowledge messages only after successful database insert
            // This ensures we don't lose data if database insert fails
            messagesToAck.forEach((msg) => {
                channel.ack(msg);
            });

            console.log(`Acknowledged ${messagesToAck.length} messages`);

        } catch (error) {
            // Database insert failed
            console.error(`Batch insert failed (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
            console.error('Failed batch size:', batchToProcess.length);

            // Retry logic with exponential backoff
            if (retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
                console.log(`Retrying in ${delay}ms...`);

                // Re-add messages to buffer for retry
                buffer.unshift(...batchToProcess);
                pendingMessages.unshift(...messagesToAck);

                // Schedule retry with exponential backoff
                setTimeout(() => {
                    isProcessing = false;
                    processBatch(retryCount + 1);
                }, delay);

            } else {
                // Max retries exceeded - reject messages
                console.error(`Max retries (${MAX_RETRIES}) exceeded, rejecting batch`);
                console.error('Lost data:', batchToProcess);

                // Reject messages - they go to dead letter queue if configured
                // requeue: false = don't put back in queue (would cause infinite loop)
                messagesToAck.forEach((msg) => {
                    channel.nack(msg, false, false);
                });

                console.warn('Messages rejected and sent to dead letter queue (if configured)');
                console.warn('Consider implementing dead letter queue handling for data recovery');

                isProcessing = false;
            }
        } finally {
            // Only reset flag if not retrying
            if (retryCount === 0 || retryCount >= MAX_RETRIES) {
                isProcessing = false;
            }
        }
    };

    
    // Message consumer
     
    channel.consume(QUEUE_NAME, async (msg) => {
        try {
            // Null message indicates consumer was cancelled
            if (!msg) {
                console.warn('Consumer cancelled by RabbitMQ');
                return;
            }

            // Parse message content
            const data = JSON.parse(msg.content.toString());
            console.log('Received message from queue:', data);

            // Add to buffer for batch processing
            buffer.push(data);
            pendingMessages.push(msg);

            console.log(`Buffer size: ${buffer.length}/${BATCH_SIZE}`);

            // Start timeout timer if not already running
            // This ensures batch is processed even if we don't reach BATCH_SIZE
            if (!timer) {
                timer = setTimeout(() => {
                    console.log('Batch timeout reached, processing buffer');
                    processBatch();
                }, BATCH_TIMEOUT);
            }

            // Process batch immediately if we've reached batch size
            if (buffer.length >= BATCH_SIZE) {
                console.log('Batch size reached, processing immediately');
                await processBatch();
            }

        } catch (error) {
            // Error parsing or processing message
            console.error('Error processing message:', error.message);
            console.error('Message content:', msg.content.toString());

            // Reject malformed message
            channel.nack(msg, false, false);
            console.warn('Malformed message rejected');
        }
    });

    console.log('Consumer started, waiting for messages...');
    console.log(`Batch size: ${BATCH_SIZE}, Timeout: ${BATCH_TIMEOUT}ms`);
}