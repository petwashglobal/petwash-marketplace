#!/usr/bin/env bash
# Production Start Script for Pet Wash™

set -e
export NODE_ENV=production
exec tsx server/index.ts
