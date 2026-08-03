import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Shield, Users, Clock, Calendar,
  Search, UserCheck, UserX, LogIn, LogOut, Phone,
  RefreshCw, Eye, X, Package, QrCode, Camera
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { VISITOR_TYPES, VISITOR_STATUS_COLORS, VISITOR_STATUS_LABELS, isDelivery } from '../components/visitor/visitorConstants';
import QRScanner from '../components/visitor/QRScanner';
import ScanConfirmModal from '../components/visitor/ScanConfirmModal';

const VISITOR_STATS_CARDS = [
  { key: 'expected', label: 'Expected Today', icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800' },
  { key: 'arrived', label: 'Pending Approval', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800' },
  { key: 'inside', label: 'Visitors Inside', icon: Users, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-200 dark:border-green-800' },
  { key: 'deliveries', label: 'Deliveries Today', icon: Package, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-800' },
];

const VisitorSecurityDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState([]);
  const [stats, setStats] = useState(null);
  const [workerId, setWorkerId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
const [filter, setFilter] = useState('all');
  const [flashMsg, setFlashMsg] = useState('');
  // QR Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannedVisitor, setScannedVisitor] = useState(null);
  const [scanAction, setScanAction] = useState(null);
  const [scanMessage, setScanMessage] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const navigate = useNavigate();

  const showFlash = useCallback((msg, type = 'success') => {
    setFlashMsg({ msg, type });
    setTimeout(() => setFlashMsg(''), 4000);
  }, []);

  const getWorkerId = useCallback(() => {
    const parsed = JSON.parse(localStorage.getItem('user') || '{}');
    const wid = parsed?.workerId || parsed?._id || parsed?.id;
    return wid;
  }, []);

  const fetchToday = useCallback(async () => {
    const wid = getWorkerId();
    if (!wid) return;
    setWorkerId(wid);
    try {
      const res = await axios.get(`${API_BASE_URL}/visitors/today?workerId=${wid}`);
      if (res.data.success) {
        setVisitors(res.data.visitors);
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('fetchToday error:', err);
    }
  }, [getWorkerId]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw || JSON.parse(raw).role !== 'worker') {
      navigate('/login');
      return;
    }
    const load = async () => {
      setLoading(true);
      await fetchToday();
      setLoading(false);
    };
    load();
    const interval = setInterval(fetchToday, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [navigate, fetchToday]);

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/visitors/search?query=${encodeURIComponent(q)}&workerId=${workerId}`);
      if (res.data.success) {
        setSearchResults(res.data.visitors);
      }
    } catch (err) {
      console.error('search error:', err);
    } finally {
      setSearching(false);
    }
  };

const handleAction = async (visitorId, action) => {
    setActionLoading(visitorId);
    try {
      let res;
      switch (action) {
        case 'arrived':
          res = await axios.put(`${API_BASE_URL}/visitors/${visitorId}/arrived`, { workerId });
          break;
        case 'enter':
          res = await axios.put(`${API_BASE_URL}/visitors/${visitorId}/enter`, { workerId });
          break;
        case 'exit':
          res = await axios.put(`${API_BASE_URL}/visitors/${visitorId}/exit`, { workerId });
          break;
case 'reject': {
          const reason = prompt('Rejection reason (optional):');
          res = await axios.put(`${API_BASE_URL}/visitors/${visitorId}/reject`, { workerId, reason: reason || '' });
          break;
        }
      }
      if (res?.data?.success) {
        showFlash(`Visitor ${action === 'arrived' ? 'marked arrived' : action === 'enter' ? 'entered' : action === 'exit' ? 'exited' : 'rejected'}`);
        await fetchToday();
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Action failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── QR Scanner Handlers ─────────────────────────────────────────────────────

  const handleQRScan = async (scanData) => {
    // scanData = { visitorId, communityId, workerId, raw }
    setShowScanner(false);
    setScanLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/visitors/scan`, {
        visitorId: scanData.visitorId,
        communityId: scanData.communityId || '',
        workerId: scanData.workerId,
      });

      if (res.data.success) {
        setScannedVisitor(res.data.visitor);
        setScanAction(res.data.action);
        setScanMessage(res.data.message || '');
      } else {
        showFlash(res.data.message || 'Failed to scan QR', 'error');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to scan QR code';
      showFlash(msg, 'error');
    } finally {
      setScanLoading(false);
    }
  };

  const handleAllowEntry = async () => {
    if (!scannedVisitor?._id) return;
    setScanLoading(true);
    try {
      const res = await axios.put(`${API_BASE_URL}/visitors/${scannedVisitor._id}/allow-entry`, {
        workerId,
        approvalMethod: 'qr',
      });
      if (res.data.success) {
        showFlash(`✅ ${scannedVisitor.visitorName} has been granted entry`);
        setScannedVisitor(null);
        setScanAction(null);
        setScanMessage('');
        await fetchToday();
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Failed to allow entry', 'error');
    } finally {
      setScanLoading(false);
    }
  };

  const handleRejectEntry = async (reason) => {
    if (!scannedVisitor?._id) return;
    setScanLoading(true);
    try {
      const res = await axios.put(`${API_BASE_URL}/visitors/${scannedVisitor._id}/reject-entry`, {
        workerId,
        reason: reason || 'Rejected by security',
      });
      if (res.data.success) {
        showFlash(`❌ ${scannedVisitor.visitorName} has been rejected`);
        setScannedVisitor(null);
        setScanAction(null);
        setScanMessage('');
        await fetchToday();
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Failed to reject entry', 'error');
    } finally {
      setScanLoading(false);
    }
  };

  const handleMarkExit = async () => {
    if (!scannedVisitor?._id) return;
    setScanLoading(true);
    try {
      const res = await axios.put(`${API_BASE_URL}/visitors/${scannedVisitor._id}/mark-exit`, {
        workerId,
      });
      if (res.data.success) {
        showFlash(`✅ ${scannedVisitor.visitorName} has been marked as exited`);
        setScannedVisitor(null);
        setScanAction(null);
        setScanMessage('');
        await fetchToday();
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Failed to mark exit', 'error');
    } finally {
      setScanLoading(false);
    }
  };

  const filteredVisitors = visitors.filter((v) => {
    if (filter === 'all') return true;
    if (filter === 'delivery') return isDelivery(v.visitorType);
    return v.status === filter;
  });

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Security Dashboard...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Dashboard</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Gate Management & Visitor Control</p>
            </div>
          </div>
        </div>
<div className="relative z-10 flex items-center gap-3 mt-3 sm:mt-0">
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all"
          >
            <Camera className="w-4 h-4 mr-2" />
            Scan QR
          </button>
          <button onClick={fetchToday} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
            <RefreshCw className="w-4 h-4 inline mr-1.5" />
            Refresh
          </button>
        </div>
      </div>

      {flashMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium border transition-all ${
          flashMsg.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' :
          'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
        }`}>
          {flashMsg.msg}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {VISITOR_STATS_CARDS.map((card) => {
          const Icon = card.icon;
          const value = stats?.[card.key] || 0;
          return (
            <div key={card.key} className={`${card.bg} p-5 rounded-2xl border ${card.border} transition-colors`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{card.label}</span>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <p className={`text-3xl font-bold ${card.color}`}>{value}</p>
            </div>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by visitor name, phone, ID, OTP, or flat..."
          className="w-full pl-11 pr-4 py-3 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
        {searching && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
        {searchResults.length > 0 && (
          <div className="absolute top-full mt-2 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50 max-h-64 overflow-y-auto">
            {searchResults.map((v) => (
              <div key={v._id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800/60 cursor-pointer" onClick={() => { setSelectedVisitor(v); setSearchResults([]); setSearchQuery(''); }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">{v.visitorName}</span>
                    <span className="text-xs text-gray-500 ml-2">{v.phoneNumber}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${VISITOR_STATUS_COLORS[v.status] || ''}`}>
                    {VISITOR_STATUS_LABELS[v.status] || v.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{v.block} - {v.flatNumber} • {VISITOR_TYPES.find(t => t.key === v.visitorType)?.label || v.visitorType}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'all', label: 'All Today' },
          { key: 'scheduled', label: 'Expected' },
          { key: 'arrived', label: 'Pending Approval' },
          { key: 'entered', label: 'Inside' },
          { key: 'delivery', label: 'Deliveries' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              filter === f.key
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Visitors Table */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left">Visitor</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Flat</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {filteredVisitors.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-gray-500">
                    <div className="flex justify-center mb-2"><Shield className="w-8 h-8 opacity-20" /></div>
                    No visitors to display.
                  </td>
                </tr>
              ) : (
                filteredVisitors.map((v) => (
                  <tr key={v._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-gray-200 block">{v.visitorName}</span>
                      <span className="text-xs text-gray-500 flex items-center"><Phone className="w-3 h-3 mr-1" />{v.phoneNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{VISITOR_TYPES.find(t => t.key === v.visitorType)?.label || v.visitorType}</td>
                    <td className="px-4 py-3">
                      <span className="text-gray-900 dark:text-gray-200">{v.block} - {v.flatNumber}</span>
                      <span className="text-xs text-gray-500 block">{v.residentName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${VISITOR_STATUS_COLORS[v.status] || ''}`}>
                        {VISITOR_STATUS_LABELS[v.status] || v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {v.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => handleAction(v._id, 'arrived')}
                              disabled={actionLoading === v._id}
                              className="px-2.5 py-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all disabled:opacity-50"
                            >
                              <UserCheck className="w-3 h-3 inline mr-1" />
                              Mark Arrived
                            </button>
                            <button
                              onClick={() => handleAction(v._id, 'reject')}
                              disabled={actionLoading === v._id}
                              className="px-2.5 py-1.5 text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-all disabled:opacity-50"
                            >
                              <UserX className="w-3 h-3 inline mr-1" />
                              Reject
                            </button>
                          </>
                        )}
                        {(v.status === 'arrived' || v.status === 'scheduled') && (
                          <button
                            onClick={() => handleAction(v._id, 'enter')}
                            disabled={actionLoading === v._id}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-all disabled:opacity-50"
                          >
                            <LogIn className="w-3 h-3 inline mr-1" />
                            Enter
                          </button>
                        )}
                        {v.status === 'entered' && (
                          <button
                            onClick={() => handleAction(v._id, 'exit')}
                            disabled={actionLoading === v._id}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
                          >
                            <LogOut className="w-3 h-3 inline mr-1" />
                            Exit
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedVisitor(selectedVisitor?._id === v._id ? null : v)}
                          className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary transition-all"
                        >
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

      {/* Selected Visitor Details */}
      {selectedVisitor && (
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Visitor Details</h3>
            <button onClick={() => setSelectedVisitor(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="text-xs text-gray-500 block">Visitor Name</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedVisitor.visitorName}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="text-xs text-gray-500 block">Phone</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedVisitor.phoneNumber}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="text-xs text-gray-500 block">Visitor Type</span>
                <span className="font-medium text-gray-900 dark:text-white">{VISITOR_TYPES.find(t => t.key === selectedVisitor.visitorType)?.label || selectedVisitor.visitorType}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="text-xs text-gray-500 block">Resident</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedVisitor.residentName}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="text-xs text-gray-500 block">Flat</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedVisitor.block} - {selectedVisitor.flatNumber}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="text-xs text-gray-500 block">Expected Date</span>
                <span className="font-medium text-gray-900 dark:text-white">{new Date(selectedVisitor.expectedDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          {selectedVisitor.vehicleNumber && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
              <span className="text-xs text-gray-500 block">Vehicle</span>
              <span className="font-medium text-gray-900 dark:text-white">{selectedVisitor.vehicleNumber}</span>
            </div>
          )}
          {selectedVisitor.notes && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
              <span className="text-xs text-gray-500 block">Notes</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{selectedVisitor.notes}</span>
            </div>
)}
        </div>
      )}

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
          workerId={workerId}
        />
      )}

      {/* Scan Loading Overlay */}
      {scanLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-200 dark:border-gray-800 shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-gray-900 dark:text-white font-medium">Processing...</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Verifying visitor details</p>
          </div>
        </div>
      )}

      {/* Scan Confirm Modal */}
      {scannedVisitor && (
        <ScanConfirmModal
          visitor={scannedVisitor}
          action={scanAction}
          message={scanMessage}
          loading={scanLoading}
          onAllowEntry={handleAllowEntry}
          onRejectEntry={handleRejectEntry}
          onMarkExit={handleMarkExit}
          onClose={() => {
            setScannedVisitor(null);
            setScanAction(null);
            setScanMessage('');
          }}
        />
      )}
    </div>
  );
};

export default VisitorSecurityDashboard;
