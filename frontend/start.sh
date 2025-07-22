#!/bin/bash

# Ensure static files are properly copied for standalone mode
echo "Setting up Next.js standalone server..."

# Check if static files exist
if [ ! -d ".next/static" ]; then
    echo "ERROR: .next/static directory not found!"
    echo "Available files in .next/:"
    ls -la .next/ || echo "No .next directory found"
    exit 1
fi

# Check if standalone server exists
if [ ! -f ".next/standalone/server.js" ]; then
    echo "ERROR: .next/standalone/server.js not found!"
    echo "Available files in .next/standalone/:"
    ls -la .next/standalone/ || echo "No .next/standalone directory found"
    exit 1
fi

# Copy static files to standalone directory if they don't exist there
if [ ! -d ".next/standalone/.next/static" ]; then
    echo "Copying static files to standalone directory..."
    mkdir -p .next/standalone/.next/
    cp -r .next/static .next/standalone/.next/static
    echo "Static files copied successfully"
fi

# Copy public files to standalone directory if they don't exist there
if [ ! -d ".next/standalone/public" ] && [ -d "public" ]; then
    echo "Copying public files to standalone directory..."
    cp -r public .next/standalone/public
    echo "Public files copied successfully"
fi

echo "Starting Next.js server..."
echo "HOSTNAME: ${HOSTNAME:-0.0.0.0}"
echo "PORT: ${PORT:-3000}"

# Start the server
cd .next/standalone
HOSTNAME=${HOSTNAME:-0.0.0.0} PORT=${PORT:-3000} node server.js
