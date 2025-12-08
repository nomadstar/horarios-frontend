# Frontend service Dockerfile
# Using Node 20 for Vite compatibility (requires >=20.19.0)
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --no-audit --no-fund

# Copy application code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Set environment variables
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]