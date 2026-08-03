import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Users, BarChart3, Settings, AlertTriangle,
  Eye, Phone,
  Activity, Ban, RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { VISITOR_TYPES, VISITOR_STATUS_COLORS, VISITOR_STATUS_LABELS } from '../components/visitor/visitorConstants';

const AdminVisitors = () => {
  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('visitors');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [flashMsg, setFlashMsg] = useState('');
  const [blacklistForm, setBlacklistForm] = useState({ identifier: '', type: 'phone', reason: '' });
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

  const fetchVisitors = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(
        `${API_BASE_URL}/visitors/all?status=${filter}&page=${page}&limit=20`,
        { headers }
      );
      if (res.data.success) {
        setVisitors(res.data.visitors);
        setTotalPages(res.data.totalPages);
      }
    } catch (err) {
      console.error('fetchVisitors error:', err);
    }
  }, [getHeaders, filter, page]);

  const fetchAnalytics = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/visitors/analytics`, { headers });
      if (res.data.success) {
        setAnalytics(res.data.analytics);
      }
    } catch (err) {
      console.error('fetchAnalytics error:', err);
    }
  }, [getHeaders]);

  const fetchSettings = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/visitors/settings`, { headers });
      if (res.data.success) {
        setSettings(res.data.settings);
      }
    } catch (err) {
      console.error('fetchSettings error:', err);
    }
  }, [getHeaders]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw || JSON.parse(raw).role !== 'admin') {
      navigate('/login');
      return;
    }
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchVisitors(), fetchAnalytics(), fetchSettings()]);
      setLoading(false);
    };
    load();
  }, [navigate, fetchVisitors, fetchAnalytics, fetchSettings]);

  const handleUpdateSettings = async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.put(
        `${API_BASE_URL}/visitors/settings`,
        {
          defaultApprovalRequired: settings?.defaultApprovalRequired,
          maxVisitorsPerDay: settings?.maxVisitorsPerDay,
        },
        { headers }
      );
      if (res.data.success) {
        setSettings(res.data.settings);
        showFlash('Settings updated');
      }
    } catch (err) {
      showFlash('Failed to update settings', 'error');
    }
  };

  const handleBlacklist = async (e) => {
    e.preventDefault();
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.post(
        `${API_BASE_URL}/visitors/blacklist`,
        blacklistForm,
        { headers }
      );
      if (res.data.success) {
        setSettings(res.data.settings);
        setBlacklistForm({ identifier: '', type: 'phone', reason: '' });
        showFlash('Visitor blacklisted');
      }
    } catch (err) {
      showFlash('Failed to blacklist', 'error');
    }
  };

  const handleEmergencyOverride = async () => {
    const headers = getHeaders();
    if (!headers) return;
    const newState = !settings?.emergencyOverride?.enabled;
    try {
      const res = await axios.put(
        `${API_BASE_URL}/visitors/emergency-override`,
        { enabled: newState, reason: prompt('Reason for override:') || '' },
        { headers }
      );
      if (res.data.success) {
        setSettings(res.data.settings);
        showFlash(newState ? '🔴 Emergency Override Activated' : 'Emergency Override Deactivated');
      }
    } catch (err) {
      showFlash('Failed to toggle override', 'error');
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Visitor Management...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Visitor Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Monitor and manage community visitors</p>
        </div>
        <div className="flex gap-2">
          {['visitors', 'analytics', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {tab === 'analytics' && <BarChart3 className="w-4 h-4 inline mr-1.5" />}
              {tab === 'settings' && <Settings className="w-4 h-4 inline mr-1.5" />}
              {tab === 'visitors' && <Users className="w-4 h-4 inline mr-1.5" />}
              {tab}
            </button>
          ))}
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Today', value: analytics.today, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
              { label: 'This Week', value: analytics.thisWeek, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/10' },
              { label: 'This Month', value: analytics.thisMonth, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/10' },
              { label: 'Inside', value: analytics.inside, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10' },
              { label: 'Completed', value: analytics.completed, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
              { label: 'Deliveries', value: analytics.deliveries, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' },
              { label: 'Rejected', value: analytics.rejected, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10' },
              { label: 'Total', value: analytics.total, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-gray-900/30' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} p-4 rounded-2xl border border-gray-200 dark:border-gray-800`}>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Peak Hours */}
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-primary" />
              Peak Visiting Hours (Today)
            </h3>
            <div className="flex items-end gap-1 h-32">
              {Array.from({ length: 24 }, (_, i) => {
                const count = analytics.peakHours?.[i] || 0;
                const max = Math.max(...Object.values(analytics.peakHours || {}), 1);
                const h = (count / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-6 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">{count}</div>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-primary/60 to-primary transition-all duration-300"
                      style={{ height: `${Math.max(h, 2)}%` }}
                    />
                    <span className="text-[8px] text-gray-500">{i.toString().padStart(2, '0')}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visitor Type Breakdown */}
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Visitor Type Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(analytics.typeBreakdown || {}).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
                <div key={key} className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                  <span className="text-xs text-gray-500 block">{VISITOR_TYPES.find(t => t.key === key)?.label || key}</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-primary" />
              Visitor Policy
            </h3>
            <div className="space-y-4 max-w-md">
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="text-sm text-gray-700 dark:text-gray-300">Require Resident Approval</span>
                <input
                  type="checkbox"
                  checked={settings?.defaultApprovalRequired !== false}
                  onChange={(e) => setSettings({ ...settings, defaultApprovalRequired: e.target.checked })}
                  className="h-4 w-4 text-primary rounded"
                />
              </label>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="text-sm text-gray-700 dark:text-gray-300">Max Visitors Per Day</span>
                <input
                  type="number"
                  value={settings?.maxVisitorsPerDay || 0}
                  onChange={(e) => setSettings({ ...settings, maxVisitorsPerDay: Number(e.target.value) })}
                  className="w-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm text-center"
                  min="0"
                />
              </div>
              <button
                onClick={handleUpdateSettings}
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold"
              >
                Save Settings
              </button>
            </div>
          </div>

          {/* Emergency Override */}
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
              Emergency Override
            </h3>
            <p className="text-sm text-gray-500 mb-4">Bypass all visitor restrictions during emergencies.</p>
            <button
              onClick={handleEmergencyOverride}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                settings?.emergencyOverride?.enabled
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {settings?.emergencyOverride?.enabled ? '🔴 Deactivate Override' : 'Activate Emergency Override'}
            </button>
            {settings?.emergencyOverride?.enabled && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                Activated by {settings.emergencyOverride.activatedBy}<br />
                Reason: {settings.emergencyOverride.reason || 'No reason provided'}
              </div>
            )}
          </div>

          {/* Blacklist */}
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Ban className="w-5 h-5 mr-2 text-red-500" />
              Blacklist
            </h3>
            <form onSubmit={handleBlacklist} className="flex gap-3 mb-4">
              <input
                value={blacklistForm.identifier}
                onChange={(e) => setBlacklistForm({ ...blacklistForm, identifier: e.target.value })}
                className="flex-1 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-sm outline-none"
                placeholder="Phone number or name"
                required
              />
              <select
                value={blacklistForm.type}
                onChange={(e) => setBlacklistForm({ ...blacklistForm, type: e.target.value })}
                className="bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-sm"
              >
                <option value="phone">Phone</option>
                <option value="name">Name</option>
              </select>
              <button type="submit" className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold">
                Block
              </button>
            </form>
            {settings?.blacklistedVisitors?.length > 0 && (
              <div className="space-y-2">
                {settings.blacklistedVisitors.map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-950/50 rounded-lg border border-gray-200 dark:border-gray-800">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{b.identifier} <span className="text-xs text-gray-500">({b.type})</span></span>
                    {b.reason && <span className="text-xs text-gray-500">{b.reason}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visitors Tab */}
      {activeTab === 'visitors' && (
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <div className="flex gap-2">
              <select
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setPage(1); }}
                className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-1.5 text-sm outline-none"
              >
                <option value="all">All Visitors</option>
                <option value="scheduled">Scheduled</option>
                <option value="arrived">Arrived</option>
                <option value="entered">Inside</option>
                <option value="exited">Exited</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <button onClick={fetchVisitors} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-primary" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3">Visitor</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Resident</th>
                  <th className="px-4 py-3">Expected</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {visitors.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-12 text-center text-gray-500">No visitors found.</td>
                  </tr>
                ) : (
                  visitors.map((v) => (
                    <tr key={v._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900 dark:text-gray-200 block">{v.visitorName}</span>
                        <span className="text-xs text-gray-500 flex items-center"><Phone className="w-3 h-3 mr-1" />{v.phoneNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{VISITOR_TYPES.find(t => t.key === v.visitorType)?.label || v.visitorType}</td>
                      <td className="px-4 py-3">
                        <span className="text-gray-900 dark:text-gray-200">{v.residentName}</span>
                        <span className="text-xs text-gray-500 block">{v.block} - {v.flatNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(v.expectedDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${VISITOR_STATUS_COLORS[v.status] || ''}`}>
                          {VISITOR_STATUS_LABELS[v.status] || v.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary" title="View Details">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminVisitors;
