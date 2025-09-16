#!/bin/bash

# Test script to verify Docker container has all required system dependencies
# This script checks if ImageMagick, dcraw, and VIPS are available

echo "🧪 Testing Docker container dependencies..."

# Check if container is running
if [ ! "$(docker ps -q -f name=heic-to-jpg)" ]; then
    echo "❌ Container 'heic-to-jpg' is not running!"
    echo "   Start it first with: ./deploy-docker.sh"
    exit 1
fi

echo "✅ Container is running"

# Test ImageMagick
echo "🔍 Testing ImageMagick..."
if docker exec heic-to-jpg which convert > /dev/null 2>&1; then
    echo "✅ ImageMagick (convert) is available"
    docker exec heic-to-jpg convert --version | head -1
else
    echo "❌ ImageMagick (convert) is NOT available"
fi

# Test dcraw
echo "🔍 Testing dcraw..."
if docker exec heic-to-jpg which dcraw > /dev/null 2>&1; then
    echo "✅ dcraw is available"
    docker exec heic-to-jpg dcraw -V | head -1
else
    echo "❌ dcraw is NOT available"
fi

# Test VIPS
echo "🔍 Testing VIPS..."
if docker exec heic-to-jpg which vips > /dev/null 2>&1; then
    echo "✅ VIPS is available"
    docker exec heic-to-jpg vips --version | head -1
else
    echo "❌ VIPS is NOT available"
fi

# Test Node.js
echo "🔍 Testing Node.js..."
if docker exec heic-to-jpg which node > /dev/null 2>&1; then
    echo "✅ Node.js is available"
    docker exec heic-to-jpg node --version
else
    echo "❌ Node.js is NOT available"
fi

# Test npm
echo "🔍 Testing npm..."
if docker exec heic-to-jpg which npm > /dev/null 2>&1; then
    echo "✅ npm is available"
    docker exec heic-to-jpg npm --version
else
    echo "❌ npm is NOT available"
fi

# Test application health
echo "🔍 Testing application health..."
if curl -f http://localhost:10000 > /dev/null 2>&1; then
    echo "✅ Application is responding on port 10000"
else
    echo "❌ Application is NOT responding on port 10000"
fi

echo ""
echo "🎯 Dependency test complete!"
echo "   All tools should be available for RAW conversion."
