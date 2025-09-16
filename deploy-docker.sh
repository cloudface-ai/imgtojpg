#!/bin/bash

# Docker deployment script for heic-to-jpg
# This script builds and runs the Docker container with ImageMagick, dcraw, and VIPS

set -e

echo "🐳 Building Docker image for heic-to-jpg..."

# Build the production image
docker build -f Dockerfile.prod -t heic-to-jpg:latest .

echo "✅ Docker image built successfully!"

# Stop and remove existing container if it exists
if [ "$(docker ps -q -f name=heic-to-jpg)" ]; then
    echo "🔄 Stopping existing container..."
    docker stop heic-to-jpg
    docker rm heic-to-jpg
fi

echo "🚀 Starting heic-to-jpg container..."

# Run the container
docker run -d \
    --name heic-to-jpg \
    -p 10000:10000 \
    -v "$(pwd)/uploads:/app/uploads" \
    -v "$(pwd)/public/converted:/app/public/converted" \
    --restart unless-stopped \
    heic-to-jpg:latest

echo "✅ Container started successfully!"
echo "🌐 Application is running at: http://localhost:10000"
echo "📁 Uploads directory: $(pwd)/uploads"
echo "📁 Converted directory: $(pwd)/public/converted"

# Show container status
echo ""
echo "📊 Container status:"
docker ps --filter name=heic-to-jpg

echo ""
echo "📝 Container logs:"
docker logs heic-to-jpg --tail 20

echo ""
echo "🔍 To view logs: docker logs -f heic-to-jpg"
echo "🛑 To stop: docker stop heic-to-jpg"
echo "🗑️  To remove: docker rm heic-to-jpg"
