# Use official Node.js runtime as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Clean npm cache and install backend dependencies
RUN npm cache clean --force && \
    npm install --omit=dev --no-optional --no-audit --no-fund

# Copy application code (needed for frontend build)
COPY . .

# Install frontend dependencies and build
RUN cd frontend && \
    npm install --omit=dev --no-optional --no-audit --no-fund && \
    npm run build

# Set environment variables
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
