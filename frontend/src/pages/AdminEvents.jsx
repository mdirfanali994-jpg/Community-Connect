import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Calendar, Plus, Pencil, Trash2, X, Users, BarChart3, RefreshCw, Search, QrCode
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { connectAsRole } from '../services/socket';
import {
  EVENT_CATEGORIES, EVENT_CATEGORY_MAP, formatDateTime, formatDate
} from '../components/community/communityConstants';

const initialForm = {
  title: '',
  description: '',
  category: 'other',
  date: '',
  time: '',
  venue: '',
  organizer: '',
  maxParticipants: 0,
  status: 'upcoming',
};

const AdminEvents = () => {
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...initialForm });
  const [editing, setEditing] = useState(null);
  const [banner, setBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [rsvps, setRsvps] = useState([]);
  const [flashMsg, setFlashMsg] = useState('');
  const [activeTab, setActiveTab] = useState('events');
  const navigate = useNavigate();

  const getHeaders = useCallback(() => {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return {
      'x-admin-id': String(user.id),
      'x-community-id': String(user.communityId),
    };
  }, []);

  const showFlash = useCallback((msg, type = 'success') => {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(''), 4000);
  }, []);

  const fetchEvents = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(
        `${API_BASE_URL}/events/admin?status=${filter}&search=${encodeURIComponent(search)}`,
        { headers }
      );
      if (res.data.success) setEvents(res.data.events);
    } catch (err) {
      console.error('fetchEvents error:', err);
    }
  }, [getHeaders, filter, search]);

  const fetchAnalytics = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/events/analytics`, { headers });
      if (res.data.success) setAnalytics(res.data.analytics);
    } catch (err) {
      console.error('fetchAnalytics error:', err);
    }
  }, [getHeaders]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw || JSON.parse(raw).role !== 'admin') {
      navigate('/login');
      return;
    }
    const parsed = JSON.parse(raw);
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchEvents(), fetchAnalytics()]);
      setLoading(false);
    };
    load();

    const socket = connectAsRole('admin', parsed?.communityId);
    socket.on('event:new', () => fetchEvents());
    socket.on('event:updated', () => fetchEvents());
    socket.on('event:deleted', () => fetchEvents());
    socket.on('event:rsvp', () => fetchEvents());
    socket.on('event:checkin', () => fetchEvents());
    return () => {
      socket.off('event:new');
      socket.off('event:updated');
      socket.off('event:deleted');
      socket.off('event:rsvp');
      socket.off('event:checkin');
    };
  }, [navigate, fetchEvents]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const headers = getHeaders();
    if (!headers) return;
    if (!form.title.trim() || !form.date) {
      showFlash('Title and date are required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('category', form.category);
      fd.append('date', form.date);
      fd.append('time', form.time);
      fd.append('venue', form.venue);
      fd.append('organizer', form.organizer);
      fd.append('maxParticipants', form.maxParticipants);
      fd.append('status', form.status);
      if (banner) fd.append('banner', banner);

      let res;
      if (editing) {
        res = await axios.put(`${API_BASE_URL}/events/${editing}`, fd, { headers });
      } else {
        res = await axios.post(`${API_BASE_URL}/events`, fd, { headers });
      }
      if (res.data.success) {
        showFlash(editing ? 'Event updated' : 'Event created');
        setShowForm(false);
        setForm({ ...initialForm });
        setEditing(null);
        setBanner(null);
        await Promise.all([fetchEvents(), fetchAnalytics()]);
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Failed to save event', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this event and all RSVPs?')) return;
    const headers = getHeaders();
    if (!headers) return;
    try {
      await axios.delete(`${API_BASE_URL}/events/${id}`, { headers });
      showFlash('Event deleted');
      await Promise.all([fetchEvents(), fetchAnalytics()]);
    } catch (err) {
      showFlash('Failed to delete', 'error');
    }
  };

  const startEdit = (e) => {
    setEditing(e._id);
    setForm({
      title: e.title,
      description: e.description || '',
      category: e.category,
      date: new Date(e.date).toISOString().slice(0, 10),
      time: e.time || '',
      venue: e.venue || '',
      organizer: e.organizer || '',
      maxParticipants: e.maxParticipants || 0,
      status: e.status,
    });
    setBanner(null);
    setShowForm(true);
  };

  const viewRsvps = async (e) => {
    setSelected(e);
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/events/${e._id}/rsvps`, { headers });
      if (res.data.success) setRsvps(res.data.rsvps);
    } catch (err) {
      console.error('fetch rsvps error:', err);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Events...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Event Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Create and manage community events</p>
        </div>
        <div className="flex gap-2 mt-3 sm:mt-0">
          {[
            { key: 'events', label: 'Events', icon: Calendar },
            { key: 'analytics', label: 'Analytics', icon: BarChart3 },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === t.key ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon className="w-4 h-4 inline mr-1.5" /> {t.label}
              </button>
            );
          })}
          <button
            onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ ...initialForm }); setBanner(null); }}
            className="flex items-center px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" /> {showForm ? 'Close' : 'New Event'}
          </button>
        </div>
      </div>

      {flashMsg && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl text-sm">
          {flashMsg}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Events', value: analytics.total, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-gray-900/30' },
              { label: 'Upcoming', value: analytics.upcoming, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
              { label: 'Ongoing', value: analytics.ongoing, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' },
              { label: 'Completed', value: analytics.completed, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10' },
              { label: 'Going', value: analytics.totalGoing, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
              { label: 'Maybe', value: analytics.totalMaybe, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' },
              { label: 'Checked In', value: analytics.totalCheckedIn, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/10' },
              { label: 'Not Going', value: analytics.totalNotGoing, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} p-4 rounded-2xl border border-gray-200 dark:border-gray-800`}>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Category Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(analytics.categoryBreakdown || {}).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
                <div key={key} className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                  <span className="text-xs text-gray-500 block">{EVENT_CATEGORY_MAP[key] || key}</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'events' && (
        <>
          {/* Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Event' : 'Create Event'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-500">Title *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none" required />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-500">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none">
                    {EVENT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Date *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Time</label>
                  <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Venue</label>
                  <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none" placeholder="Clubhouse, Ground..." />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Organizer</label>
                  <input value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Max Participants (0 = unlimited)</label>
                  <input type="number" min="0" value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: Number(e.target.value) })} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none">
                    <option value="upcoming">Upcoming</option>
                    <option value="draft">Draft</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Banner Image</label>
                  <input type="file" accept="image/*" onChange={(e) => setBanner(e.target.files[0])} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary" />
                </div>
              </div>
              <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
                {submitting ? 'Saving...' : editing ? 'Update Event' : 'Create Event'}
              </button>
            </form>
          )}

          {/* Search + Filter */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..." className="w-full pl-9 pr-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none" />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-sm outline-none">
              <option value="all">All Status</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="draft">Draft</option>
            </select>
            <button onClick={() => { fetchEvents(); fetchAnalytics(); }} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-primary"><RefreshCw className="w-4 h-4" /></button>
          </div>

          {/* Events Table */}
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left">Event</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">RSVPs</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {events.length === 0 ? (
                    <tr><td colSpan="6" className="px-4 py-12 text-center text-gray-500">No events found.</td></tr>
                  ) : (
                    events.map((e) => (
                      <tr key={e._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900 dark:text-white block">{e.title}</span>
                          <span className="text-xs text-gray-500">{e.venue || ''}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{EVENT_CATEGORY_MAP[e.category] || e.category}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{formatDate(e.date)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          <span className="text-green-600 font-medium">{e.going} going</span>
                          {e.maybe > 0 && <> • {e.maybe} maybe</>}
                          {e.checkedIn > 0 && <> • {e.checkedIn} ✅</>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            e.status === 'upcoming' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                            e.status === 'ongoing' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                            e.status === 'completed' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' :
                            e.status === 'cancelled' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' :
                            'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                          }`}>{e.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button onClick={() => viewRsvps(e)} className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary" title="RSVPs"><Users className="w-3.5 h-3.5" /></button>
                            <button onClick={() => startEdit(e)} className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(e._id)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* RSVP Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selected.title}</h2>
                  <p className="text-xs text-gray-500">{formatDateTime(selected.date)}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Attendees ({rsvps.length})</h3>
              {rsvps.length === 0 ? (
                <p className="text-sm text-gray-500">No RSVPs yet.</p>
              ) : (
                <div className="space-y-2">
                  {rsvps.map((r) => (
                    <div key={r._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{r.residentName}</span>
                        <span className="text-xs text-gray-500 ml-2">{r.block}-{r.flatNumber}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.checkedIn && <QrCode className="w-4 h-4 text-green-500" />}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r.status === 'going' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
                          r.status === 'maybe' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' :
                          'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400'
                        }`}>{r.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEvents;
