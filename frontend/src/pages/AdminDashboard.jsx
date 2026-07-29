import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, CheckCircle, Clock, Trash2, Wrench, XCircle, UserCheck, UserX, Search, ToggleLeft, ToggleRight, Star, Shield, User, Phone, Mail, Briefcase, Filter } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import { connectAsRole } from '../services/socket';
import { API_BASE_URL } from '../config/api';



const AdminDashboard = () => {
  const [complaints, setComplaints] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [mapImage, setMapImage] = useState(null);
  const [uploadingMap, setUploadingMap] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [workers, setWorkers] = useState([]);

  // Pending resident requests (Spirit 3)
  const [pendingResidents, setPendingResidents] = useState([]);
  const [pendingResidentsLoading, setPendingResidentsLoading] = useState(false);
  const [pendingResidentsError, setPendingResidentsError] = useState('');
  const [pendingResidentsActionBusy, setPendingResidentsActionBusy] = useState(null);

  const [adminFlashMessage, setAdminFlashMessage] = useState('');

  // Worker Management State
  const [allWorkers, setAllWorkers] = useState([]);
  const [allWorkersLoading, setAllWorkersLoading] = useState(false);
  const [workerAnalytics, setWorkerAnalytics] = useState(null);
  const [workerFilter, setWorkerFilter] = useState('All');
  const [workerSearch, setWorkerSearch] = useState('');
  const [workerActionBusy, setWorkerActionBusy] = useState(null);

  const navigate = useNavigate();

  const getAdminHeaders = () => {
    const raw = localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;

    const xAdminId = user?.id || user?._id;
    const xCommunityId = user?.communityId || user?.communityID || user?.community_id;

    if (!xAdminId || !xCommunityId) {
      return { headers: null, error: 'Missing admin identity. Please login again.' };
    }

    return {
      headers: {
        'x-admin-id': String(xAdminId),
        'x-community-id': String(xCommunityId),
      },
      error: null,
    };
  };

  const formatRegistrationDate = (req) => {
    const v = req?.registrationDate ?? req?.createdAt ?? req?.updatedAt;
    if (!v) return 'N/A';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  };

  const fetchComplaints = async () => {
    try {
      const { headers, error } = getAdminHeaders();
      if (error || !headers) {
        throw new Error(error || 'Missing admin identity.');
      }

      const res = await axios.get(`${API_BASE_URL}/complaints`, { headers });
      if (res.data.success) {
        setComplaints(res.data.complaints);
      }
    } catch (error) {
      console.error('Error fetching complaints', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { headers, error } = getAdminHeaders();
      if (error || !headers) {
        throw new Error(error || 'Missing admin identity.');
      }

      const res = await axios.get(
        `${API_BASE_URL}/notifications?targetRole=admin`,
        { headers }
      );
      if (res.data.success) {
        setNotifications(res.data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications', error);
    }
  };

  const fetchWorkers = async () => {
    try {
      const { headers, error } = getAdminHeaders();
      if (error || !headers) {
        throw new Error(error || 'Missing admin identity.');
      }

      // Use communityId scoping for worker list
      const res = await axios.get(`${API_BASE_URL}/workers`, { headers });
      if (res.data.success) {
        setWorkers(res.data.workers || []);
      }
    } catch (error) {
      console.error('Error fetching workers', error);
    }
  };

  const fetchPendingResidentRequests = async () => {
    const { headers, error } = getAdminHeaders();
    if (error) {
      setPendingResidentsError(error);
      setPendingResidents([]);
      return;
    }

    setPendingResidentsLoading(true);
    setPendingResidentsError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/resident-requests`, { headers });

      if (res.data?.success) {
        setPendingResidents(res.data.requests || []);
      } else {
        setPendingResidents([]);
        setPendingResidentsError(res.data?.message || 'Failed to fetch pending requests');
      }
    } catch (e) {
      console.error('fetchPendingResidentRequests error:', e);
      setPendingResidents([]);
      setPendingResidentsError(e?.response?.data?.message || 'Failed to fetch pending requests');
    } finally {
      setPendingResidentsLoading(false);
    }
  };

  const unreadCount = notifications.reduce((acc, n) => acc + (n?.read ? 0 : 1), 0);

  const handleMarkRead = async (id) => {
    if (!id) return;
    try {
      const { headers, error } = getAdminHeaders();
      if (error || !headers) throw new Error(error || 'Missing admin identity.');
      const res = await axios.put(
        `${API_BASE_URL}/notifications/${id}/read`,
        {},
        { headers }
      );
      if (res.data.success) {
        setNotifications((prev) => prev.map((n) => (n?._id === id || n?.id === id ? res.data.notification : n)));
      }
    } catch (error) {
      console.error('Error marking notification read', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const { headers, error } = getAdminHeaders();
      if (error || !headers) throw new Error(error || 'Missing admin identity.');
      const res = await axios.put(
        `${API_BASE_URL}/notifications/read-all?targetRole=admin`,
        {},
        { headers }
      );
      if (res.data.success) {
        setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true, readAt: new Date().toISOString() })));
      }
    } catch (error) {
      console.error('Error marking all notifications read', error);
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData || JSON.parse(userData).role !== 'admin') {
      navigate('/login');
      return;
    }

    // Defer async calls and keep setState calls inside the async chain
    // to avoid react-hooks/set-state-in-effect lint errors.
    const run = async () => {
      try {
        await Promise.all([
          fetchComplaints(),
          fetchNotifications(),
          fetchWorkers(),
          fetchPendingResidentRequests(),
          fetchAllWorkers(),
          fetchWorkerAnalytics(),
        ]);
      } catch {
        // ignore; errors already logged in fetch functions
      }
    };

    run();

    const socket = connectAsRole('admin', JSON.parse(localStorage.getItem('user') || '{}')?.communityId);


    console.log('🔌 [frontend] connecting as admin via socket');
    console.log('🔌 [frontend] socket connected?', socket.connected);

    socket.on('connect', () => {
      console.log('✅ [frontend] socket connected:', socket.id);
    });

    socket.on('notification:new', (notification) => {
      console.log('📩 [frontend] notification:new received:', {
        notificationId: notification?._id || notification?.id,
        targetRole: notification?.targetRole
      });

      setNotifications((prev) => {
        const key = notification?._id || notification?.id;
        if (!key) return [notification, ...prev];
        if (prev.some((n) => (n?._id || n?.id) === key)) return prev;
        return [notification, ...prev];
      });
    });

    return () => {
      socket.off('notification:new');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);



  const approveRejectResident = async (requestId, action) => {
    const { headers, error } = getAdminHeaders();
    if (error) {
      setPendingResidentsError(error);
      return;
    }

    setAdminFlashMessage('');
    setPendingResidentsActionBusy(requestId);

    try {
      const endpoint = `${API_BASE_URL}/admin/resident-requests/${requestId}/${action}`;
      const res = await axios.put(endpoint, {}, { headers });

      if (res.data?.success) {
        setAdminFlashMessage(action === 'approve' ? 'Resident approved successfully.' : 'Resident rejected successfully.');
        await fetchPendingResidentRequests();
      } else {
        setPendingResidentsError(res.data?.message || 'Action failed');
      }
    } catch (e) {
      console.error(`approveRejectResident (${action}) error:`, e);
      setPendingResidentsError(e?.response?.data?.message || 'Action failed');
    } finally {
      setPendingResidentsActionBusy(null);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      const { headers, error } = getAdminHeaders();
      if (error || !headers) throw new Error(error || 'Missing admin identity.');
      const res = await axios.put(`${API_BASE_URL}/complaints/${id}`, data, { headers });
      if (res.data.success) {
        fetchComplaints();
      }
    } catch (error) {
      console.error('Error updating complaint', error);
      alert('Failed to update complaint');
    }
  };

  const handleAssignWorker = async (complaintId, workerId) => {
    // workerId is required by the new route; fallback to legacy update if missing
    if (!workerId) {
      return handleUpdate(complaintId, { assignedWorker: null, status: 'Submitted' });
    }

    try {
      const { headers, error } = getAdminHeaders();
      if (error || !headers) throw new Error(error || 'Missing admin identity.');
      const res = await axios.put(
        `${API_BASE_URL}/complaints/${complaintId}/assign`,
        {
          workerId,
          assignedBy: JSON.parse(localStorage.getItem('user') || '{}')?.name || 'Admin',
          assignmentStatus: 'Assigned'
        },
        { headers }
      );
      if (res.data.success) {
        fetchComplaints();
      }
    } catch (error) {
      console.error('Error assigning worker', error);
      alert('Failed to assign worker');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this complaint? This action cannot be undone.')) {
      return;
    }
    try {
      const { headers, error } = getAdminHeaders();
      if (error || !headers) throw new Error(error || 'Missing admin identity.');
      const res = await axios.delete(`${API_BASE_URL}/complaints/${id}`, { headers });
      if (res.data.success) {
        fetchComplaints();
      }
    } catch (error) {
      console.error('Error deleting complaint', error);
      alert('Failed to delete complaint');
    }
  };

  const handleMapUpload = async (e) => {
    e.preventDefault();
    if (!mapImage) return;
    setUploadingMap(true);
    const formData = new FormData();
    formData.append('mapImage', mapImage);
    try {
      const { headers, error } = getAdminHeaders();
      if (error || !headers) throw new Error(error || 'Missing admin identity.');
      const res = await axios.post(`${API_BASE_URL}/settings/map`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        alert('Community Map uploaded successfully!');
        setMapImage(null);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to upload map');
    } finally {
      setUploadingMap(false);
    }
  };

  // Worker Management Handlers
  const fetchAllWorkers = async () => {
    const { headers, error } = getAdminHeaders();
    if (error || !headers) return;
    setAllWorkersLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/workers/all?status=${workerFilter}&search=${encodeURIComponent(workerSearch)}`, { headers });
      if (res.data.success) {
        setAllWorkers(res.data.workers || []);
      }
    } catch (err) {
      console.error('Error fetching all workers', err);
    } finally {
      setAllWorkersLoading(false);
    }
  };

  const fetchWorkerAnalytics = async () => {
    const { headers, error } = getAdminHeaders();
    if (error || !headers) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/workers/analytics/summary`, { headers });
      if (res.data.success) {
        setWorkerAnalytics(res.data.analytics);
      }
    } catch (err) {
      console.error('Error fetching worker analytics', err);
    }
  };

  const handleWorkerStatus = async (workerId, status) => {
    const { headers, error } = getAdminHeaders();
    if (error || !headers) return;
    setWorkerActionBusy(workerId);
    try {
      const reason = status === 'Rejected' ? prompt('Enter rejection reason (optional):') : '';
      await axios.put(
        `${API_BASE_URL}/workers/${workerId}/status`,
        { status, rejectionReason: reason || '' },
        { headers }
      );
      await fetchAllWorkers();
      await fetchWorkerAnalytics();
    } catch (err) {
      console.error('Error updating worker status', err);
      alert('Failed to update worker status');
    } finally {
      setWorkerActionBusy(null);
    }
  };

  const handleWorkerDelete = async (workerId) => {
    if (!confirm('Are you sure you want to delete this worker? This action cannot be undone.')) return;
    const { headers, error } = getAdminHeaders();
    if (error || !headers) return;
    try {
      await axios.delete(`${API_BASE_URL}/workers/${workerId}`, { headers });
      await fetchAllWorkers();
      await fetchWorkerAnalytics();
    } catch (err) {
      console.error('Error deleting worker', err);
      alert('Failed to delete worker');
    }
  };

  // Compute filtered workers based on status and search
  const filteredWorkers = allWorkers.filter(w => {
    const matchesStatus = workerFilter === 'All' || w.status === workerFilter;
    const searchLower = workerSearch.toLowerCase();
    const matchesSearch = !searchLower || 
      w.name?.toLowerCase().includes(searchLower) ||
      w.email?.toLowerCase().includes(searchLower) ||
      w.mobileNumber?.includes(searchLower) ||
      w.profession?.toLowerCase().includes(searchLower) ||
      (w.skills || []).some(s => s.toLowerCase().includes(searchLower));
    return matchesStatus && matchesSearch;
  });

  const getAnalytics = () => {
    const total = complaints.length;
    const completed = complaints.filter(c => c.status === 'Completed').length;
    const pending = total - completed;
    return { total, completed, pending };
  };

  const filteredComplaints = complaints.filter(c => {
    if (filter === 'All') return true;
    if (filter === 'Completed') return c.status === 'Completed';
    return c.status !== 'Completed'; // Pending / In Progress
  });

  const { total, completed, pending } = getAnalytics();

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Admin Dashboard...</div>;

  return (
    <div className="space-y-6 animate-fade-in transition-colors duration-300">
      {/* Header Panel */}
      <div className="flex justify-between items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 relative overflow-hidden group transition-colors">
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] group-hover:bg-primary/20 transition-all"></div>
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">Admin Dashboard - {JSON.parse(localStorage.getItem('user') || '{}')?.communityName || 'Your Society'}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">Welcome to {JSON.parse(localStorage.getItem('user') || '{}')?.communityName || 'Your Society'}</p>

        </div>

        <div className="relative z-10 flex items-center gap-3">
          <NotificationBell
            targetRoleLabel="Admin"
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
          />

          <button 
            onClick={() => { localStorage.removeItem('user'); navigate('/login'); }}
            className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-900/50 px-4 py-2 rounded-xl transition-all"
          >
            Logout
          </button>
        </div>
      </div>


      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-800 flex items-center relative overflow-hidden transition-colors">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/10 dark:bg-primary/5 rounded-full blur-2xl"></div>
          <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mr-5 shadow-sm dark:shadow-lg">
            <BarChart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1 transition-colors">Total Logs</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white transition-colors">{total}</p>
          </div>
        </div>
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-800 flex items-center relative overflow-hidden transition-colors">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-yellow-500/10 dark:bg-yellow-500/5 rounded-full blur-2xl"></div>
          <div className="w-14 h-14 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-2xl flex items-center justify-center mr-5 shadow-sm dark:shadow-lg">
            <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1 transition-colors">Pending Task</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white transition-colors">{pending}</p>
          </div>
        </div>
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-800 flex items-center relative overflow-hidden transition-colors">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-green-500/10 dark:bg-green-500/5 rounded-full blur-2xl"></div>
          <div className="w-14 h-14 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl flex items-center justify-center mr-5 shadow-sm dark:shadow-lg">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1 transition-colors">Resolved</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white transition-colors">{completed}</p>
          </div>
        </div>
      </div>

      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 dark:bg-gray-900/40 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-0 transition-colors">Complaint Registry</h2>
          <div className="relative">
            <select 
              className="appearance-none bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm rounded-xl pl-4 pr-10 py-2 outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="All">All Complaints</option>
              <option value="Pending">Pending / WIP</option>
              <option value="Completed">Completed</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300 transition-colors">
            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800 tracking-wider transition-colors">
              <tr>
                <th className="px-6 py-4 font-medium">ID / Date</th>
                <th className="px-6 py-4 font-medium">Resident</th>
                <th className="px-6 py-4 font-medium">Complaint</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 transition-colors">
              {filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center mb-2"><CheckCircle className="w-8 h-8 opacity-20" /></div>
                    No records found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredComplaints.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded text-xs block mb-1 w-max">#{c.id.substring(c.id.length - 6)}</span>
                      <span className="text-xs text-gray-500">{new Date(c.date).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900 dark:text-gray-200 block transition-colors">{c.userName}</span>
                      <span className="text-xs text-gray-500 mt-0.5 block">Flat: {c.flatNumber}</span>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <p className="truncate text-gray-700 dark:text-gray-300 transition-colors" title={c.text}>{c.text || <span className="italic text-gray-400 dark:text-gray-500">Attachment Provided</span>}</p>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary w-full max-w-[130px] transition-colors"
                        value={c.status}
                        onChange={(e) => handleUpdate(c.id, { status: e.target.value })}
                      >
                        <option value="Submitted">Submitted</option>
                        <option value="Verified">Verified</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Assigned to Worker">Assigned to Worker</option>
                        <option value="Work In Progress">WIP</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </td>
<td className="px-6 py-4 space-y-2">
                      <select
                        className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary transition-colors"
                        value={c.assignment?.workerId || '' }
                        onChange={(e) => handleAssignWorker(c.id, e.target.value)}
                      >
                        <option value="">Unassigned...</option>
                        {workers.map((w) => (
                          <option key={w._id || w.id} value={w._id || w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                      <input 
                        type="text" 
                        placeholder="Admin Remarks..." 
                        className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-colors focus:bg-gray-50 dark:focus:bg-gray-900"
                        defaultValue={c.adminRemarks}
                        onBlur={(e) => {
                          if (e.target.value !== c.adminRemarks) {
                            handleUpdate(c.id, { adminRemarks: e.target.value });
                          }
                        }}
                      />
                      <button 
                        onClick={() => handleDelete(c.id)}
                        className="w-full flex items-center justify-center py-1.5 px-2 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-xs font-medium transition-all"
                      >
                        <Trash2 className="w-3 h-3 mr-1.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Resident Requests (Spirit 3) */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 transition-colors flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 dark:bg-gray-900/40">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors mb-3 sm:mb-0">
            Pending Resident Requests
          </h2>

          {adminFlashMessage ? (
            <div className="text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-2 rounded-xl transition-colors">
              {adminFlashMessage}
            </div>
          ) : null}
        </div>

        <div className="p-6">
          {pendingResidentsLoading ? (
            <div className="text-center py-10 text-gray-500">Loading pending requests...</div>
          ) : pendingResidentsError ? (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
              {pendingResidentsError}
            </div>
          ) : pendingResidents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No pending resident requests.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300 transition-colors">
                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800 tracking-wider transition-colors">
                  <tr>
                    <th className="px-4 py-3 font-medium">Full Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Block</th>
                    <th className="px-4 py-3 font-medium">Flat Number</th>
                    <th className="px-4 py-3 font-medium">Registration Date</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 transition-colors">
                  {pendingResidents.map((r) => {
                    const requestId = r.requestId || r._id || r.id;
                    return (
                      <tr key={String(requestId)}>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200 transition-colors">
                          {r.fullName}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 transition-colors">
                          {r.email}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 transition-colors">
                          {r.phone}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 transition-colors">
                          {r.block}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 transition-colors">
                          {r.flatNumber}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 transition-colors">
                          {formatRegistrationDate(r)}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 transition-colors">
                          {r.status}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              onClick={() => approveRejectResident(requestId, 'approve')}
                              disabled={pendingResidentsActionBusy === requestId}
                              className="px-3 py-2 text-xs font-semibold bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-xl transition-all disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => approveRejectResident(requestId, 'reject')}
                              disabled={pendingResidentsActionBusy === requestId}
                              className="px-3 py-2 text-xs font-semibold bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl transition-all disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Worker Management Section */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 dark:bg-gray-900/40 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-0 flex items-center transition-colors">
            <Wrench className="w-5 h-5 text-primary mr-2" />
            Worker Management
          </h2>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search workers..."
                value={workerSearch}
                onChange={(e) => setWorkerSearch(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-sm rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600"
              />
            </div>
            {/* Status Filter */}
            <select
              value={workerFilter}
              onChange={(e) => setWorkerFilter(e.target.value)}
              className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary transition-all"
            >
              <option value="All">All Workers</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Suspended">Suspended</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Analytics Summary */}
        {workerAnalytics && (
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3 p-4 border-b border-gray-100 dark:border-gray-800/50">
            <div className="text-center p-2 rounded-xl bg-gray-50 dark:bg-gray-950/30">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{workerAnalytics.total}</p>
              <p className="text-[10px] text-gray-500 uppercase">Total</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/10">
              <p className="text-lg font-bold text-yellow-600">{workerAnalytics.pending}</p>
              <p className="text-[10px] text-yellow-600 uppercase">Pending</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-green-50 dark:bg-green-900/10">
              <p className="text-lg font-bold text-green-600">{workerAnalytics.approved}</p>
              <p className="text-[10px] text-green-600 uppercase">Approved</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-blue-50 dark:bg-blue-900/10">
              <p className="text-lg font-bold text-blue-600">{workerAnalytics.available}</p>
              <p className="text-[10px] text-blue-600 uppercase">Available</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-red-50 dark:bg-red-900/10">
              <p className="text-lg font-bold text-red-600">{workerAnalytics.suspended}</p>
              <p className="text-[10px] text-red-600 uppercase">Suspended</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-gray-50 dark:bg-gray-950/30">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{workerAnalytics.rejected}</p>
              <p className="text-[10px] text-gray-500 uppercase">Rejected</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-purple-50 dark:bg-purple-900/10">
              <p className="text-lg font-bold text-purple-600">{workerAnalytics.totalCompletedJobs}</p>
              <p className="text-[10px] text-purple-600 uppercase">Jobs Done</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300 transition-colors">
            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800 tracking-wider transition-colors">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Skills</th>
                <th className="px-4 py-3 font-medium">Experience</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Availability</th>
                <th className="px-4 py-3 font-medium">Active Jobs</th>
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 transition-colors">
              {allWorkersLoading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">Loading workers...</td>
                </tr>
              ) : filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    <Wrench className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    No workers found.
                  </td>
                </tr>
              ) : (
                filteredWorkers.map((w) => (
                  <tr key={w._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {w.profilePhoto ? (
                          <img
                            src={`${API_BASE_URL.replace('/api', '')}/uploads/${w.profilePhoto}`}
                            alt={w.name}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-gray-900 dark:text-gray-200 block">{w.name}</span>
                          <span className="text-xs text-gray-500">{w.profession}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(w.skills || []).slice(0, 3).map((skill, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-primary/5 border border-primary/10 rounded text-[10px] text-primary">
                            {skill}
                          </span>
                        ))}
                        {(w.skills || []).length > 3 && <span className="text-[10px] text-gray-400">+{w.skills.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs">{w.experience || '-'}</td>
                    <td className="px-4 py-4">
                      <div className="text-xs space-y-0.5">
                        <div className="flex items-center"><Phone className="w-3 h-3 mr-1 text-gray-400" />{w.mobileNumber}</div>
                        <div className="flex items-center"><Mail className="w-3 h-3 mr-1 text-gray-400" />{w.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        w.status === 'Approved' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800' :
                        w.status === 'Pending' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800' :
                        w.status === 'Suspended' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800' :
                        w.status === 'Rejected' ? 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800' :
                        'bg-gray-50 dark:bg-gray-900/20 text-gray-600'
                      }`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-medium ${
                        w.availability === 'Available' ? 'text-green-600' : w.availability === 'Busy' ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {w.availability || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-xs font-medium">{w.currentActiveJobs || 0}</td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-xs">
                        {w.rating ? <><Star className="w-3 h-3 text-yellow-500" />{w.rating.toFixed(1)}</> : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {w.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => handleWorkerStatus(w._id, 'Approved')}
                              disabled={workerActionBusy === w._id}
                              className="px-2 py-1 text-xs font-semibold bg-green-50 dark:bg-green-950/30 hover:bg-green-100 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-lg transition-all disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleWorkerStatus(w._id, 'Rejected')}
                              disabled={workerActionBusy === w._id}
                              className="px-2 py-1 text-xs font-semibold bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg transition-all disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {w.status === 'Approved' && (
                          <button
                            onClick={() => handleWorkerStatus(w._id, 'Suspended')}
                            disabled={workerActionBusy === w._id}
                            className="px-2 py-1 text-xs font-semibold bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg transition-all disabled:opacity-60"
                          >
                            Suspend
                          </button>
                        )}
                        {w.status === 'Suspended' && (
                          <button
                            onClick={() => handleWorkerStatus(w._id, 'Approved')}
                            disabled={workerActionBusy === w._id}
                            className="px-2 py-1 text-xs font-semibold bg-green-50 dark:bg-green-950/30 hover:bg-green-100 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-lg transition-all disabled:opacity-60"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleWorkerDelete(w._id)}
                          className="px-2 py-1 text-xs font-semibold bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Top Workers */}
        {workerAnalytics?.topWorkers && workerAnalytics.topWorkers.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">🏆 Top Performing Workers</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {workerAnalytics.topWorkers.map((tw, idx) => (
                <div key={tw.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950/30 rounded-xl border border-gray-200 dark:border-gray-800">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tw.name}</p>
                    <p className="text-xs text-gray-500">{tw.completedJobs} jobs • {tw.rating ? `${tw.rating.toFixed(1)} ★` : 'No rating'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* System Configuration */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 transition-colors">System Configuration</h2>
        
        <form onSubmit={handleMapUpload} className="max-w-md space-y-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Update Community Master Plan (Map)</label>
          <div className="flex space-x-3">
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setMapImage(e.target.files[0])}
              className="flex-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all dark:text-gray-400"
            />
            <button
              type="submit"
              disabled={uploadingMap || !mapImage}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl font-medium transition-all disabled:opacity-50"
            >
              {uploadingMap ? 'Uploading...' : 'Save Map'}
            </button>
          </div>
        </form>
      </div>


    </div>
  );
};

export default AdminDashboard;
