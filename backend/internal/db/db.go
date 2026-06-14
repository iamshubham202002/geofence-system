package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func Connect() error {
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "postgres")
	password := getEnv("DB_PASSWORD", "postgres")
	dbname := getEnv("DB_NAME", "geofence_db")

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)

	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("failed to open db: %w", err)
	}

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping db: %w", err)
	}

	log.Println("Connected to PostgreSQL")
	return nil
}

func Migrate() error {
	queries := []string{
		`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,
		`CREATE TABLE IF NOT EXISTS geofences (
			id VARCHAR(50) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			coordinates JSONB NOT NULL,
			category VARCHAR(50) NOT NULL,
			status VARCHAR(20) DEFAULT 'active',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS vehicles (
			id VARCHAR(50) PRIMARY KEY,
			vehicle_number VARCHAR(100) UNIQUE NOT NULL,
			driver_name VARCHAR(255) NOT NULL,
			vehicle_type VARCHAR(50) NOT NULL,
			phone VARCHAR(50) NOT NULL,
			status VARCHAR(20) DEFAULT 'active',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS vehicle_locations (
			id SERIAL PRIMARY KEY,
			vehicle_id VARCHAR(50) NOT NULL REFERENCES vehicles(id),
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS vehicle_geofence_state (
			vehicle_id VARCHAR(50) NOT NULL REFERENCES vehicles(id),
			geofence_id VARCHAR(50) NOT NULL REFERENCES geofences(id),
			is_inside BOOLEAN DEFAULT FALSE,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			PRIMARY KEY (vehicle_id, geofence_id)
		)`,
		`CREATE TABLE IF NOT EXISTS alert_configs (
			alert_id VARCHAR(50) PRIMARY KEY,
			geofence_id VARCHAR(50) NOT NULL REFERENCES geofences(id),
			vehicle_id VARCHAR(50),
			event_type VARCHAR(20) NOT NULL,
			status VARCHAR(20) DEFAULT 'active',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS violations (
			id VARCHAR(50) PRIMARY KEY,
			vehicle_id VARCHAR(50) NOT NULL REFERENCES vehicles(id),
			geofence_id VARCHAR(50) NOT NULL REFERENCES geofences(id),
			event_type VARCHAR(20) NOT NULL,
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_id ON vehicle_locations(vehicle_id)`,
		`CREATE INDEX IF NOT EXISTS idx_violations_vehicle_id ON violations(vehicle_id)`,
		`CREATE INDEX IF NOT EXISTS idx_violations_geofence_id ON violations(geofence_id)`,
		`CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations(timestamp)`,
	}

	for _, q := range queries {
		if _, err := DB.Exec(q); err != nil {
			return fmt.Errorf("migration failed: %w\nQuery: %s", err, q)
		}
	}

	log.Println("Database migrations completed")
	return nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
