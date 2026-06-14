package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/geofence-system/backend/internal/db"
	"github.com/geofence-system/backend/internal/geospatial"
	"github.com/geofence-system/backend/internal/models"
	ws "github.com/geofence-system/backend/internal/websocket"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

func generateID(prefix string) string {
	return prefix + "_" + uuid.New().String()[:8]
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// ========== GEOFENCES ==========

func CreateGeofence(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req struct {
		Name        string      `json:"name"`
		Description string      `json:"description"`
		Coordinates [][]float64 `json:"coordinates"`
		Category    string      `json:"category"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	validCategories := map[string]bool{"delivery_zone": true, "restricted_zone": true, "toll_zone": true, "customer_area": true}
	if !validCategories[req.Category] {
		writeError(w, http.StatusBadRequest, "category must be one of: delivery_zone, restricted_zone, toll_zone, customer_area")
		return
	}
	if len(req.Coordinates) < 4 {
		writeError(w, http.StatusBadRequest, "coordinates must have at least 4 points (3 unique + closing point)")
		return
	}
	first := req.Coordinates[0]
	last := req.Coordinates[len(req.Coordinates)-1]
	if first[0] != last[0] || first[1] != last[1] {
		writeError(w, http.StatusBadRequest, "first and last coordinates must be identical (closed polygon)")
		return
	}
	for _, coord := range req.Coordinates {
		if len(coord) != 2 {
			writeError(w, http.StatusBadRequest, "each coordinate must be [latitude, longitude]")
			return
		}
		if coord[0] < -90 || coord[0] > 90 {
			writeError(w, http.StatusBadRequest, "latitude must be between -90 and 90")
			return
		}
		if coord[1] < -180 || coord[1] > 180 {
			writeError(w, http.StatusBadRequest, "longitude must be between -180 and 180")
			return
		}
	}

	coordJSON, _ := json.Marshal(req.Coordinates)
	id := generateID("geo")

	_, err := db.DB.Exec(
		`INSERT INTO geofences (id, name, description, coordinates, category, status) VALUES ($1, $2, $3, $4, $5, 'active')`,
		id, req.Name, req.Description, string(coordJSON), req.Category,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create geofence: "+err.Error())
		return
	}

	elapsed := time.Since(start).Nanoseconds()
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":      id,
		"name":    req.Name,
		"status":  "active",
		"time_ns": strconv.FormatInt(elapsed, 10),
	})
}

func GetGeofences(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	category := r.URL.Query().Get("category")
	query := `SELECT id, name, description, coordinates, category, status, created_at FROM geofences WHERE 1=1`
	args := []interface{}{}

	if category != "" {
		query += " AND category = $1"
		args = append(args, category)
	}
	query += " ORDER BY created_at DESC"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch geofences")
		return
	}
	defer rows.Close()

	geofences := []models.Geofence{}
	for rows.Next() {
		var g models.Geofence
		var coordJSON string
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &coordJSON, &g.Category, &g.Status, &g.CreatedAt); err != nil {
			continue
		}
		json.Unmarshal([]byte(coordJSON), &g.Coordinates)
		geofences = append(geofences, g)
	}

	elapsed := time.Since(start).Nanoseconds()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"geofences": geofences,
		"time_ns":   strconv.FormatInt(elapsed, 10),
	})
}

// ========== VEHICLES ==========

func CreateVehicle(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req struct {
		VehicleNumber string `json:"vehicle_number"`
		DriverName    string `json:"driver_name"`
		VehicleType   string `json:"vehicle_type"`
		Phone         string `json:"phone"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.VehicleNumber == "" || req.DriverName == "" || req.VehicleType == "" || req.Phone == "" {
		writeError(w, http.StatusBadRequest, "vehicle_number, driver_name, vehicle_type, and phone are required")
		return
	}

	id := generateID("veh")
	_, err := db.DB.Exec(
		`INSERT INTO vehicles (id, vehicle_number, driver_name, vehicle_type, phone, status) VALUES ($1, $2, $3, $4, $5, 'active')`,
		id, req.VehicleNumber, req.DriverName, req.VehicleType, req.Phone,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create vehicle (vehicle_number may already exist)")
		return
	}

	elapsed := time.Since(start).Nanoseconds()
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":             id,
		"vehicle_number": req.VehicleNumber,
		"status":         "active",
		"time_ns":        strconv.FormatInt(elapsed, 10),
	})
}

