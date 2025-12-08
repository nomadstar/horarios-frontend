# Frontend service Dockerfile - Multi-stage build for production
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --no-audit --no-fund

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Production stage - serve with a lightweight HTTP server
FROM node:20-alpine

WORKDIR /usr/src/app

# Install serve to run the built application
RUN npm install -g serve

# Copy built application from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Expose port for Railway
EXPOSE 5173

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["serve", "-s", "dist", "-l", "5173"]