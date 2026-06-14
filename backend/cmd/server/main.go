package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/geofence-system/backend/internal/db"
	"github.com/geofence-system/backend/internal/handlers"
	ws "github.com/geofence-system/backend/internal/websocket"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func main() {
	// Connect to DB
	if err := db.Connect(); err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}

	// Run migrations
	if err := db.Migrate(); err != nil {
		log.Fatalf("Database migration failed: %v", err)
	}

	// Start WebSocket hub
	go ws.GlobalHub.Run()

	// Setup router
	r := mux.NewRouter()

	// Health check
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","service":"geofence-api"}`)
	}).Methods("GET")

	// API routes
	r.HandleFunc("/geofences", handlers.CreateGeofence).Methods("POST")
	r.HandleFunc("/geofences", handlers.GetGeofences).Methods("GET")
	r.HandleFunc("/vehicles", handlers.CreateVehicle).Methods("POST")
	r.HandleFunc("/vehicles", handlers.GetVehicles).Methods("GET")
	r.HandleFunc("/vehicles/location", handlers.UpdateVehicleLocation).Methods("POST")
	r.HandleFunc("/vehicles/location/{vehicle_id}", handlers.GetVehicleLocation).Methods("GET")
	r.HandleFunc("/alerts/configure", handlers.ConfigureAlert).Methods("POST")
	r.HandleFunc("/alerts", handlers.GetAlerts).Methods("GET")
	r.HandleFunc("/violations/history", handlers.GetViolationHistory).Methods("GET")

	// WebSocket
	r.HandleFunc("/ws/alerts", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(ws.GlobalHub, w, r)
	})

	// CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	handler := c.Handler(r)
	log.Printf("🚀 Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