func GetVehicles(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	rows, err := db.DB.Query(
		`SELECT id, vehicle_number, driver_name, vehicle_type, phone, status, created_at FROM vehicles ORDER BY created_at DESC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch vehicles")
		return
	}
	defer rows.Close()

	vehicles := []models.Vehicle{}
	for rows.Next() {
		var v models.Vehicle
		if err := rows.Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.Phone, &v.Status, &v.CreatedAt); err != nil {
			continue
		}
		vehicles = append(vehicles, v)
	}

	elapsed := time.Since(start).Nanoseconds()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"vehicles": vehicles,
		"time_ns":  strconv.FormatInt(elapsed, 10),
	})
}

// ========== LOCATION ==========

func UpdateVehicleLocation(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req struct {
		VehicleID string    `json:"vehicle_id"`
		Latitude  float64   `json:"latitude"`
		Longitude float64   `json:"longitude"`
		Timestamp time.Time `json:"timestamp"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.VehicleID == "" {
		writeError(w, http.StatusBadRequest, "vehicle_id is required")
		return
	}
	if req.Latitude < -90 || req.Latitude > 90 {
		writeError(w, http.StatusBadRequest, "latitude must be between -90 and 90")
		return
	}
	if req.Longitude < -180 || req.Longitude > 180 {
		writeError(w, http.StatusBadRequest, "longitude must be between -180 and 180")
		return
	}
	if req.Timestamp.IsZero() {
		req.Timestamp = time.Now()
	}

	// Verify vehicle exists
	var vehicle models.Vehicle
	err := db.DB.QueryRow(
		`SELECT id, vehicle_number, driver_name FROM vehicles WHERE id = $1`, req.VehicleID,
	).Scan(&vehicle.ID, &vehicle.VehicleNumber, &vehicle.DriverName)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Vehicle not found")
		return
	}

	// Store location
	_, err = db.DB.Exec(
		`INSERT INTO vehicle_locations (vehicle_id, latitude, longitude, timestamp) VALUES ($1, $2, $3, $4)`,
		req.VehicleID, req.Latitude, req.Longitude, req.Timestamp,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to store location")
		return
	}

	// Get all geofences
	rows, err := db.DB.Query(`SELECT id, name, coordinates, category FROM geofences WHERE status = 'active'`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch geofences")
		return
	}
	defer rows.Close()

	type geofenceRow struct {
		id          string
		name        string
		coordinates [][]float64
		category    string
	}

	var allGeofences []geofenceRow
	for rows.Next() {
		var gf geofenceRow
		var coordJSON string
		if err := rows.Scan(&gf.id, &gf.name, &coordJSON, &gf.category); err != nil {
			continue
		}
		json.Unmarshal([]byte(coordJSON), &gf.coordinates)
		allGeofences = append(allGeofences, gf)
	}

	var currentGeofences []models.GeofenceStatus

	for _, gf := range allGeofences {
		isNowInside := geospatial.IsPointInPolygon(req.Latitude, req.Longitude, gf.coordinates)

		// Get previous state
		var wasInside bool
		err := db.DB.QueryRow(
			`SELECT is_inside FROM vehicle_geofence_state WHERE vehicle_id = $1 AND geofence_id = $2`,
			req.VehicleID, gf.id,
		).Scan(&wasInside)
		isNew := err == sql.ErrNoRows

		// Upsert state
		db.DB.Exec(
			`INSERT INTO vehicle_geofence_state (vehicle_id, geofence_id, is_inside, updated_at) 
			 VALUES ($1, $2, $3, NOW())
			 ON CONFLICT (vehicle_id, geofence_id) DO UPDATE SET is_inside = $3, updated_at = NOW()`,
			req.VehicleID, gf.id, isNowInside,
		)

		// Detect entry/exit events
		var eventType string
		if isNowInside && (isNew || !wasInside) {
			eventType = "entry"
		} else if !isNowInside && !isNew && wasInside {
			eventType = "exit"
		}

		if eventType != "" {
			// Record violation
			violationID := generateID("viol")
			db.DB.Exec(
				`INSERT INTO violations (id, vehicle_id, geofence_id, event_type, latitude, longitude, timestamp)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				violationID, req.VehicleID, gf.id, eventType, req.Latitude, req.Longitude, req.Timestamp,
			)

			// Check for matching alert configs
			alertRows, err := db.DB.Query(
				`SELECT alert_id FROM alert_configs 
				 WHERE geofence_id = $1 
				 AND (vehicle_id = $2 OR vehicle_id IS NULL OR vehicle_id = '')
				 AND (event_type = $3 OR event_type = 'both')
				 AND status = 'active'`,
				gf.id, req.VehicleID, eventType,
			)
			if err == nil {
				defer alertRows.Close()
				hasAlert := alertRows.Next()
				alertRows.Close()

				if hasAlert {
					alert := models.WSAlert{
						EventID:   generateID("evt"),
						EventType: eventType,
						Timestamp: req.Timestamp,
						Vehicle: models.WSVehicle{
							VehicleID:     vehicle.ID,
							VehicleNumber: vehicle.VehicleNumber,
							DriverName:    vehicle.DriverName,
						},
						Geofence: models.WSGeofence{
							GeofenceID:   gf.id,
							GeofenceName: gf.name,
							Category:     gf.category,
						},
						Location: models.WSLocation{
							Latitude:  req.Latitude,
							Longitude: req.Longitude,
						},
					}
					go ws.GlobalHub.BroadcastAlert(alert)
				}
			}
		}

		if isNowInside {
			currentGeofences = append(currentGeofences, models.GeofenceStatus{
				GeofenceID:   gf.id,
				GeofenceName: gf.name,
				Status:       "inside",
			})
		}
	}

	if currentGeofences == nil {
		currentGeofences = []models.GeofenceStatus{}
	}

	elapsed := time.Since(start).Nanoseconds()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"vehicle_id":        req.VehicleID,
		"location_updated":  true,
		"current_geofences": currentGeofences,
		"time_ns":           strconv.FormatInt(elapsed, 10),
	})
}

func GetVehicleLocation(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	vars := mux.Vars(r)
	vehicleID := vars["vehicle_id"]

	var vehicle models.Vehicle
	err := db.DB.QueryRow(
		`SELECT id, vehicle_number, driver_name, vehicle_type, phone, status FROM vehicles WHERE id = $1`, vehicleID,
	).Scan(&vehicle.ID, &vehicle.VehicleNumber, &vehicle.DriverName, &vehicle.VehicleType, &vehicle.Phone, &vehicle.Status)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Vehicle not found")
		return
	}

	var loc models.VehicleLocation
	var hasLocation bool
	err = db.DB.QueryRow(
		`SELECT vehicle_id, latitude, longitude, timestamp FROM vehicle_locations 
		 WHERE vehicle_id = $1 ORDER BY timestamp DESC LIMIT 1`, vehicleID,
	).Scan(&loc.VehicleID, &loc.Latitude, &loc.Longitude, &loc.Timestamp)
	if err == nil {
		hasLocation = true
	}

	// Get current geofences
	rows, err := db.DB.Query(
		`SELECT g.id, g.name, g.category FROM geofences g
		 JOIN vehicle_geofence_state vgs ON g.id = vgs.geofence_id
		 WHERE vgs.vehicle_id = $1 AND vgs.is_inside = true`, vehicleID,
	)
	currentGeofences := []models.GeofenceStatus{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var gs models.GeofenceStatus
			rows.Scan(&gs.GeofenceID, &gs.GeofenceName, &gs.Category)
			currentGeofences = append(currentGeofences, gs)
		}
	}

	elapsed := time.Since(start).Nanoseconds()

	resp := map[string]interface{}{
		"vehicle_id":        vehicle.ID,
		"vehicle_number":    vehicle.VehicleNumber,
		"current_geofences": currentGeofences,
		"time_ns":           strconv.FormatInt(elapsed, 10),
	}

	if hasLocation {
		resp["current_location"] = map[string]interface{}{
			"latitude":  loc.Latitude,
			"longitude": loc.Longitude,
			"timestamp": loc.Timestamp,
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

// ========== ALERTS ==========

func ConfigureAlert(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req struct {
		GeofenceID string `json:"geofence_id"`
		VehicleID  string `json:"vehicle_id"`
		EventType  string `json:"event_type"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.GeofenceID == "" {
		writeError(w, http.StatusBadRequest, "geofence_id is required")
		return
	}
	validEvents := map[string]bool{"entry": true, "exit": true, "both": true}
	if !validEvents[req.EventType] {
		writeError(w, http.StatusBadRequest, "event_type must be one of: entry, exit, both")
		return
	}

	// Verify geofence exists
	var count int
	db.DB.QueryRow(`SELECT COUNT(*) FROM geofences WHERE id = $1`, req.GeofenceID).Scan(&count)
	if count == 0 {
		writeError(w, http.StatusNotFound, "Geofence not found")
		return
	}

	// Verify vehicle if provided
	if req.VehicleID != "" {
		db.DB.QueryRow(`SELECT COUNT(*) FROM vehicles WHERE id = $1`, req.VehicleID).Scan(&count)
		if count == 0 {
			writeError(w, http.StatusNotFound, "Vehicle not found")
			return
		}
	}

	alertID := generateID("alert")
	vehicleID := sql.NullString{String: req.VehicleID, Valid: req.VehicleID != ""}

	_, err := db.DB.Exec(
		`INSERT INTO alert_configs (alert_id, geofence_id, vehicle_id, event_type, status) VALUES ($1, $2, $3, $4, 'active')`,
		alertID, req.GeofenceID, vehicleID, req.EventType,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to configure alert: "+err.Error())
		return
	}

	elapsed := time.Since(start).Nanoseconds()
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"alert_id":   alertID,
		"geofence_id": req.GeofenceID,
		"vehicle_id":  req.VehicleID,
		"event_type":  req.EventType,
		"status":     "active",
		"time_ns":    strconv.FormatInt(elapsed, 10),
	})
}

func GetAlerts(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	geofenceID := r.URL.Query().Get("geofence_id")
	vehicleID := r.URL.Query().Get("vehicle_id")

	query := `
		SELECT ac.alert_id, ac.geofence_id, g.name, 
		       COALESCE(ac.vehicle_id, ''), COALESCE(v.vehicle_number, ''),
		       ac.event_type, ac.status, ac.created_at
		FROM alert_configs ac
		JOIN geofences g ON ac.geofence_id = g.id
		LEFT JOIN vehicles v ON ac.vehicle_id = v.id
		WHERE 1=1`
	args := []interface{}{}
	idx := 1

	if geofenceID != "" {
		query += fmt.Sprintf(" AND ac.geofence_id = $%d", idx)
		args = append(args, geofenceID)
		idx++
	}
	if vehicleID != "" {
		query += fmt.Sprintf(" AND ac.vehicle_id = $%d", idx)
		args = append(args, vehicleID)
		idx++
	}
	query += " ORDER BY ac.created_at DESC"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch alerts")
		return
	}
	defer rows.Close()

	alerts := []models.AlertConfig{}
	for rows.Next() {
		var a models.AlertConfig
		if err := rows.Scan(&a.AlertID, &a.GeofenceID, &a.GeofenceName, &a.VehicleID, &a.VehicleNumber, &a.EventType, &a.Status, &a.CreatedAt); err != nil {
			continue
		}
		alerts = append(alerts, a)
	}

	elapsed := time.Since(start).Nanoseconds()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"alerts":  alerts,
		"time_ns": strconv.FormatInt(elapsed, 10),
	})
}

