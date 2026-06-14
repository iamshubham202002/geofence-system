import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Plus, Bell, Shield } from 'lucide-react'
import { getAlerts, configureAlert, getGeofences, getVehicles } from '../api/client'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([])
  const [geofences, setGeofences] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filterGeo, setFilterGeo] = useState('')
  const [filterVeh, setFilterVeh] = useState('')
  const [form, setForm] = useState({ geofence_id: '', vehicle_id: '', event_type: 'entry' })

  const fetchAll = useCallback(async () => {
    try {
      const params = {}
      if (filterGeo) params.geofence_id = filterGeo
      if (filterVeh) params.vehicle_id = filterVeh
      const [alertsRes, geoRes, vehRes] = await Promise.all([
        getAlerts(params),
        getGeofences(),
        getVehicles()
      ])
      setAlerts(alertsRes.data.alerts || [])
      setGeofences(geoRes.data.geofences || [])
      setVehicles(vehRes.data.vehicles || [])
    } catch {
      toast.error('Failed to load data')
    }
  }, [filterGeo, filterVeh])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSubmit = async () => {
    if (!form.geofence_id) return toast.error('Select a geofence')
    if (!form.event_type) return toast.error('Select event type')
    setLoading(true)
    try {
      await configureAlert(form)
      toast.success('Alert rule created!')
      setForm({ geofence_id: '', vehicle_id: '', event_type: 'entry' })
      setShowForm(false)
      fetchAll()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to create alert')
    } finally {
      setLoading(false)
    }
  }

  const eventBadge = (type) => {
    const cls = { entry: 'badge badge-entry', exit: 'badge badge-exit', both: 'badge badge-toll' }
    return <span className={cls[type] || 'badge'}>{type}</span>
  }

  const catLabel = (cat) => cat?.replace('_', ' ')

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Alert Rules</div>
          <div className="page-subtitle">{alerts.length} active rules</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={15} /> New Rule
        </button>
      </div>

      <div className="page-body" style={{ flexDirection: 'column', overflow: 'auto', padding: 24, gap: 20 }}>

        {/* Form */}
        {showForm && (
          <div style={{
            background: 'var(--bg-1)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 20, maxWidth: 480
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} style={{ color: 'var(--accent)' }} /> Configure Alert Rule
            </div>
            <div className="form">
              <div className="form-group">
                <label className="form-label">Geofence *</label>
                <select className="form-select" value={form.geofence_id}
                  onChange={e => setForm(f => ({ ...f, geofence_id: e.target.value }))}>
                  <option value="">— Select geofence —</option>
                  {geofences.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({catLabel(g.category)})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle (optional — leave blank for all)</label>
                <select className="form-select" value={form.vehicle_id}
                  onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}>
                  <option value="">— All vehicles —</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicle_number} ({v.driver_name})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Trigger On *</label>
                <select className="form-select" value={form.event_type}
                  onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                  <option value="entry">Entry — when vehicle enters zone</option>
                  <option value="exit">Exit — when vehicle leaves zone</option>
                  <option value="both">Both — on entry and exit</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Saving...' : 'Create Rule'}
                </button>
                <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-select" style={{ width: 220 }} value={filterGeo}
            onChange={e => setFilterGeo(e.target.value)}>
            <option value="">All Geofences</option>
            {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="form-select" style={{ width: 200 }} value={filterVeh}
            onChange={e => setFilterVeh(e.target.value)}>
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
          </select>
        </div>

        {/* Table */}
        {alerts.length === 0 ? (
          <div className="empty" style={{ background: 'var(--bg-1)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <Bell size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            No alert rules yet. Create one to get real-time notifications.
          </div>
        ) : (
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Geofence</th>
                    <th>Category</th>
                    <th>Vehicle</th>
                    <th>Trigger</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map(a => (
                    <tr key={a.alert_id}>
                      <td style={{ fontWeight: 600 }}>{a.geofence_name}</td>
                      <td>
                        <span className={`badge badge-${a.geofence_name?.includes('restricted') ? 'restricted' : 'delivery'}`}>
                          {a.geofence_id}
                        </span>
                      </td>
                      <td>{a.vehicle_number || <span style={{ color: 'var(--text-3)' }}>All vehicles</span>}</td>
                      <td>{eventBadge(a.event_type)}</td>
                      <td><span className="badge badge-active">{a.status}</span></td>
                      <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                        {new Date(a.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
