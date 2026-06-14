import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import toast from 'react-hot-toast'
import { Plus, Truck, MapPin, Navigation } from 'lucide-react'
import { getVehicles, createVehicle, getVehicleLocation, updateVehicleLocation, getGeofences } from '../api/client'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const truckIcon = (color = '#3b82f6') => L.divIcon({
  html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:14px">🚛</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

function LocationPicker({ onPick, picking }) {
  useMapEvents({
    click: (e) => {
      if (picking) onPick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([])
  const [geofences, setGeofences] = useState([])
  const [selected, setSelected] = useState(null)
  const [locationData, setLocationData] = useState({})
  const [picking, setPicking] = useState(false)
  const [pickedCoords, setPickedCoords] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ vehicle_number: '', driver_name: '', vehicle_type: 'truck', phone: '' })

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await getVehicles()
      setVehicles(res.data.vehicles || [])
    } catch {
      toast.error('Failed to load vehicles')
    }
  }, [])

  useEffect(() => { fetchVehicles() }, [fetchVehicles])

  useEffect(() => {
    getGeofences().then(r => setGeofences(r.data.geofences || [])).catch(() => {})
  }, [])

  const handleSelectVehicle = async (v) => {
    setSelected(v)
    setPicking(false)
    setPickedCoords(null)
    try {
      const res = await getVehicleLocation(v.id)
      setLocationData(prev => ({ ...prev, [v.id]: res.data }))
    } catch {}
  }

  const handlePickLocation = (lat, lng) => {
    setPickedCoords([lat, lng])
    setPicking(false)
    toast.success(`Location picked: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  }

  const handleUpdateLocation = async () => {
    if (!selected || !pickedCoords) return
    setLoading(true)
    try {
      const res = await updateVehicleLocation({
        vehicle_id: selected.id,
        latitude: pickedCoords[0],
        longitude: pickedCoords[1],
        timestamp: new Date().toISOString()
      })
      const inside = res.data.current_geofences || []
      setLocationData(prev => ({
        ...prev,
        [selected.id]: { current_location: { latitude: pickedCoords[0], longitude: pickedCoords[1], timestamp: new Date().toISOString() }, current_geofences: inside }
      }))
      if (inside.length > 0) {
        toast.success(`Inside: ${inside.map(g => g.geofence_name).join(', ')}`)
      } else {
        toast.success('Location updated — outside all zones')
      }
      setPickedCoords(null)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update location')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateVehicle = async () => {
    if (!form.vehicle_number || !form.driver_name || !form.phone) {
      return toast.error('All fields are required')
    }
    setLoading(true)
    try {
      await createVehicle(form)
      toast.success('Vehicle registered!')
      setForm({ vehicle_number: '', driver_name: '', vehicle_type: 'truck', phone: '' })
      setShowForm(false)
      fetchVehicles()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to register vehicle')
    } finally {
      setLoading(false)
    }
  }

  const loc = selected ? locationData[selected.id] : null

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Vehicles</div>
          <div className="page-subtitle">{vehicles.length} registered vehicles</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={15} /> Register Vehicle
        </button>
      </div>

      <div className="page-body">
        {/* Left panel */}
        <div className="panel" style={{ width: 280 }}>
          {showForm && (
            <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
              <div className="form">
                <div className="form-group">
                  <label className="form-label">Vehicle Number *</label>
                  <input className="form-input" placeholder="e.g. KA-01-AB-1234"
                    value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Driver Name *</label>
                  <input className="form-input" placeholder="John Doe"
                    value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={form.vehicle_type}
                    onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
                    {['truck', 'car', 'van', 'motorcycle', 'bus'].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input className="form-input" placeholder="+1234567890"
                    value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <button className="btn btn-primary" onClick={handleCreateVehicle} disabled={loading}>
                  {loading ? 'Saving...' : 'Register'}
                </button>
              </div>
            </div>
          )}

          <div className="panel-header">Fleet ({vehicles.length})</div>
          <div className="panel-body">
            {vehicles.length === 0 && (
              <div className="empty">
                <Truck size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                No vehicles yet
              </div>
            )}
            {vehicles.map(v => {
              const vLoc = locationData[v.id]
              return (
                <div key={v.id} className={`card ${selected?.id === v.id ? 'selected' : ''}`}
                  onClick={() => handleSelectVehicle(v)}>
                  <div className="card-title">🚛 {v.vehicle_number}</div>
                  <div className="card-meta">
                    <span>{v.driver_name}</span>
                    <span className="badge badge-active" style={{ marginLeft: 'auto' }}>{v.vehicle_type}</span>
                  </div>
                  {vLoc?.current_location && (
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
                      📍 {vLoc.current_location.latitude.toFixed(4)}, {vLoc.current_location.longitude.toFixed(4)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Location update panel */}
          {selected && (
            <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
              <div className="panel-header" style={{ padding: '0 0 10px', border: 'none' }}>
                Update Location — {selected.vehicle_number}
              </div>
              {loc?.current_geofences?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {loc.current_geofences.map(g => (
                    <div key={g.geofence_id} style={{ fontSize: 11, color: '#4ade80', marginBottom: 2 }}>
                      ✓ Inside {g.geofence_name}
                    </div>
                  ))}
                </div>
              )}
              {pickedCoords && (
                <div className="coords-info" style={{ marginBottom: 10 }}>
                  New: {pickedCoords[0].toFixed(4)}, {pickedCoords[1].toFixed(4)}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }}
                  onClick={() => setPicking(!picking)}>
                  <MapPin size={13} /> {picking ? 'Cancel' : 'Pick on Map'}
                </button>
                {pickedCoords && (
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }}
                    onClick={handleUpdateLocation} disabled={loading}>
                    <Navigation size={13} /> {loading ? '...' : 'Update'}
                  </button>
                )}
              </div>
              {picking && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
                  👆 Click on the map to set location
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="map-container">
          <MapContainer
            center={[37.7749, -122.4194]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; CARTO'
            />

            <LocationPicker picking={picking} onPick={handlePickLocation} />

            {vehicles.map(v => {
              const vLoc = locationData[v.id]
              if (!vLoc?.current_location) return null
              const { latitude, longitude } = vLoc.current_location
              return (
                <Marker key={v.id} position={[latitude, longitude]}
                  icon={truckIcon(selected?.id === v.id ? '#22c55e' : '#3b82f6')}>
                  <Popup>
                    <div style={{ fontFamily: 'var(--font)', fontSize: 13 }}>
                      <strong>{v.vehicle_number}</strong><br />
                      {v.driver_name}<br />
                      <span style={{ fontSize: 11, color: '#64748b' }}>{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
                    </div>
                  </Popup>
                </Marker>
              )
            })}

            {pickedCoords && (
              <Marker position={pickedCoords} icon={truckIcon('#f59e0b')}>
                <Popup>New location for {selected?.vehicle_number}</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}
