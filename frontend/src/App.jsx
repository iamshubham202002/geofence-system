import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import { useState, useCallback } from 'react'
import { Map, Truck, Bell, History, Settings, Radio } from 'lucide-react'
import { useWebSocket } from './hooks/useWebSocket'
import GeofencesPage from './pages/GeofencesPage'
import VehiclesPage from './pages/VehiclesPage'
import AlertsPage from './pages/AlertsPage'
import ViolationsPage from './pages/ViolationsPage'
import './App.css'

export default function App() {
  const [liveAlerts, setLiveAlerts] = useState([])

  const handleAlert = useCallback((alert) => {
    setLiveAlerts(prev => [alert, ...prev].slice(0, 50))
    const emoji = alert.event_type === 'entry' ? '🚨' : '🚪'
    const color = alert.geofence.category === 'restricted_zone' ? '#ef4444' : '#f59e0b'
    toast.custom((t) => (
      <div
        style={{
          background: '#1e293b',
          border: `1px solid ${color}`,
          borderLeft: `4px solid ${color}`,
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#f1f5f9',
          maxWidth: '360px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)'
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
          {emoji} {alert.event_type.toUpperCase()} — {alert.geofence.geofence_name}
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          {alert.vehicle.vehicle_number} · {alert.vehicle.driver_name}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
          {new Date(alert.timestamp).toLocaleTimeString()}
        </div>
      </div>
    ), { duration: 6000 })
  }, [])

  const { connected } = useWebSocket(handleAlert)

  return (
    <BrowserRouter>
      <div className="app">
        <aside className="sidebar">
          <div className="logo">
            <Radio size={24} />
            <span>GeoFleet</span>
          </div>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Map size={18} /> Geofences
            </NavLink>
            <NavLink to="/vehicles" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Truck size={18} /> Vehicles
            </NavLink>
            <NavLink to="/alerts" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Bell size={18} /> Alert Rules
            </NavLink>
            <NavLink to="/violations" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <History size={18} /> Violations
            </NavLink>
          </nav>
          <div className="ws-status">
            <div className={`ws-dot ${connected ? 'connected' : 'disconnected'}`} />
            <span>{connected ? 'Live' : 'Reconnecting...'}</span>
          </div>
          {liveAlerts.length > 0 && (
            <div className="alert-feed">
              <div className="alert-feed-title">Recent Alerts</div>
              {liveAlerts.slice(0, 5).map((a) => (
                <div key={a.event_id} className={`alert-item ${a.event_type}`}>
                  <span className="alert-type">{a.event_type}</span>
                  <span className="alert-name">{a.geofence.geofence_name}</span>
                  <span className="alert-vehicle">{a.vehicle.vehicle_number}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<GeofencesPage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/violations" element={<ViolationsPage />} />
          </Routes>
        </main>
      </div>
      <Toaster position="top-right" />
    </BrowserRouter>
  )
}
