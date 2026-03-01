#!/bin/bash
# <bitbar.title>ImageGen Tool</bitbar.title>
# <bitbar.version>v1.0</bitbar.version>
# <bitbar.author>Project Epoch</bitbar.author>
# <bitbar.author.github>MadCore-Dev</bitbar.author.github>
# <bitbar.desc>Shows ImageGen status, starts the tool, and opens it in your browser.</bitbar.desc>
# <bitbar.dependencies>python3</bitbar.dependencies>
#
# fix #37: SwiftBar plugin for ImageGen / Project Epoch Image Tool
# Reads /tmp/.gen_tool_port written by start_gen.sh to know the server URL.

TOOL_DIR="/Users/manojsamal/Documents/Projects/ImageGen"
PORT_FILE="/tmp/.gen_tool_port"

# ── Determine current server status ───────────────────────────────────────
if [ -f "$PORT_FILE" ]; then
  PORT=$(cat "$PORT_FILE")
  # Check if the process is still alive
  if lsof -i :"$PORT" -t >/dev/null 2>&1; then
    STATUS="🎨"
    STATUS_LABEL="ImageGen :$PORT"
  else
    STATUS="⚪"
    STATUS_LABEL="ImageGen (stopped)"
    rm -f "$PORT_FILE"
    PORT=""
  fi
else
  STATUS="⚪"
  STATUS_LABEL="ImageGen"
  PORT=""
fi

# ── Menu bar line ──────────────────────────────────────────────────────────
echo "$STATUS $STATUS_LABEL"
echo "---"

# ── Dropdown items ────────────────────────────────────────────────────────
if [ -n "$PORT" ]; then
  echo "🌐 Open ImageGen | href=http://localhost:$PORT"
  echo "---"
  echo "✅ Server running on port $PORT"
  echo "📁 $TOOL_DIR | bash=open | param1=$TOOL_DIR | terminal=false"
  echo "---"
  echo "🔄 Restart server | bash=$TOOL_DIR/start_gen.sh | terminal=false | refresh=true"
else
  echo "▶️ Start ImageGen | bash=$TOOL_DIR/start_gen.sh | terminal=false | refresh=true"
  echo "---"
  echo "Server is not running."
fi

echo "---"
echo "📋 View Logs | bash=open | param1=$TOOL_DIR/gen_tool.log | terminal=false"
echo "🗂 Audit Notes | bash=open | param1=$TOOL_DIR/audit.md | terminal=false"
