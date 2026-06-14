import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { History, Filter, ChevronDown } from 'lucide-react'
import { getViolations, getVehicles, getGeofences } from '../api/client'

export default function ViolationsPage() {
  const [violations, setViolations] = useState([])
  const [total, setTotal] = useState(0)
  const [vehicles, setVehicles] = useState([])
  const [geofences, setGeofences] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    vehicle_id: '', geofence_id: '', start_date: '', end_date: '', limit: 50
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.vehicle_id) params.vehicle_id = filters.vehicle_id
      if (filters.geofence_id) params.geofence_id = filters.geofence_id
      if (filters.start_date) params.start_date = filters.start_date + 'T00:00:00Z'
      if (filters.end_date) params.end_date = filters.end_date + 'T23:59:59Z'
      params.limit = filters.limit

      const res = await getViolations(params)
      setViolations(res.data.violations || [])
      setTotal(res.data.total_count || 0)
    } catch {
      toast.error('Failed to load violations')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    Promise.all([getVehicles(), getGeofences()]).then(([v, g]) => {
      setVehicles(v.data.vehicles || [])
      setGeofences(g.data.geofences || [])
    }).catch(() => {})
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Violation History</div>
          <div className="page-subtitle">{total} total events</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ gap: 10, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Vehicle</label>
          <select className="form-select" style={{ width: 180 }} value={filters.vehicle_id}
            onChange={e => setFilter('vehicle_id', e.target.value)}>
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Geofence</label>
          <select className="form-select" style={{ width: 180 }} value={filters.geofence_id}
            onChange={e => setFilter('geofence_id', e.target.value)}>
            <option value="">All Zones</option>
            {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">From</label>
          <input type="date" className="form-input" style={{ width: 150 }} value={filters.start_date}
            onChange={e => setFilter('start_date', e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">To</label>
          <input type="date" className="form-input" style={{ width: 150 }} value={filters.end_date}
            onChange={e => setFilter('end_date', e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Limit</label>
          <select className="form-select" style={{ width: 90 }} value={filters.limit}
            onChange={e => setFilter('limit', Number(e.target.value))}>
            {[25, 50, 100, 250, 500].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {loading ? (
          <div className="loading">Loading violations...</div>
        ) : violations.length === 0 ? (
          <div className="empty" style={{ background: 'var(--bg-1)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <History size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            No violations found for the selected filters.
          </div>
        ) : (
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)' }}>
              Showing {violations.length} of {total} events
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Vehicle</th>
                    <th>Geofence</th>
                    <th>Coordinates</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.map(v => (
                    <tr key={v.id}>
                      <td style={{ color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(v.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge badge-${v.event_type}`}>{v.event_type}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{v.vehicle_number}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{v.vehicle_id}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{v.geofence_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{v.geofence_id}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                        {v.latitude?.toFixed(4)}, {v.longitude?.toFixed(4)}
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
