import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart2, Plus, X, Trash2, Lock, Unlock, RefreshCw, Search
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { connectAsRole } from '../services/socket';
import { POLL_CHOICE_LABELS, formatDateTime } from '../components/community/communityConstants';

const initialForm = {
  title: '',
  description: '',
  options: ['', ''],
  choiceMode: 'single',
  anonymous: false,
  hideResultsUntilEnd: false,
  expiresAt: '',
};

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];

const AdminPolls = () => {
  const [polls, setPolls] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...initialForm });
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [chartType, setChartType] = useState('bar');
  const [flashMsg, setFlashMsg] = useState('');
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

  const fetchPolls = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(
        `${API_BASE_URL}/polls/admin?search=${encodeURIComponent(search)}`,
        { headers }
      );
      if (res.data.success) setPolls(res.data.polls);
    } catch (err) {
      console.error('fetchPolls error:', err);
    }
  }, [getHeaders, search]);

  const fetchAnalytics = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/polls/analytics`, { headers });
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
      await Promise.all([fetchPolls(), fetchAnalytics()]);
      setLoading(false);
    };
    load();

    const socket = connectAsRole('admin', parsed?.communityId);
    socket.on('poll:new', () => fetchPolls());
    socket.on('poll:updated', () => fetchPolls());
    socket.on('poll:deleted', () => fetchPolls());
    socket.on('poll:vote', () => fetchPolls());
    return () => {
      socket.off('poll:new');
      socket.off('poll:updated');
      socket.off('poll:deleted');
      socket.off('poll:vote');
    };
  }, [navigate, fetchPolls]);

  const updateOption = (idx, val) => {
    setForm((prev) => {
      const opts = [...prev.options];
      opts[idx] = val;
      return { ...prev, options: opts };
    });
  };

  const addOption = () => setForm((prev) => ({ ...prev, options: [...prev.options, ''] }));
  const removeOption = (idx) => {
    setForm((prev) => {
      if (prev.options.length <= 2) return prev;
      return { ...prev, options: prev.options.filter((_, i) => i !== idx) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const headers = getHeaders();
    if (!headers) return;
    const filledOpts = form.options.filter((o) => o.trim());
    if (!form.title.trim()) {
      showFlash('Title is required', 'error');
      return;
    }
    if (filledOpts.length < 2) {
      showFlash('At least 2 options required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        options: filledOpts,
        choiceMode: form.choiceMode,
        anonymous: form.anonymous,
        hideResultsUntilEnd: form.hideResultsUntilEnd,
        expiresAt: form.expiresAt || null,
      };
      let res;
      if (editing) {
        res = await axios.put(`${API_BASE_URL}/polls/${editing}`, payload, { headers });
      } else {
        res = await axios.post(`${API_BASE_URL}/polls`, payload, { headers });
      }
      if (res.data.success) {
        showFlash(editing ? 'Poll updated' : 'Poll created');
        setShowForm(false);
        setEditing(null);
        setForm({ ...initialForm });
        await Promise.all([fetchPolls(), fetchAnalytics()]);
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Failed to save poll', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this poll and all votes?')) return;
    const headers = getHeaders();
    if (!headers) return;
    try {
      await axios.delete(`${API_BASE_URL}/polls/${id}`, { headers });
      showFlash('Poll deleted');
      await Promise.all([fetchPolls(), fetchAnalytics()]);
    } catch (err) {
      showFlash('Failed to delete', 'error');
    }
  };

  const handleClose = async (id) => {
    if (!confirm('Close this poll?')) return;
    const headers = getHeaders();
    if (!headers) return;
    try {
      await axios.put(`${API_BASE_URL}/polls/${id}/close`, {}, { headers });
      showFlash('Poll closed');
      await Promise.all([fetchPolls(), fetchAnalytics()]);
    } catch (err) {
      showFlash('Failed to close', 'error');
    }
  };

  const startEdit = (p) => {
    setEditing(p._id);
    setForm({
      title: p.title,
      description: p.description || '',
      options: p.options.map((o) => o.text),
      choiceMode: p.choiceMode,
      anonymous: p.anonymous,
      hideResultsUntilEnd: p.hideResultsUntilEnd,
      expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 16) : '',
    });
    setShowForm(true);
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Polls...</div>;

  const maxPct = Math.max(...(selected?.results || []).map((r) => r.percentage), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Community Polls</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Create polls and track community votes</p>
        </div>
        <div className="flex gap-2 mt-3 sm:mt-0">
          {analytics && (
            <div className="flex gap-2 mr-2">
              {[
                { label: 'Total', value: analytics.totalPolls },
                { label: 'Open', value: analytics.open },
                { label: 'Closed', value: analytics.closed },
                { label: 'Votes', value: analytics.totalVotes },
              ].map((s) => (
                <div key={s.label} className="px-3 py-2 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{s.value}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ ...initialForm }); }}
            className="flex items-center px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" /> {showForm ? 'Close' : 'New Poll'}
          </button>
        </div>
      </div>

      {flashMsg && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl text-sm">
          {flashMsg}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Poll' : 'Create Poll'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-gray-500">Title *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none" required />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-gray-500">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Options *</label>
            {form.options.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  className="flex-1 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none"
                  placeholder={`Option ${idx + 1}`}
                />
                {form.options.length > 2 && (
                  <button type="button" onClick={() => removeOption(idx)} className="px-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500"><X className="w-4 h-4" /></button>
                )}
              </div>
            ))}
            <button type="button" onClick={addOption} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-sm rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
              + Add Option
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Choice Mode</label>
              <select value={form.choiceMode} onChange={(e) => setForm({ ...form, choiceMode: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none">
                <option value="single">Single Choice</option>
                <option value="multiple">Multiple Choice</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Expiry</label>
              <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer">
              <input type="checkbox" checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} className="h-4 w-4 mr-2 text-primary" />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center"><Lock className="w-3.5 h-3.5 mr-1" /> Anonymous</span>
            </label>
            <label className="flex items-center p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer">
              <input type="checkbox" checked={form.hideResultsUntilEnd} onChange={(e) => setForm({ ...form, hideResultsUntilEnd: e.target.checked })} className="h-4 w-4 mr-2 text-primary" />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center"><Unlock className="w-3.5 h-3.5 mr-1" /> Hide results until poll ends</span>
            </label>
          </div>

          <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
            {submitting ? 'Saving...' : editing ? 'Update Poll' : 'Create Poll'}
          </button>
        </form>
      )}

      {/* Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search polls..." className="w-full pl-9 pr-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none" />
        </div>
        <button onClick={() => { fetchPolls(); fetchAnalytics(); }} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-primary"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Polls Table */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left">Poll</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-left">Votes</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {polls.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-12 text-center text-gray-500">No polls found.</td></tr>
              ) : (
                polls.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-white block">{p.title}</span>
                      <span className="text-xs text-gray-500">{(p.options || []).length} options</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {POLL_CHOICE_LABELS[p.choiceMode] || p.choiceMode}
                      {p.anonymous && <span className="ml-1">🔒</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.totalVotes}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.expiresAt ? formatDateTime(p.expiresAt) : 'Never'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        p.closed ? 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800' :
                        'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                      }`}>{p.closed ? 'Closed' : 'Open'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => setSelected(p)} className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary" title="View Results"><BarChart2 className="w-3.5 h-3.5" /></button>
                        {!p.closed && (
                          <button onClick={() => handleClose(p._id)} className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-500 hover:text-amber-600" title="Close Poll"><Lock className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary" title="Edit"><Plus className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(p._id)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      selected.closed ? 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    }`}>{selected.closed ? 'Closed' : 'Open'}</span>
                    {selected.anonymous && <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-900/20 text-gray-500 rounded-full text-xs">🔒 Anonymous</span>}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selected.title}</h2>
                  <p className="text-xs text-gray-500 mt-1">{selected.totalVotes} total votes</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${chartType === 'bar' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
                >
                  Bar Chart
                </button>
                <button
                  onClick={() => setChartType('pie')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${chartType === 'pie' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
                >
                  Pie Chart
                </button>
              </div>

              {chartType === 'bar' ? (
                <div className="space-y-4">
                  {(selected.results || []).map((r, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 dark:text-gray-300">{r.text}</span>
                        <span className="text-gray-500">{r.count} ({r.percentage}%)</span>
                      </div>
                      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max((r.percentage / maxPct) * 100, 2)}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Pie rendering via conic-gradient */}
                  <div
                    className="w-48 h-48 rounded-full"
                    style={{
                      background: `conic-gradient(${(selected.results || []).map((r, idx) => `${CHART_COLORS[idx % CHART_COLORS.length]} ${Math.round(((selected.results || []).slice(0, idx).reduce((a, b) => a + b.percentage, 0)) * 3.6)}deg ${Math.round(((selected.results || []).slice(0, idx + 1).reduce((a, b) => a + b.percentage, 0)) * 3.6)}deg`).join(', ')}`,
                    }}
                  />
                  <div className="space-y-2">
                    {(selected.results || []).map((r, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                        <span>{r.text}</span>
                        <span className="text-gray-500">({r.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPolls;
