#!/bin/bash

echo "🚂 Deploying to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Login to Railway (if not already logged in)
echo "🔐 Logging into Railway..."
railway login

# Link to Railway project (if not already linked)
if [ ! -f ".railway" ]; then
    echo "🔗 Linking to Railway project..."
    railway link
fi

# Deploy to Railway
echo "🚀 Deploying application..."
railway up

echo "✅ Deployment complete!"
echo "🌐 Your app should be available at the Railway URL"
echo "📊 Check Railway dashboard for deployment status"
