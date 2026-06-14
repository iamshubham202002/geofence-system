#!/bin/bash
# Run this ONCE on your local machine to initialize Go modules
set -e

echo "🚀 GeoFleet Backend Setup"
cd backend

echo "📦 Downloading Go dependencies..."
go mod tidy
go mod download

echo "✅ Backend ready. Run with:"
echo "   go run ./cmd/server"
echo ""
echo "🐳 Or use Docker:"
echo "   docker-compose up --build"
