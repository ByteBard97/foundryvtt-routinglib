#!/bin/bash
#
# This script starts the isolated Foundry VTT development server.
# It uses a dedicated data directory and a separate port to avoid
# conflicts with any main Foundry installation.

# --- Configuration ---
# Path to your Node.js Foundry installation
FOUNDRY_PATH="/home/geoff/FoundryVTT-Node-13.346"

# Absolute path to this project's directory
PROJECT_PATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

# Path for the development server's data
DATA_PATH="${PROJECT_PATH}/foundryvtt_dev_data"

# Port for the development server
DEV_PORT="30001"

# --- Start Server ---
echo "Starting Foundry VTT development server..."
echo "Data Path: ${DATA_PATH}"
echo "URL: http://localhost:${DEV_PORT}"
echo "-----------------------------------------------------"

cd "${FOUNDRY_PATH}" && node main.js --dataPath="${DATA_PATH}" --headless --port="${DEV_PORT}" 