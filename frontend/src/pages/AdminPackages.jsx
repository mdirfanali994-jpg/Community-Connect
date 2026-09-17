import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Package, Search, Download, RefreshCw, BarChart3, Eye, X
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { connectAsRole } from '../services/socket';
import {
  COURIER_COMPANIES, PACKAGE_STATUS_LABELS, PACKAGE_STATUS_COLORS, formatDateTime
} from '../components/community/communityConstants';

const AdminPackages = () => {
  const [packages, setPackages] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filter, setFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('packages');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
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

  const fetchPackages = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(
        `${API_BASE_URL}/packages/all?status=${filter}&courier=${courierFilter}&search=${encodeURIComponent(search)}`,
        { headers }
      );
      if (res.data.success) setPackages(res.data.packages);
    } catch (err) {
      console.error('fetchPackages error:', err);
    }
  }, [getHeaders, filter, courierFilter, search]);

  const fetchAnalytics = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/packages/analytics`, { headers });
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
      await Promise.all([fetchPackages(), fetchAnalytics()]);
      setLoading(false);
    };
    load();

    const socket = connectAsRole('admin', parsed?.communityId);
    socket.on('package:status', () => { fetchPackages(); fetchAnalytics(); });
    socket.on('package:new', () => { fetchPackages(); fetchAnalytics(); });
    return () => {
      socket.off('package:status');
      socket.off('package:new');
    };
  }, [navigate, fetchPackages, fetchAnalytics]);

  const handleExport = async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(
        `${API_BASE_URL}/packages/export?status=${filter}&courier=${courierFilter}`,
        { headers, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'packages.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('export error:', err);
    }
  };

  const handleView = async (pkg) => {
    setSelected(pkg);
    try {
      const res = await axios.get(`${API_BASE_URL}/packages/${pkg._id}/history`);
      if (res.data.success) setHistory(res.data.history || []);
    } catch (err) {
      console.error('history error:', err);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Package Management...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Package Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Analytics, tracking & courier statistics</p>
        </div>
        <div className="flex gap-2">
          {['analytics', 'packages'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                activeTab === tab ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {tab === 'analytics' && <BarChart3 className="w-4 h-4 inline mr-1.5" />}
              {tab === 'packages' && <Package className="w-4 h-4 inline mr-1.5" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Today', value: analytics.today, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
              { label: 'This Week', value: analytics.thisWeek, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/10' },
              { label: 'This Month', value: analytics.thisMonth, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/10' },
              { label: 'Pending Pickup', value: analytics.pendingPickup, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' },
              { label: 'Delivered', value: analytics.pickedUp, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10' },
              { label: 'Returned', value: analytics.returned, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10' },
              { label: 'Total', value: analytics.total, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-gray-900/30' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} p-4 rounded-2xl border border-gray-200 dark:border-gray-800`}>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Courier stats */}
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Courier Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {Object.entries(analytics.courierStats || {}).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
                <div key={key} className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                  <span className="text-xs text-gray-500 block">{COURIER_COMPANIES.find(c => c.key === key)?.label || key}</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Packages Tab */}
      {activeTab === 'packages' && (
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by tracking, package ID, resident..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="all">All Status</option>
              <option value="incoming">Incoming</option>
              <option value="ready">Ready for Pickup</option>
              <option value="picked_up">Picked Up</option>
              <option value="returned">Returned</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={courierFilter}
              onChange={(e) => setCourierFilter(e.target.value)}
              className="bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="all">All Couriers</option>
              {COURIER_COMPANIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <button onClick={handleExport} className="flex items-center px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-medium hover:bg-primary/20">
              <Download className="w-4 h-4 mr-1.5" /> Export CSV
            </button>
            <button onClick={() => { fetchPackages(); fetchAnalytics(); }} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-primary">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left">Package</th>
                  <th className="px-4 py-3 text-left">Resident</th>
                  <th className="px-4 py-3 text-left">Courier</th>
                  <th className="px-4 py-3 text-left">Received</th>
                  <th className="px-4 py-3 text-left">Picked Up</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {packages.length === 0 ? (
                  <tr><td colSpan="7" className="px-4 py-12 text-center text-gray-500">No packages found.</td></tr>
                ) : (
                  packages.map((p) => (
                    <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3">
                        <span className="font-mono text-primary text-xs bg-primary/10 px-2 py-0.5 rounded block w-max">{p.packageId}</span>
                        {p.trackingNumber && <span className="text-xs text-gray-500 block mt-1">{p.trackingNumber}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900 dark:text-gray-200 block">{p.residentName}</span>
                        <span className="text-xs text-gray-500">{p.block} - {p.flatNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{COURIER_COMPANIES.find(c => c.key === p.courierCompany)?.label || p.courierCompany}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(p.receivedAt)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{p.pickedUpAt ? formatDateTime(p.pickedUpAt) : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${PACKAGE_STATUS_COLORS[p.status] || ''}`}>
                          {PACKAGE_STATUS_LABELS[p.status] || p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleView(p)} className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg border border-gray-200 dark:border-gray-800 shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Package Timeline — {selected.packageId}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {history.length === 0 ? (
                <p className="text-gray-500 text-sm">No history yet.</p>
              ) : (
                history.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{h.event}</p>
                      <p className="text-xs text-gray-500">{h.actor} ({h.actorRole}) • {formatDateTime(h.timestamp)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPackages;
