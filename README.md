# ImageGen

A simple web-based image generation interface.

## Features
- Dynamic port allocation for the web server to avoid conflicts.
- Serves the `index.html` UI for image generation tasks.
- Background process tracking via port file (`/tmp/.gen_tool_port`).

## Usage
Run the start script to launch the web server:
```bash
./start_gen.sh
```
Then open the displayed local URL in your browser.
