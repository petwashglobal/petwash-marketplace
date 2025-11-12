#!/bin/bash
# Production Start Script for Pet Wash™

set -e
export NODE_ENV=production
node dist/index.js
