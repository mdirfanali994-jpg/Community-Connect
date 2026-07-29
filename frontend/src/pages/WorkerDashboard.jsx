import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Briefcase, CheckCircle, Clock, AlertCircle, CheckSquare,
  ChevronRight, User, Wrench, MapPin, Calendar, FileText,
  Activity, Star, ThumbsUp, Play, Send, XCircle, ToggleLeft, ToggleRight
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const STATUS_STYLES = {
  'Assigned': 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  'Accepted': 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
  'Work In Progress': 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  'In Progress': 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  'Completed': 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
  'Closed': 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800',
  'Submitted': 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  'Verified': 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800',
};

const WorkerDashboard = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [workerData, setWorkerData] = useState(null);
  const [availability, setAvailability] = useState('Available');
  const [actionLoading, setActionLoading] = useState(null);
  const navigate = useNavigate();

  const getWorkerId = () => {
    const parsed = JSON.parse(localStorage.getItem('user') || '{}');
    return parsed?.workerId || parsed?._id || parsed?.id || null;
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData || JSON.parse(userData).role !== 'worker') {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    fetchWorkerData();
    fetchComplaints();
  }, [navigate]);

  const fetchWorkerData = async () => {
    try {
      const workerId = getWorkerId();
      if (!workerId) return;
      const res = await axios.get(
        `${API_BASE_URL}/workers/${workerId}`
      );
      if (res.data.success) {
        setWorkerData(res.data.worker);
        setAvailability(res.data.worker.availability || 'Available');
      }
    } catch (err) {
      console.error('Error fetching worker data', err);
    }
  };

  const fetchComplaints = async () => {
    try {
      const workerId = getWorkerId();
      if (!workerId) return;

      const res = await axios.get(
        `${API_BASE_URL}/workers/${workerId}/complaints`
      );
      if (res.data.success) {
        setComplaints(res.data.complaints);
      }
    } catch (error) {
      console.error('Error fetching complaints', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async () => {
    const workerId = getWorkerId();
    const newAvail = availability === 'Available' ? 'Busy' : 'Available';
    try {
      await axios.put(
        `${API_BASE_URL}/workers/${workerId}/availability`,
        { availability: newAvail }
      );
      setAvailability(newAvail);
    } catch (err) {
      console.error('Error toggling availability', err);
    }
  };

  const handleAction = async (complaintId, action, extra = {}) => {
    setActionLoading(complaintId);
    try {
      const workerId = getWorkerId();
      const endpoints = {
        accept: `${API_BASE_URL}/complaints/${complaintId}/accept`,
        start: `${API_BASE_URL}/complaints/${complaintId}/start`,
        'in-progress': `${API_BASE_URL}/complaints/${complaintId}/in-progress`,
      };

      const res = await axios.put(endpoints[action], { workerId, ...extra });
      if (res.data.success) {
        fetchComplaints();
        fetchWorkerData();
      }
    } catch (error) {
      alert('Failed to perform action');
    } finally {
      setActionLoading(null);
    }
  };

  // Statistics
  const stats = {
    assigned: complaints.filter(c => c.status === 'Assigned').length,
    accepted: complaints.filter(c => c.status === 'Accepted').length,
    inProgress: complaints.filter(c => c.status === 'Work In Progress' || c.status === 'In Progress').length,
    completed: complaints.filter(c => c.status === 'Completed' || c.status === 'Closed').length,
    total: complaints.length
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Dashboard...</div>;

  return (
    <div className="space-y-6 animate-fade-in transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 relative overflow-hidden group transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] group-hover:bg-primary/20 transition-all"></div>
        <div className="relative z-10 mb-4 sm:mb-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                Worker Dashboard
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors text-sm">
                Welcome, <span className="font-medium text-gray-700 dark:text-gray-200">{user?.name}</span>
                {workerData?.profession && <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{workerData.profession}</span>}
              </p>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-3">
          {/* Availability Toggle */}
          <Link
            to="/worker/profile"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            <User className="w-4 h-4" />
            Profile
          </Link>
          <button
            onClick={toggleAvailability}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              availability === 'Available'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            {availability === 'Available' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {availability}
          </button>
          <button
            onClick={() => { localStorage.removeItem('user'); navigate('/login'); }}
            className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-900/50 px-4 py-2 rounded-xl transition-all"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-5 rounded-2xl border border-gray-200 dark:border-gray-800 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.assigned}</p>
        </div>
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-5 rounded-2xl border border-gray-200 dark:border-gray-800 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active</span>
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.inProgress}</p>
        </div>
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-5 rounded-2xl border border-gray-200 dark:border-gray-800 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</span>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{workerData?.completedJobs || stats.completed}</p>
        </div>
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-5 rounded-2xl border border-gray-200 dark:border-gray-800 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</span>
            <Star className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {workerData?.rating ? workerData.rating.toFixed(1) : '-'}
          </p>
        </div>
      </div>

      {/* Assigned Complaints */}
      <div className="flex items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">My Assigned Works</h2>
        <div className="ml-3 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">{complaints.length}</div>
      </div>

      {complaints.length === 0 ? (
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-12 rounded-3xl border border-gray-200 dark:border-gray-800 text-center flex flex-col items-center transition-colors">
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-5 transition-colors">
            <CheckSquare className="w-10 h-10 text-green-500/50" />
          </div>
          <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">You're all caught up!</h3>
          <p className="text-gray-500 text-sm max-w-sm">No tasks assigned. Take a break or contact admin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {complaints.map(c => {
            const isActionLoading = actionLoading === c.id;
            return (
              <div key={c.id} className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors hover:border-primary/20">
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[c.status] || 'bg-gray-50 dark:bg-gray-900/20 text-gray-600'}`}>
                          {c.status}
                        </span>
                        <span className="text-xs font-mono text-gray-500">
                          #{c.id?.substring(c.id.length - 6)}
                        </span>
                        <span className="text-xs text-gray-400">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {new Date(c.date).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {c.text || <span className="italic text-gray-400">No description</span>}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center"><User className="w-3.5 h-3.5 mr-1" />{c.userName}</span>
                        <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1" />Flat {c.flatNumber}</span>
                        {c.category && <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">{c.category}</span>}
                        {c.priority && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            c.priority === 'Urgent' ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
                            c.priority === 'High' ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' :
                            'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                          }`}>
                            {c.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {c.adminRemarks && (
                    <div className="mb-4 bg-yellow-50 dark:bg-yellow-500/5 p-3 rounded-xl border border-yellow-200 dark:border-yellow-500/10">
                      <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-500 uppercase block mb-1">Admin Note</span>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{c.adminRemarks}</p>
                    </div>
                  )}

                  {/* Action Buttons Based on Status */}
                  <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    {(c.status === 'Assigned') && (
                      <button
                        onClick={() => handleAction(c.id, 'accept')}
                        disabled={isActionLoading}
                        className="flex items-center px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        {isActionLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <ThumbsUp className="w-4 h-4 mr-2" />}
                        Accept Work
                      </button>
                    )}
                    {(c.status === 'Accepted') && (
                      <button
                        onClick={() => handleAction(c.id, 'start')}
                        disabled={isActionLoading}
                        className="flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        {isActionLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        Start Work
                      </button>
                    )}
                    {(c.status === 'Work In Progress' || c.status === 'In Progress' || c.status === 'Started') && (
                      <>
                        <button
                          onClick={() => handleAction(c.id, 'in-progress')}
                          disabled={isActionLoading}
                          className="flex items-center px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                        >
                          {isActionLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2" />}
                          Mark In Progress
                        </button>
                        <button
                          onClick={() => navigate(`/worker/work/${c.id}`)}
                          className="flex items-center px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-all"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Complete Work
                        </button>
                      </>
                    )}
                    {(c.status === 'Completed') && (
                      <span className="flex items-center px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl text-sm font-medium border border-green-200 dark:border-green-800">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Awaiting Resident Confirmation
                      </span>
                    )}
                    {(c.status === 'Reopened') && (
                      <button
                        onClick={() => handleAction(c.id, 'start')}
                        disabled={isActionLoading}
                        className="flex items-center px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        {isActionLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        Rework - Start Again
                      </button>
                    )}
                    {/* View Details Link */}
                    <button
                      onClick={() => navigate(`/worker/work/${c.id}`)}
                      className="flex items-center px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Details
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>

                {/* Status Progress Bar */}
                <div className="px-6 pb-4">
                  <div className="bg-gray-50 dark:bg-gray-950/50 p-3 rounded-xl border border-gray-200/50 dark:border-gray-800/50">
                    <div className="flex justify-between text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                      <span className={['Assigned', 'Accepted', 'Work In Progress', 'Completed', 'Closed'].indexOf(c.status) >= 0 ? 'text-primary' : ''}>Assigned</span>
                      <span className={['Accepted', 'Work In Progress', 'Completed', 'Closed'].indexOf(c.status) >= 0 ? 'text-primary' : ''}>Accepted</span>
                      <span className={['Work In Progress', 'Completed', 'Closed'].indexOf(c.status) >= 0 ? 'text-primary' : ''}>Started</span>
                      <span className={['Completed', 'Closed'].indexOf(c.status) >= 0 ? 'text-green-500' : ''}>Completed</span>
                      <span className={c.status === 'Closed' ? 'text-green-500' : ''}>Closed</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkerDashboard;
