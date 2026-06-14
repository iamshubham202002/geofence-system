package models

import "time"

// Geofence represents a virtual boundary
type Geofence struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Coordinates [][]float64 `json:"coordinates"`
	Category    string      `json:"category"`
	Status      string      `json:"status"`
	CreatedAt   time.Time   `json:"created_at"`
}

// Vehicle represents a tracked vehicle
type Vehicle struct {
	ID            string    `json:"id"`
	VehicleNumber string    `json:"vehicle_number"`
	DriverName    string    `json:"driver_name"`
	VehicleType   string    `json:"vehicle_type"`
	Phone         string    `json:"phone"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

// VehicleLocation represents a location update
type VehicleLocation struct {
	VehicleID string    `json:"vehicle_id"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Timestamp time.Time `json:"timestamp"`
}

// GeofenceStatus represents a vehicle's status relative to a geofence
type GeofenceStatus struct {
	GeofenceID   string `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	Status       string `json:"status,omitempty"`
	Category     string `json:"category,omitempty"`
}

// AlertConfig represents an alert rule
type AlertConfig struct {
	AlertID     string    `json:"alert_id"`
	GeofenceID  string    `json:"geofence_id"`
	GeofenceName string   `json:"geofence_name,omitempty"`
	VehicleID   string    `json:"vehicle_id"`
	VehicleNumber string  `json:"vehicle_number,omitempty"`
	EventType   string    `json:"event_type"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

// Violation represents a geofence entry/exit event
type Violation struct {
	ID           string    `json:"id"`
	VehicleID    string    `json:"vehicle_id"`
	VehicleNumber string   `json:"vehicle_number"`
	GeofenceID   string    `json:"geofence_id"`
	GeofenceName string    `json:"geofence_name"`
	EventType    string    `json:"event_type"`
	Latitude     float64   `json:"latitude"`
	Longitude    float64   `json:"longitude"`
	Timestamp    time.Time `json:"timestamp"`
}

// WSAlert is the real-time alert sent over WebSocket
type WSAlert struct {
	EventID   string         `json:"event_id"`
	EventType string         `json:"event_type"`
	Timestamp time.Time      `json:"timestamp"`
	Vehicle   WSVehicle      `json:"vehicle"`
	Geofence  WSGeofence     `json:"geofence"`
	Location  WSLocation     `json:"location"`
}

type WSVehicle struct {
	VehicleID     string `json:"vehicle_id"`
	VehicleNumber string `json:"vehicle_number"`
	DriverName    string `json:"driver_name"`
}

type WSGeofence struct {
	GeofenceID   string `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	Category     string `json:"category"`
}

type WSLocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}
