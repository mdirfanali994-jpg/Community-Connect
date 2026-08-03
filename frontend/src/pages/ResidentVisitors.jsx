import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  UserPlus,
  Phone,
  Calendar,
  Clock,
  X,
  Eye,
  QrCode,
  Copy
} from 'lucide-react';

import QRCode from "react-qr-code";

import { API_BASE_URL } from '../config/api';
import { VISITOR_TYPES, VISITOR_STATUS_COLORS, VISITOR_STATUS_LABELS } from '../components/visitor/visitorConstants';
const initialForm = {
  visitorName: '',
  phoneNumber: '',
  visitorType: 'guest',
  vehicleNumber: '',
  purpose: '',
  expectedDate: '',
  expectedTime: '',
  duration: '',
  notes: '',
};

const ResidentVisitors = () => {
  const [user, setUser] = useState(null);
  const [visitors, setVisitors] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [form, setForm] = useState({ ...initialForm });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [pass, setPass] = useState(null);
  const [passLoading, setPassLoading] = useState(false);
  const [flashMsg, setFlashMsg] = useState('');
  const [flashType, setFlashType] = useState('success');
  const navigate = useNavigate();

  const showFlash = useCallback((msg, type = 'success') => {
    setFlashMsg(msg);
    setFlashType(type);
    setTimeout(() => setFlashMsg(''), 4000);
  }, []);

  const fetchVisitors = useCallback(async (uid) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/visitors/my?userId=${uid}&status=${filter}`);
      if (res.data.success) {
        setVisitors(res.data.visitors);
      }
    } catch (err) {
      console.error('fetchVisitors error:', err);
    }
  }, [filter]);

  const fetchUpcoming = useCallback(async (uid) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/visitors/upcoming?userId=${uid}`);
      if (res.data.success) {
        setUpcoming(res.data.visitors);
      }
    } catch (err) {
      console.error('fetchUpcoming error:', err);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { navigate('/login'); return; }
    const parsed = JSON.parse(raw);
    if (parsed.role !== 'resident') { navigate('/login'); return; }
    setUser(parsed);
    const uid = parsed.id;
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchVisitors(uid), fetchUpcoming(uid)]);
      setLoading(false);
    };
    load();
  }, [navigate, fetchVisitors, fetchUpcoming]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.visitorName || !form.phoneNumber || !form.expectedDate) {
      showFlash('Visitor name, phone, and expected date are required', 'error');
      return;
    }
     setSubmitting(true);
     try {
       console.log("Logged in user:", user);
       console.log("User ID:", user?.id);

      const res = await axios.post(`${API_BASE_URL}/visitors`, {
         ...form,
         userId: user.id,
       });
      if (res.data.success) {
        showFlash('Visitor invited successfully!');
        setForm({ ...initialForm });
        setShowForm(false);
        await Promise.all([fetchVisitors(user.id), fetchUpcoming(user.id)]);
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Failed to invite visitor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (visitorId) => {
    if (!confirm('Cancel this visitor invitation?')) return;
    try {
      const res = await axios.put(`${API_BASE_URL}/visitors/${visitorId}/cancel`, {
        userId: user.id,
        reason: 'Cancelled by resident',
      });
      if (res.data.success) {
        showFlash('Visitor cancelled');
        await Promise.all([fetchVisitors(user.id), fetchUpcoming(user.id)]);
      }
    } catch (err) {
      showFlash('Failed to cancel', 'error');
    }
  };

  const handleApprove = async (visitorId) => {
    try {
      const res = await axios.put(`${API_BASE_URL}/visitors/${visitorId}/approve`, {
        userId: user.id,
      });
      if (res.data.success) {
        showFlash('Visitor approved for entry');
        await Promise.all([fetchVisitors(user.id), fetchUpcoming(user.id)]);
      }
    } catch (err) {
      showFlash('Failed to approve', 'error');
    }
  };

  const handleViewPass = async (visitorId) => {
    setPassLoading(true);
    setShowPass(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/visitors/${visitorId}/pass?userId=${user.id}`);
      if (res.data.success) {
        setPass(res.data.pass);
      }
    } catch (err) {
      showFlash('Failed to load pass', 'error');
      setShowPass(false);
    } finally {
      setPassLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => showFlash('Copied to clipboard!'));
  };

  const getStatusBadge = (status) => {
    const cls = VISITOR_STATUS_COLORS[status] || 'bg-gray-50 dark:bg-gray-900/20 text-gray-600';
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
        {VISITOR_STATUS_LABELS[status] || status}
      </span>
    );
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Visitors...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Visitor Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Invite and manage your visitors</p>
        </div>
        <div className="relative z-10 flex items-center gap-3 mt-3 sm:mt-0">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {showForm ? 'Close' : 'Invite Visitor'}
          </button>
        </div>
      </div>

      {flashMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium border transition-all ${
          flashType === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' :
          'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
        }`}>
          {flashMsg}
        </div>
      )}

      {/* Invite Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Invite a Visitor</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Visitor Name *</label>
              <input
                value={form.visitorName}
                onChange={(e) => setForm({ ...form, visitorName: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Phone Number *</label>
              <input
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="+91 9876543210"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Visitor Type *</label>
              <select
                value={form.visitorType}
                onChange={(e) => setForm({ ...form, visitorType: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              >
                {VISITOR_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Expected Date *</label>
              <input
                type="date"
                value={form.expectedDate}
                onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Expected Time</label>
              <input
                type="time"
                value={form.expectedTime}
                onChange={(e) => setForm({ ...form, expectedTime: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Vehicle Number</label>
              <input
                value={form.vehicleNumber}
                onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="KA-01-AB-1234"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Duration</label>
              <input
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. 2 hours"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Purpose</label>
              <input
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Brief purpose"
              />
            </div>
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-medium text-gray-500">Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                placeholder="Any special instructions for security..."
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          >
            {submitting ? 'Inviting...' : 'Send Invitation'}
          </button>
        </form>
      )}

      {/* Upcoming Visitors */}
      {upcoming.length > 0 && (
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-primary" />
            Upcoming Visitors
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcoming.map((v) => (
              <div key={v._id} className="p-4 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">{v.visitorName}</span>
                  {getStatusBadge(v.status)}
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex items-center"><Phone className="w-3 h-3 mr-1" />{v.phoneNumber}</div>
                  <div className="flex items-center"><Calendar className="w-3 h-3 mr-1" />{new Date(v.expectedDate).toLocaleDateString()}</div>
                  {v.expectedTime && <div className="flex items-center"><Clock className="w-3 h-3 mr-1" />{v.expectedTime}</div>}
                </div>
                <div className="flex gap-2 mt-3">
                  {v.status === 'arrived' && v.approvalStatus === 'pending' && (
                    <button onClick={() => handleApprove(v._id)} className="flex-1 py-1.5 text-xs font-semibold bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg">
                      Approve Entry
                    </button>
                  )}
                  <button onClick={() => handleViewPass(v._id)} className="px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-lg">
                    <QrCode className="w-3 h-3 inline mr-1" />Pass
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visitor History */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Visitor History</h3>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-sm rounded-xl px-3 py-1.5 outline-none"
          >
            <option value="all">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="arrived">Arrived</option>
            <option value="entered">Entered</option>
            <option value="exited">Exited</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left">Visitor</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {visitors.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-gray-500">No visitors found.</td>
                </tr>
              ) : (
                visitors.map((v) => (
                  <tr key={v._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-gray-200 block">{v.visitorName}</span>
                      <span className="text-xs text-gray-500">{v.phoneNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{VISITOR_TYPES.find(t => t.key === v.visitorType)?.label || v.visitorType}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(v.expectedDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{getStatusBadge(v.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => handleViewPass(v._id)} className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary" title="View Pass">
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        {v.status === 'scheduled' && (
                          <button onClick={() => handleCancel(v._id)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-600" title="Cancel">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => setSelectedVisitor(selectedVisitor?._id === v._id ? null : v)} className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary" title="Details">
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

      {/* Pass Modal */}
      {showPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                  <QrCode className="w-5 h-5 mr-2 text-primary" />
                  Visitor Pass
                </h3>
                <button onClick={() => setShowPass(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {passLoading ? (
                <div className="text-center py-10 text-gray-500 animate-pulse">Loading pass...</div>
              ) : pass ? (
                <div className="space-y-4">
               {/* QR Code */}
              <div className="flex justify-center p-4">
                <div className="bg-white p-3 rounded-xl shadow-lg">
                 <QRCode
                  value={pass.qrPayload || ""}
                  size={180}
                />
                </div>
             </div>
  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-950/50 rounded-lg">
                      <span className="text-gray-500">Visitor ID</span>
                      <span className="font-mono font-medium text-gray-900 dark:text-white">{pass.visitorId}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-950/50 rounded-lg">
                      <span className="text-gray-500">Name</span>
                      <span className="font-medium text-gray-900 dark:text-white">{pass.visitorName}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-950/50 rounded-lg">
                      <span className="text-gray-500">OTP</span>
                      <span className="font-mono font-bold text-xl text-primary">{pass.otp}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-950/50 rounded-lg">
                      <span className="text-gray-500">OTP Expires</span>
                      <span className="text-xs text-gray-500">{pass.otpExpiresAt ? new Date(pass.otpExpiresAt).toLocaleTimeString() : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-950/50 rounded-lg">
                      <span className="text-gray-500">Flat</span>
                      <span className="font-medium text-gray-900 dark:text-white">{pass.block} - {pass.flatNumber}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-950/50 rounded-lg">
                      <span className="text-gray-500">Status</span>
                      {getStatusBadge(pass.status)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => copyToClipboard(pass.otp)} className="flex-1 flex items-center justify-center py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-medium hover:bg-primary/20 transition-all">
                      <Copy className="w-4 h-4 mr-1.5" />
                      Copy OTP
                    </button>
                    <button onClick={() => copyToClipboard(pass.qrPayload)} className="flex-1 flex items-center justify-center py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                      <Copy className="w-4 h-4 mr-1.5" />
                      Copy QR
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentVisitors;
