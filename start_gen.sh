#!/bin/bash
# Move to the project directory
cd "/Users/manojsamal/Documents/Projects/ImageGen"

# Check if already running
PORT_FILE="/tmp/.gen_tool_port"
if [ -f "$PORT_FILE" ]; then
    OLD_PORT=$(cat "$PORT_FILE")
    if lsof -i :$OLD_PORT -t >/dev/null; then
        echo "✅ Character Generator already running on port $OLD_PORT"
        exit 0
    fi
fi

# Find an available port dynamically using Python
PORT=$(/opt/homebrew/bin/python3 -c 'import socket; s=socket.socket(); s.bind(("", 0)); print(s.getsockname()[1]); s.close()')

# Write the selected port to a temp file
echo "$PORT" > "$PORT_FILE"

# Run the server invisibly in the background on the dynamic port
nohup /opt/homebrew/bin/python3 -m http.server $PORT > gen_tool.log 2>&1 &

echo "Web server started dynamically on port $PORT"