#!/bin/bash

# Function to check if a process is running on a port
check_port() {
    lsof -i:$1 >/dev/null 2>&1
}

# Function to kill process on a port
kill_port() {
    lsof -ti:$1 | xargs kill -9 2>/dev/null
}

# Function to check if server is responding
check_server() {
    for i in {1..30}; do
        if curl -s http://localhost:$PORT/races/calendar/2024 >/dev/null; then
            echo "Server is up and running!"
            return 0
        fi
        echo "Waiting for server to start... ($i/30)"
        sleep 1
    done
    echo "Server failed to start properly"
    return 1
}

# Load environment variables
source backend/.env

# Ensure ports are free
echo "Cleaning up any existing processes..."
kill_port 8000

# Create and activate virtual environment
if [ ! -d "backend/venv" ]; then
    echo "Creating virtual environment..."
    cd backend
    python3 -m venv venv
    cd ..
fi

# Activate virtual environment
source backend/venv/bin/activate

# Install requirements
echo "Installing Python dependencies..."
pip install -r backend/requirements.txt

# Configure ngrok
echo "Configuring ngrok..."
ngrok config add-authtoken $NGROK_AUTH_TOKEN

# Start the FastAPI server in the background
echo "Starting FastAPI server..."
cd backend
uvicorn main:app --host 0.0.0.0 --port $PORT &
cd ..

# Check if server started successfully
if ! check_server; then
    echo "Failed to start server. Please check the logs above for errors."
    cleanup
    exit 1
fi

# Start ngrok
echo "Starting ngrok tunnel..."
echo "Once ngrok starts, open index.html in your browser to use the application"
echo "Press Ctrl+C to stop everything when you're done"
ngrok http --domain=$NGROK_DOMAIN $PORT

# Cleanup function
cleanup() {
    echo "Shutting down..."
    kill_port $PORT
    pkill -f ngrok
    deactivate
}

# Set up cleanup on script termination
trap cleanup EXIT 