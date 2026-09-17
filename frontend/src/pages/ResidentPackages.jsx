import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Package, Search, Eye, AlertTriangle, CheckCircle, X, QrCode, Copy
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { API_BASE_URL } from '../config/api';
import { connectAsRole } from '../services/socket';
import {
  COURIER_COMPANIES, PACKAGE_STATUS_LABELS, PACKAGE_STATUS_COLORS, formatDateTime
} from '../components/community/communityConstants';

const ResidentPackages = () => {
  const [user, setUser] = useState(null);
  const [packages, setPackages] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [otpModal, setOtpModal] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [passModal, setPassModal] = useState(null);
  const [flashMsg, setFlashMsg] = useState('');
  const [flashType, setFlashType] = useState('success');
  const [actionLoading, setActionLoading] = useState(null);
  const navigate = useNavigate();

  const showFlash = useCallback((msg, type = 'success') => {
    setFlashMsg(msg);
    setFlashType(type);
    setTimeout(() => setFlashMsg(''), 4000);
  }, []);

  const fetchPackages = useCallback(async (uid) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/packages/my?userId=${uid}&status=${filter}`);
      if (res.data.success) {
        setPackages(res.data.packages);
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('fetchPackages error:', err);
    }
  }, [filter]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw || JSON.parse(raw).role !== 'resident') {
      navigate('/login');
      return;
    }
    const parsed = JSON.parse(raw);
    setUser(parsed);
    const load = async () => {
      setLoading(true);
      await fetchPackages(parsed.id);
      setLoading(false);
    };
    load();

    const socket = connectAsRole('resident', parsed?.communityId);
    socket.on('package:status', () => fetchPackages(parsed.id));
    socket.on('package:new', () => fetchPackages(parsed.id));
    return () => {
      socket.off('package:status');
      socket.off('package:new');
    };
  }, [navigate, fetchPackages]);

  const handleView = async (pkg) => {
    setSelected(pkg);
    try {
      const res = await axios.get(`${API_BASE_URL}/packages/${pkg._id}?userId=${user.id}`);
      if (res.data.success) {
        setSelected(res.data.package);
      }
      const histRes = await axios.get(`${API_BASE_URL}/packages/${pkg._id}/history`);
      if (histRes.data.success) setHistory(histRes.data.history || []);
    } catch (err) {
      console.error('view error:', err);
    }
  };

  const handlePickup = async (pkgId) => {
    setActionLoading(pkgId);
    try {
      const res = await axios.put(`${API_BASE_URL}/packages/${pkgId}/pickup`, {
        userId: user.id,
        otp: otpInput,
      });
      if (res.data.success) {
        showFlash('✅ Package picked up successfully!');
        setOtpModal(null);
        setOtpInput('');
        await fetchPackages(user.id);
      } else {
        showFlash(res.data.message || 'Verification failed', 'error');
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Verification failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReportMissing = async (pkgId) => {
    const notes = prompt('Describe the issue (optional):');
    if (notes === null) return;
    try {
      const res = await axios.put(`${API_BASE_URL}/packages/${pkgId}/report-missing`, {
        userId: user.id,
        notes,
      });
      if (res.data.success) {
        showFlash('🚨 Reported to admin');
        await fetchPackages(user.id);
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Failed to report', 'error');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => showFlash('Copied to clipboard!'));
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Packages...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Packages</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Track deliveries & manage pickups</p>
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
            { label: 'Incoming', value: stats.incoming, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
            { label: 'Ready for Pickup', value: stats.ready, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' },
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

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'incoming', label: 'Incoming' },
          { key: 'ready', label: 'Ready for Pickup' },
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

      {/* Packages grid */}
      {packages.length === 0 ? (
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-12 rounded-3xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Package className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">No packages yet</h3>
          <p className="text-gray-500 text-sm">Your deliveries will appear here once security receives them.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((p) => (
            <div key={p._id} className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-5 transition-colors hover:border-primary/20">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-mono text-primary text-xs bg-primary/10 px-2 py-0.5 rounded">{p.packageId}</span>
                  <p className="font-medium text-gray-900 dark:text-white mt-2">
                    {COURIER_COMPANIES.find(c => c.key === p.courierCompany)?.label || p.courierCompany}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${PACKAGE_STATUS_COLORS[p.status] || ''}`}>
                  {PACKAGE_STATUS_LABELS[p.status] || p.status}
                </span>
              </div>

              {p.photo && (
                <img src={`${API_BASE_URL.replace('/api', '')}/uploads/${p.photo}`} alt="package" className="w-full h-28 object-cover rounded-xl border border-gray-200 dark:border-gray-700 mb-3" />
              )}

              <div className="text-xs space-y-1 text-gray-500 mb-4">
                {p.trackingNumber && <p>Tracking: <span className="font-mono">{p.trackingNumber}</span></p>}
                <p>Received: {formatDateTime(p.receivedAt)}</p>
                {p.securityRemarks && <p className="text-gray-600 dark:text-gray-400">Remarks: {p.securityRemarks}</p>}
              </div>

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => handleView(p)} className="flex items-center px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                  <Eye className="w-3 h-3 mr-1" /> View
                </button>
                {p.status === 'ready' && (
                  <>
                    <button onClick={() => setOtpModal(p)} className="flex items-center px-3 py-1.5 text-xs font-semibold bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100">
                      <CheckCircle className="w-3 h-3 mr-1" /> Confirm Pickup
                    </button>
                    <button onClick={() => setPassModal(p)} className="flex items-center px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-lg">
                      <QrCode className="w-3 h-3 mr-1" /> Pass
                    </button>
                  </>
                )}
                {p.status !== 'picked_up' && p.status !== 'returned' && p.status !== 'cancelled' && (
                  <button onClick={() => handleReportMissing(p._id)} className="flex items-center px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Report Missing
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected details with timeline */}
      {selected && (
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Package Timeline — {selected.packageId}</h3>
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
      )}

      {/* OTP pickup modal */}
      {otpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm border border-gray-200 dark:border-gray-800 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Confirm Pickup</h3>
            <p className="text-sm text-gray-500 mb-4">Enter the OTP shown on your package pass to confirm pickup.</p>
            <input
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              placeholder="6-digit OTP"
              maxLength={6}
              className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm text-center font-mono text-xl tracking-widest outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handlePickup(otpModal._id)}
                disabled={actionLoading === otpModal._id || otpInput.length !== 6}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Confirm Pickup
              </button>
              <button onClick={() => { setOtpModal(null); setOtpInput(''); }} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Pass modal with QR */}
      {passModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md border border-gray-200 dark:border-gray-800 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center"><QrCode className="w-5 h-5 mr-2 text-primary" /> Package Pass</h3>
              <button onClick={() => setPassModal(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex justify-center p-4">
              <div className="bg-white p-3 rounded-xl shadow-lg">
                <QRCode value={passModal.barcodeData || passModal.packageId || ''} size={180} />
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-950/50 rounded-lg">
                <span className="text-gray-500">Package ID</span>
                <span className="font-mono font-medium text-gray-900 dark:text-white">{passModal.packageId}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-950/50 rounded-lg">
                <span className="text-gray-500">Courier</span>
                <span className="font-medium text-gray-900 dark:text-white">{COURIER_COMPANIES.find(c => c.key === passModal.courierCompany)?.label || passModal.courierCompany}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-950/50 rounded-lg">
                <span className="text-gray-500">OTP</span>
                <span className="font-mono font-bold text-xl text-primary">{passModal.otp}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => copyToClipboard(passModal.otp)} className="flex-1 flex items-center justify-center py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-medium hover:bg-primary/20">
                <Copy className="w-4 h-4 mr-1.5" /> Copy OTP
              </button>
              <button onClick={() => copyToClipboard(passModal.packageId)} className="flex-1 flex items-center justify-center py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium">
                <Copy className="w-4 h-4 mr-1.5" /> Copy ID
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentPackages;
