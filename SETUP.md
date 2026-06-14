# GeoFleet — Geofencing & Real-time Alert System

A full-stack vehicle geofencing system with real-time WebSocket alerts.

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐       ┌──────────────┐
│  React Frontend │  HTTP   │   Go REST API         │ SQL   │  PostgreSQL  │
│  (Vite + Leaflet│ ───────▶│   (gorilla/mux)       │──────▶│  (geofence_db│
│   WebSocket)    │◀────────│   + WebSocket Hub     │       │  )           │
└─────────────────┘  WS     └──────────────────────┘       └──────────────┘
```

**Backend:** Go 1.21, gorilla/mux, gorilla/websocket, lib/pq  
**Database:** PostgreSQL 15 (pure SQL, no PostGIS needed — ray-casting algorithm)  
**Frontend:** React 18, Vite, React-Leaflet, react-hot-toast  
**Infrastructure:** Docker, Docker Compose

---

## Prerequisites

- Docker & Docker Compose (for containerized setup)
- OR: Go 1.21+ and Node 18+ and PostgreSQL 15+ (local setup)

---

## 🐳 Quick Start with Docker Compose (Recommended)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/geofence-system
cd geofence-system

# Start all services (PostgreSQL + Backend)
docker-compose up --build

# Backend will be available at http://localhost:8080
# Frontend: deploy separately (see Frontend Deployment below)
```

The backend auto-runs migrations on startup. No manual DB setup needed.

---

## 🛠️ Local Development Setup

### Backend

```bash
cd backend

# Install dependencies
go mod download

# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=geofence_db
export PORT=8080

# Create the database
psql -U postgres -c "CREATE DATABASE geofence_db;"

# Run the server
go run ./cmd/server
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Copy env file
cp .env.example .env
# Edit .env if your backend runs on a different URL

# Start dev server
npm run dev
# Frontend at http://localhost:3000
```

---

## 🌐 Frontend Deployment (Vercel)

```bash
cd frontend

# Build
npm run build

# Deploy with Vercel CLI
npx vercel --prod

# Set environment variables in Vercel dashboard:
# VITE_API_URL = https://your-backend.railway.app
# VITE_WS_URL  = wss://your-backend.railway.app
```

---

## 🐳 Backend Deployment (Docker Hub + Railway/Render)

```bash
# Build image
cd backend
docker build -t YOUR_DOCKERHUB/geofence-backend:latest .

# Push to Docker Hub
docker push YOUR_DOCKERHUB/geofence-backend:latest

# Deploy on Railway:
# 1. railway new
# 2. Add PostgreSQL plugin
# 3. railway up
```

---

## 🔌 API Testing Guide

### Base URL: `http://localhost:8080`

### 1. Create a Geofence

```bash
curl -X POST http://localhost:8080/geofences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Downtown Restricted Zone",
    "description": "No trucks allowed",
    "coordinates": [
      [37.7749, -122.4194],
      [37.7849, -122.4194],
      [37.7849, -122.4094],
      [37.7749, -122.4094],
      [37.7749, -122.4194]
    ],
    "category": "restricted_zone"
  }'
```

### 2. List Geofences

```bash
curl http://localhost:8080/geofences

# With category filter
curl "http://localhost:8080/geofences?category=restricted_zone"
```

### 3. Register a Vehicle

```bash
curl -X POST http://localhost:8080/vehicles \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_number": "KA-01-AB-1234",
    "driver_name": "John Doe",
    "vehicle_type": "truck",
    "phone": "+1234567890"
  }'
```

### 4. List Vehicles

```bash
curl http://localhost:8080/vehicles
```

### 5. Configure an Alert

```bash
# Use IDs from previous responses
curl -X POST http://localhost:8080/alerts/configure \
  -H "Content-Type: application/json" \
  -d '{
    "geofence_id": "geo_XXXXXXXX",
    "vehicle_id": "veh_XXXXXXXX",
    "event_type": "entry"
  }'

# Alert for ALL vehicles entering a zone
curl -X POST http://localhost:8080/alerts/configure \
  -H "Content-Type: application/json" \
  -d '{
    "geofence_id": "geo_XXXXXXXX",
    "event_type": "both"
  }'
```