// ========== VIOLATIONS ==========

func GetViolationHistory(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	q := r.URL.Query()
	vehicleID := q.Get("vehicle_id")
	geofenceID := q.Get("geofence_id")
	startDate := q.Get("start_date")
	endDate := q.Get("end_date")
	limitStr := q.Get("limit")

	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			if l > 500 {
				l = 500
			}
			limit = l
		}
	}

	query := `
		SELECT viol.id, viol.vehicle_id, v.vehicle_number, viol.geofence_id, g.name,
		       viol.event_type, viol.latitude, viol.longitude, viol.timestamp
		FROM violations viol
		JOIN vehicles v ON viol.vehicle_id = v.id
		JOIN geofences g ON viol.geofence_id = g.id
		WHERE 1=1`
	args := []interface{}{}
	idx := 1

	if vehicleID != "" {
		query += fmt.Sprintf(" AND viol.vehicle_id = $%d", idx)
		args = append(args, vehicleID)
		idx++
	}
	if geofenceID != "" {
		query += fmt.Sprintf(" AND viol.geofence_id = $%d", idx)
		args = append(args, geofenceID)
		idx++
	}
	if startDate != "" {
		query += fmt.Sprintf(" AND viol.timestamp >= $%d", idx)
		args = append(args, startDate)
		idx++
	}
	if endDate != "" {
		query += fmt.Sprintf(" AND viol.timestamp <= $%d", idx)
		args = append(args, endDate)
		idx++
	}
	query += fmt.Sprintf(" ORDER BY viol.timestamp DESC LIMIT $%d", idx)
	args = append(args, limit)

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch violations")
		return
	}
	defer rows.Close()

	violations := []models.Violation{}
	for rows.Next() {
		var viol models.Violation
		if err := rows.Scan(&viol.ID, &viol.VehicleID, &viol.VehicleNumber, &viol.GeofenceID, &viol.GeofenceName,
			&viol.EventType, &viol.Latitude, &viol.Longitude, &viol.Timestamp); err != nil {
			continue
		}
		violations = append(violations, viol)
	}

	// Get total count
	countQuery := `SELECT COUNT(*) FROM violations viol WHERE 1=1`
	countArgs := args[:len(args)-1] // remove limit
	if vehicleID != "" {
		countQuery += fmt.Sprintf(" AND viol.vehicle_id = $1")
	}
	var totalCount int
	db.DB.QueryRow(countQuery, countArgs...).Scan(&totalCount)

	elapsed := time.Since(start).Nanoseconds()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"violations":  violations,
		"total_count": totalCount,
		"time_ns":     strconv.FormatInt(elapsed, 10),
	})
}
