#!/bin/bash

# CityPulse Launch Script

# Kill any existing processes on ports 3001 and 5173
lsof -ti :3001 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null

echo "🏙️  Starting CityPulse..."

# Start the server in the background
cd server
npm run dev &
SERVER_PID=$!

# Start the client
cd ../client
npm run dev &
CLIENT_PID=$!

echo "📡 Server running on http://localhost:3001"
echo "🌐 Client running on http://localhost:5173"
echo "Press Ctrl+C to stop both."

# Wait for Ctrl+C
trap "kill $SERVER_PID $CLIENT_PID; exit" INT
wait
