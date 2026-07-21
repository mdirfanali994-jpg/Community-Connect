import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, CheckCircle, Clock, Trash2 } from 'lucide-react';
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
        `https://community-connect-backend-wqwc.onrender.com/api/notifications/${id}/read`,
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
        `https://community-connect-backend-wqwc.onrender.com/api/notifications/read-all?targetRole=admin`,
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
        `https://community-connect-backend-wqwc.onrender.com/api/complaints/${complaintId}/assign`,
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
      const res = await axios.delete(`https://community-connect-backend-wqwc.onrender.com/api/complaints/${id}`, { headers });
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
      const res = await axios.post('https://community-connect-backend-wqwc.onrender.com/api/settings/map', formData, {
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
