import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Package, Search, Camera, QrCode, RefreshCw, CheckCircle,
  XCircle, UserCheck, Eye, Phone, Clock, LogOut, ClipboardList
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { connectAsRole } from '../services/socket';
import {
  COURIER_COMPANIES, PACKAGE_CATEGORIES,
  PACKAGE_STATUS_LABELS, PACKAGE_STATUS_COLORS, formatDateTime
} from '../components/community/communityConstants';

const initialForm = {
  residentId: '',
  courierCompany: 'amazon',
  trackingNumber: '',
  packageCategory: 'small',
  remarks: '',
  expectedPickupTime: '',
};

const SecurityPackages = () => {
  const [user, setUser] = useState(null);
  const [workerId, setWorkerId] = useState(null);
  const [packages, setPackages] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...initialForm });
  const [residentSearch, setResidentSearch] = useState('');
  const [residentResults, setResidentResults] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [flashMsg, setFlashMsg] = useState('');
  const [flashType, setFlashType] = useState('success');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanned, setScanned] = useState(null);
  const [otpModal, setOtpModal] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const navigate = useNavigate();

  const showFlash = useCallback((msg, type = 'success') => {
    setFlashMsg(msg);
    setFlashType(type);
    setTimeout(() => setFlashMsg(''), 4000);
  }, []);

  const getWorkerId = useCallback(() => {
    const parsed = JSON.parse(localStorage.getItem('user') || '{}');
    return parsed?.workerId || parsed?._id || parsed?.id;
  }, []);

  const fetchPackages = useCallback(async () => {
    const wid = getWorkerId();
    if (!wid) return;
    try {
      const res = await axios.get(
        `${API_BASE_URL}/packages/security?workerId=${wid}&status=${filter}&search=${encodeURIComponent(search)}`
      );
      if (res.data.success) {
        setPackages(res.data.packages);
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('fetchPackages error:', err);
    }
  }, [getWorkerId, filter, search]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw || JSON.parse(raw).role !== 'worker') {
      navigate('/login');
      return;
    }
    const parsed = JSON.parse(raw);
    setUser(parsed);
    setWorkerId(getWorkerId());

    const load = async () => {
      setLoading(true);
      await fetchPackages();
      setLoading(false);
    };
    load();

    const socket = connectAsRole('worker', parsed?.communityId);
    socket.on('package:status', fetchPackages);
    socket.on('package:new', fetchPackages);
    return () => {
      socket.off('package:status');
      socket.off('package:new');
    };
  }, [navigate, getWorkerId, fetchPackages]);

  const handleResidentSearch = async (q) => {
    setResidentSearch(q);
    if (!q || q.length < 2) {
      setResidentResults([]);
      return;
    }
    try {
      const res = await axios.get(
        `${API_BASE_URL}/packages/residents/search?query=${encodeURIComponent(q)}&workerId=${workerId}`
      );
      if (res.data.success) {
        setResidentResults(res.data.residents);
      }
    } catch (err) {
      console.error('resident search error:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.residentId || !form.courierCompany) {
      showFlash('Select a resident and courier company', 'error');
      return;
    }
    setSubmitting(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v !== '' && v !== null) fd.append(k, v);
    });
    fd.append('workerId', workerId);
    if (photo) fd.append('photo', photo);
    try {
      const res = await axios.post(`${API_BASE_URL}/packages/register`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        showFlash('📦 Package received and resident notified!');
        setForm({ ...initialForm });
        setPhoto(null);
        setResidentSearch('');
        setShowForm(false);
        await fetchPackages();
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Failed to register package', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (pkgId) => {
    setActionLoading(pkgId);
    try {
      const res = await axios.put(`${API_BASE_URL}/packages/${pkgId}/verify-otp`, {
        workerId,
        otp: otpInput,
      });
      if (res.data.success) {
        showFlash('✅ Package picked up (OTP verified)');
        setOtpModal(null);
        setOtpInput('');
        await fetchPackages();
      } else {
        showFlash(res.data.message || 'Verification failed', 'error');
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Verification failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleQRScan = async (scanData) => {
    setShowScanner(false);
    setScanLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/packages/scan`, {
        packageId: scanData.raw || scanData.packageId,
        communityId: scanData.communityId || '',
        workerId,
      });
      if (res.data.success) {
        setScanned(res.data.package);
        if (res.data.action === 'info') {
          showFlash(res.data.message || 'Already processed', 'error');
        }
      } else {
        showFlash(res.data.message || 'Failed to scan', 'error');
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Failed to scan QR', 'error');
    } finally {
      setScanLoading(false);
    }
  };

  const handleConfirmPickup = async (pkgId) => {
    setActionLoading(pkgId);
    try {
      const res = await axios.put(`${API_BASE_URL}/packages/${pkgId}/confirm-pickup`, {
        workerId,
        method: 'qr',
      });
      if (res.data.success) {
        showFlash('✅ Package picked up');
        setScanned(null);
        await fetchPackages();
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Failed to confirm pickup', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReturn = async (pkgId) => {
    const reason = prompt('Return reason (optional):');
    setActionLoading(pkgId);
    try {
      const res = await axios.put(`${API_BASE_URL}/packages/${pkgId}/return`, {
        workerId,
        reason: reason || '',
      });
      if (res.data.success) {
        showFlash('📦 Package returned to courier');
        await fetchPackages();
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Failed to return package', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleView = async (pkg) => {
    setSelected(pkg);
    try {
      const res = await axios.get(`${API_BASE_URL}/packages/${pkg._id}/history`);
      if (res.data.success) {
        setHistory(res.data.history || []);
      }
    } catch (err) {
      console.error('history error:', err);
    }
  };

  const filtered = packages;

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Security Packages...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Package Management</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Register, track & manage deliveries</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-3 mt-3 sm:mt-0">
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center px-4 py-2 bg-primary/10 border border-primary/20 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-all"
          >
            <Camera className="w-4 h-4 mr-2" /> Scan QR
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all"
          >
            <Package className="w-4 h-4 mr-2" />
            {showForm ? 'Close' : 'Register Package'}
          </button>
          <button onClick={fetchPackages} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-primary transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {flashMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium border transition-all ${
          flashType === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
        }`}>
          {flashMsg}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Ready for Pickup', value: stats.ready, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' },
            { label: 'Pending', value: stats.pendingPickup, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
            { label: 'Picked Up', value: stats.pickedUp, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10' },
            { label: 'Returned', value: stats.returned, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} p-5 rounded-2xl border border-gray-200 dark:border-gray-800`}>
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Register Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <ClipboardList className="w-5 h-5 mr-2 text-primary" /> Register Package
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1 relative">
              <label className="text-xs font-medium text-gray-500">Search Resident / Flat *</label>
              <input
                value={residentSearch}
                onChange={(e) => handleResidentSearch(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 pl-9"
                placeholder="Search by name or flat..."
              />
              <Search className="w-4 h-4 absolute left-3 top-9 text-gray-400" />
              {residentResults.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                  {residentResults.map((r) => (
                    <button
                      type="button"
                      key={r._id}
                      onClick={() => {
                        setForm({ ...form, residentId: r._id });
                        setResidentSearch(`${r.fullName} (${r.block}-${r.flatNumber})`);
                        setResidentResults([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/30 text-sm"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{r.fullName}</span>
                      <span className="text-xs text-gray-500 ml-2">{r.block} - {r.flatNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Courier Company *</label>
              <select
                value={form.courierCompany}
                onChange={(e) => setForm({ ...form, courierCompany: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none"
              >
                {COURIER_COMPANIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Package Category</label>
              <select
                value={form.packageCategory}
                onChange={(e) => setForm({ ...form, packageCategory: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none"
              >
                {PACKAGE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Tracking Number</label>
              <input
                value={form.trackingNumber}
                onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none"
                placeholder="e.g. 1Z999AA10123456784"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Expected Pickup Time</label>
              <input
                type="datetime-local"
                value={form.expectedPickupTime}
                onChange={(e) => setForm({ ...form, expectedPickupTime: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files[0])}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-medium text-gray-500">Remarks</label>
              <textarea
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                rows={2}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                placeholder="Security remarks..."
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          >
            {submitting ? 'Receiving...' : 'Receive Package'}
          </button>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'ready', label: 'Ready for Pickup' },
          { key: 'incoming', label: 'Incoming' },
          { key: 'picked_up', label: 'Picked Up' },
          { key: 'returned', label: 'Returned' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              filter === f.key ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by tracking, package ID, resident, flat..."
          className="w-full pl-11 pr-4 py-3 bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Packages list */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left">Package</th>
                <th className="px-4 py-3 text-left">Resident</th>
                <th className="px-4 py-3 text-left">Courier</th>
                <th className="px-4 py-3 text-left">Received</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-gray-500">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    No packages found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
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
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${PACKAGE_STATUS_COLORS[p.status] || ''}`}>
                        {PACKAGE_STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {p.status === 'ready' && (
                          <>
                            <button
                              onClick={() => setOtpModal(p)}
                              className="px-2.5 py-1.5 text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100"
                            >
                              <UserCheck className="w-3 h-3 inline mr-1" /> Verify OTP
                            </button>
                            <button
                              onClick={() => handleConfirmPickup(p._id)}
                              disabled={actionLoading === p._id}
                              className="px-2.5 py-1.5 text-xs font-semibold bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 disabled:opacity-50"
                            >
                              <CheckCircle className="w-3 h-3 inline mr-1" /> Pickup
                            </button>
                            <button
                              onClick={() => handleReturn(p._id)}
                              disabled={actionLoading === p._id}
                              className="px-2.5 py-1.5 text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 disabled:opacity-50"
                            >
                              <XCircle className="w-3 h-3 inline mr-1" /> Return
                            </button>
                          </>
                        )}
                        <button onClick={() => handleView(p)} className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary">
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
      </div>

      {/* Selected details */}
      {selected && (
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Package Timeline — {selected.packageId}</h3>
            {selected.photo && (
              <img src={`${API_BASE_URL.replace('/api', '')}/uploads/${selected.photo}`} alt="package" className="w-20 h-20 object-cover rounded-xl border" />
            )}
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
                    {h.notes && <p className="text-xs text-gray-500 mt-0.5">{h.notes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* OTP modal */}
      {otpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm border border-gray-200 dark:border-gray-800 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Verify OTP</h3>
            <p className="text-sm text-gray-500 mb-4">Package {otpModal.packageId} for {otpModal.residentName}</p>
            <input
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm text-center font-mono text-xl tracking-widest outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleVerifyOtp(otpModal._id)}
                disabled={actionLoading === otpModal._id || otpInput.length !== 6}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Verify & Pickup
              </button>
              <button onClick={() => { setOtpModal(null); setOtpInput(''); }} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR scanner placeholder modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md border border-gray-200 dark:border-gray-800 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center"><QrCode className="w-5 h-5 mr-2 text-primary" /> Scan Package QR</h3>
              <button onClick={() => setShowScanner(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><XCircle className="w-5 h-5" /></button>
            </div>
            <label className="text-xs font-medium text-gray-500">Enter / paste scanned package ID</label>
            <input
              id="manual-qr"
              placeholder="PK-XXXXXX or full QR payload"
              className="w-full mt-1 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleQRScan({ raw: e.target.value });
                }
              }}
            />
            <p className="text-xs text-gray-500 mt-2">Enter the package ID and press Enter to verify.</p>
          </div>
        </div>
      )}

      {/* Scanned confirm modal */}
      {scanned && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md border border-gray-200 dark:border-gray-800 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Confirm Pickup</h3>
            <div className="space-y-2 text-sm bg-gray-50 dark:bg-gray-950/50 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
              <p><span className="text-gray-500">Package:</span> <span className="font-mono text-primary">{scanned.packageId}</span></p>
              <p><span className="text-gray-500">Resident:</span> <span className="font-medium">{scanned.residentName}</span></p>
              <p><span className="text-gray-500">Flat:</span> {scanned.block} - {scanned.flatNumber}</p>
              <p><span className="text-gray-500">Courier:</span> {COURIER_COMPANIES.find(c => c.key === scanned.courierCompany)?.label || scanned.courierCompany}</p>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleConfirmPickup(scanned._id)}
                disabled={actionLoading === scanned._id}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Confirm Pickup
              </button>
              <button onClick={() => setScanned(null)} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}

      {scanLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-200 dark:border-gray-800 text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-900 dark:text-white font-medium">Verifying package...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityPackages;
