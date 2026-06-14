import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
})

// Geofences
export const getGeofences = (category) =>
  api.get('/geofences', { params: category ? { category } : {} })

export const createGeofence = (data) => api.post('/geofences', data)

// Vehicles
export const getVehicles = () => api.get('/vehicles')
export const createVehicle = (data) => api.post('/vehicles', data)
export const getVehicleLocation = (id) => api.get(`/vehicles/location/${id}`)
export const updateVehicleLocation = (data) => api.post('/vehicles/location', data)

// Alerts
export const getAlerts = (params) => api.get('/alerts', { params })
export const configureAlert = (data) => api.post('/alerts/configure', data)

// Violations
export const getViolations = (params) => api.get('/violations/history', { params })

export const WS_URL = (import.meta.env.VITE_WS_URL || 'ws://localhost:8080') + '/ws/alerts'