### 6. Update Vehicle Location (triggers alerts!)

```bash
curl -X POST http://localhost:8080/vehicles/location \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "veh_XXXXXXXX",
    "latitude": 37.7799,
    "longitude": -122.4144,
    "timestamp": "2025-01-15T10:35:00Z"
  }'
```

### 7. Get Vehicle Current Location

```bash
curl http://localhost:8080/vehicles/location/veh_XXXXXXXX
```

### 8. Get Alert Rules

```bash
curl http://localhost:8080/alerts

# With filters
curl "http://localhost:8080/alerts?geofence_id=geo_XXXXXXXX"
```

### 9. Get Violation History

```bash
curl http://localhost:8080/violations/history

# With filters
curl "http://localhost:8080/violations/history?vehicle_id=veh_XXXXXXXX&limit=100"
curl "http://localhost:8080/violations/history?start_date=2025-01-01T00:00:00Z&end_date=2025-12-31T23:59:59Z"
```

### 10. WebSocket Test

```bash
# Using wscat (npm install -g wscat)
wscat -c ws://localhost:8080/ws/alerts
# You'll see alerts in real-time as you POST location updates
```

---

## 🧪 End-to-End Test Flow

Run this sequence to see the full system work:

```bash
# 1. Create a geofence
GEO_ID=$(curl -s -X POST http://localhost:8080/geofences \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Zone","coordinates":[[37.77,-122.42],[37.78,-122.42],[37.78,-122.41],[37.77,-122.41],[37.77,-122.42]],"category":"restricted_zone"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Geofence: $GEO_ID"

# 2. Register a vehicle
VEH_ID=$(curl -s -X POST http://localhost:8080/vehicles \
  -H "Content-Type: application/json" \
  -d '{"vehicle_number":"TEST-001","driver_name":"Test Driver","vehicle_type":"truck","phone":"+1111111111"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Vehicle: $VEH_ID"

# 3. Configure alert
curl -s -X POST http://localhost:8080/alerts/configure \
  -H "Content-Type: application/json" \
  -d "{\"geofence_id\":\"$GEO_ID\",\"vehicle_id\":\"$VEH_ID\",\"event_type\":\"both\"}"

# 4. Move vehicle INSIDE the geofence (triggers entry alert!)
curl -s -X POST http://localhost:8080/vehicles/location \
  -H "Content-Type: application/json" \
  -d "{\"vehicle_id\":\"$VEH_ID\",\"latitude\":37.775,\"longitude\":-122.415,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

# 5. Check violations
curl http://localhost:8080/violations/history
```

---

## 📁 Project Structure

```
geofence-system/
├── backend/
│   ├── cmd/server/main.go          # Server entrypoint, routes
│   ├── internal/
│   │   ├── handlers/handlers.go    # All HTTP handlers
│   │   ├── models/models.go        # Data models
│   │   ├── db/db.go                # DB connection + migrations
│   │   ├── geospatial/             # Point-in-polygon algorithm
│   │   └── websocket/hub.go        # WebSocket broadcast hub
│   ├── Dockerfile
│   └── go.mod
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Root with sidebar + WS listener
│   │   ├── pages/
│   │   │   ├── GeofencesPage.jsx   # Map + draw + list
│   │   │   ├── VehiclesPage.jsx    # Fleet + location picker
│   │   │   ├── AlertsPage.jsx      # Alert rule CRUD
│   │   │   └── ViolationsPage.jsx  # History + filters
│   │   ├── api/client.js           # Axios API wrappers
│   │   └── hooks/useWebSocket.js   # WS with auto-reconnect
│   ├── Dockerfile
│   └── vite.config.js
└── docker-compose.yml
```

---

## 🔑 Key Design Decisions

1. **No PostGIS required** — Uses pure SQL + Go ray-casting algorithm for point-in-polygon checks. Simpler deployment, no extension needed.
2. **WebSocket Hub** — Single broadcast hub pattern; alerts are sent async so they never block the HTTP response.
3. **State diffing** — `vehicle_geofence_state` table tracks last known inside/outside state per vehicle per geofence, enabling reliable entry/exit event detection.
4. **Auto-reconnecting WebSocket** — Frontend retries connection every 3s on disconnect.
