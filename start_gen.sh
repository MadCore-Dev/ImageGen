#!/bin/bash
# Move to the project directory
cd "/Users/manojsamal/Documents/Projects/ImageGen"

# Check if already running
PORT_FILE="/tmp/.gen_tool_port"
if [ -f "$PORT_FILE" ]; then
    OLD_PORT=$(cat "$PORT_FILE")
    if lsof -i :$OLD_PORT -t >/dev/null; then
        echo "✅ Image Generator already running on port $OLD_PORT"
        open "http://localhost:$OLD_PORT"
        exit 0
    fi
fi

# fix #14: dynamically resolve python3, don't rely on hardcoded Homebrew path
PYTHON=$(command -v python3)
if [ -z "$PYTHON" ]; then
    echo "❌ python3 not found. Please install Python 3."
    exit 1
fi

# Find an available port dynamically using Python
PORT=$("$PYTHON" -c 'import socket; s=socket.socket(); s.bind(("", 0)); print(s.getsockname()[1]); s.close()')

# Write the selected port to a temp file
echo "$PORT" > "$PORT_FILE"

# Run the server invisibly in the background on the dynamic port
nohup "$PYTHON" -m http.server $PORT > gen_tool.log 2>&1 &

echo "✅ Web server started on http://localhost:$PORT"

# fix #14: auto-open the tool in the default browser
sleep 0.5
open "http://localhost:$PORT"