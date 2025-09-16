#!/bin/bash
echo "🔴 Killing all Node.js servers..."
pkill -f "node server.js"
pkill -f "npm start"
pkill -f "node"
echo "✅ All Node.js servers killed!"
