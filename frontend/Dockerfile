FROM node:20-alpine

WORKDIR /app

# Copy package files first for better Docker layer caching
# If package.json doesn't change, npm install layer is cached
COPY package*.json ./

# Install all dependencies (including dev dependencies for Vite dev server)
RUN npm install

# Copy all source files including .env file
# .env provides default values, but docker-compose environment vars take precedence
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server with --host flag to accept connections from outside container
# Vite will read VITE_BACKEND_URL from environment variables set in docker-compose.yml
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]