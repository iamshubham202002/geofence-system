import { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Polygon, useMapEvents, Marker } from 'react-leaflet'
import L from 'leaflet'
import toast from 'react-hot-toast'
import { Plus, Trash2, MapPin } from 'lucide-react'
import { getGeofences, createGeofence } from '../api/client'

// Fix leaflet icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CATEGORY_COLORS = {
  delivery_zone: '#22c55e',
  restricted_zone: '#ef4444',
  toll_zone: '#f59e0b',
  customer_area: '#8b5cf6',
}

function DrawingLayer({ drawing, onAddPoint, points }) {
  useMapEvents({
    click: (e) => {
      if (drawing) onAddPoint([e.latlng.lat, e.latlng.lng])
    }
  })

  return points.length > 0 ? (
    <>
      {points.map((p, i) => (
        <Marker key={i} position={p}>
        </Marker>
      ))}
      {points.length > 1 && (
        <Polygon
          positions={points}
          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, dashArray: '6,4' }}
        />
      )}
    </>
  ) : null
}

export default function GeofencesPage() {
  const [geofences, setGeofences] = useState([])
  const [selected, setSelected] = useState(null)
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterCat, setFilterCat] = useState('')
  const [form, setForm] = useState({ name: '', description: '', category: 'delivery_zone' })

  const fetchGeofences = useCallback(async () => {
    try {
      const res = await getGeofences(filterCat)
      setGeofences(res.data.geofences || [])
    } catch {
      toast.error('Failed to load geofences')
    }
  }, [filterCat])

  useEffect(() => { fetchGeofences() }, [fetchGeofences])

  const handleAddPoint = useCallback((point) => {
    setPoints(prev => [...prev, point])
  }, [])

  const handleClearPoints = () => setPoints([])

  const handleSubmit = async () => {
    if (!form.name) return toast.error('Name is required')
    if (points.length < 3) return toast.error('Draw at least 3 points on the map')

    const coordinates = [...points.map(p => [p[0], p[1]]), [points[0][0], points[0][1]]]

    setLoading(true)
    try {
      await createGeofence({ ...form, coordinates })
      toast.success('Geofence created!')
      setForm({ name: '', description: '', category: 'delivery_zone' })
      setPoints([])
      setDrawing(false)
      fetchGeofences()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to create geofence')
    } finally {
      setLoading(false)
    }
  }

  const badgeClass = (cat) => ({
    delivery_zone: 'badge badge-delivery',
    restricted_zone: 'badge badge-restricted',
    toll_zone: 'badge badge-toll',
    customer_area: 'badge badge-customer',
  }[cat] || 'badge')

  const catLabel = (cat) => cat?.replace('_', ' ') || cat

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Geofences</div>
          <div className="page-subtitle">{geofences.length} zones configured</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setDrawing(!drawing); setPoints([]) }}>
          {drawing ? '✕ Cancel Drawing' : <><Plus size={15} /> Draw Geofence</>}
        </button>
      </div>

      <div className="filter-bar">
        {['', 'delivery_zone', 'restricted_zone', 'toll_zone', 'customer_area'].map(c => (
          <button
            key={c}
            className={`btn btn-sm ${filterCat === c ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterCat(c)}
          >
            {c ? catLabel(c) : 'All'}
          </button>
        ))}
      </div>

      <div className="page-body">
        {/* Left panel - list + form */}
        <div className="panel" style={{ width: 280 }}>
          {drawing && (
            <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
              <div className="form">
                <div className="form-group">
                  <label className="form-label">Zone Name *</label>
                  <input className="form-input" placeholder="e.g. Downtown Zone" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select className="form-select" value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="delivery_zone">Delivery Zone</option>
                    <option value="restricted_zone">Restricted Zone</option>
                    <option value="toll_zone">Toll Zone</option>
                    <option value="customer_area">Customer Area</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" placeholder="Optional description" value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                {points.length > 0 && (
                  <div className="coords-info">
                    📍 {points.length} point{points.length !== 1 ? 's' : ''} placed
                    {points.length >= 3 ? ' — ready to save' : ` — need ${3 - points.length} more`}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit}
                    disabled={loading || points.length < 3}>
                    {loading ? 'Saving...' : 'Save Zone'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleClearPoints}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 10, padding: '8px', background: 'rgba(59,130,246,0.08)', borderRadius: 6, fontSize: 11, color: 'var(--text-3)' }}>
                👆 Click on the map to place points
              </div>
            </div>
          )}

          <div className="panel-header">Zones ({geofences.length})</div>
          <div className="panel-body">
            {geofences.length === 0 && (
              <div className="empty">
                <MapPin size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                No geofences yet
              </div>
            )}
            {geofences.map(g => (
              <div key={g.id} className={`card ${selected?.id === g.id ? 'selected' : ''}`}
                onClick={() => setSelected(g)}>
                <div className="card-title">{g.name}</div>
                <div className="card-meta">
                  <span className={badgeClass(g.category)}>{catLabel(g.category)}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10 }}>{g.coordinates?.length - 1} pts</span>
                </div>
                {g.description && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{g.description}</div>
                )}
              </div>
            ))}
          </div>
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
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />

            {geofences.map(g => (
              <Polygon
                key={g.id}
                positions={g.coordinates || []}
                pathOptions={{
                  color: CATEGORY_COLORS[g.category] || '#3b82f6',
                  fillColor: CATEGORY_COLORS[g.category] || '#3b82f6',
                  fillOpacity: selected?.id === g.id ? 0.35 : 0.15,
                  weight: selected?.id === g.id ? 2.5 : 1.5,
                }}
                eventHandlers={{ click: () => setSelected(g) }}
              >
              </Polygon>
            ))}

            <DrawingLayer drawing={drawing} onAddPoint={handleAddPoint} points={points} />
          </MapContainer>

          {selected && !drawing && (
            <div style={{
              position: 'absolute', bottom: 20, left: 20, zIndex: 1000,
              background: 'var(--bg-1)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '12px 16px', minWidth: 220,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{selected.name}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={badgeClass(selected.category)}>{catLabel(selected.category)}</span>
                <span className="badge badge-active">active</span>
              </div>
              {selected.description && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>{selected.description}</div>
              )}
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
                ID: {selected.id}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
