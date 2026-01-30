#!/bin/sh
set -e

echo "=== PetWash Backend Starting ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "PWD: $(pwd)"

# Try to find and run the server entry point
if [ -f "dist/server/server/index.js" ]; then
  echo "Starting from: dist/server/server/index.js"
  exec node dist/server/server/index.js
elif [ -f "dist/server/index.js" ]; then
  echo "Starting from: dist/server/index.js"
  exec node dist/server/index.js
else
  echo "ERROR: Could not find server entry point"
  echo "Contents of dist/:"
  find dist -type f -name "*.js" | head -20
  exit 1
fi
