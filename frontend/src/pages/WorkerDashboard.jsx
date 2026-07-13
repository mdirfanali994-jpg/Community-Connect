import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckSquare, AlertCircle, CheckCircle } from 'lucide-react';

const WorkerDashboard = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData || JSON.parse(userData).role !== 'worker') {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(userData));
    fetchComplaints();
  }, [navigate]);

  const fetchComplaints = async () => {
    try {
      const parsedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const workerId = parsedUser?.workerId || parsedUser?._id || parsedUser?.id || null;

      // New, society-scoped assignment endpoint (preferred)
      if (workerId) {
        const res = await axios.get(
          `https://community-connect-backend-wqwc.onrender.com/api/workers/${workerId}/complaints`
        );
        if (res.data.success) {
          setComplaints(res.data.complaints);
          return;
        }
      }

      // Backward compatible fallback
      const fallbackRes = await axios.get(
        'https://community-connect-backend-wqwc.onrender.com/api/complaints?role=worker'
      );
      if (fallbackRes.data.success) {
        setComplaints(fallbackRes.data.complaints);
      }
    } catch (error) {
      console.error('Error fetching complaints', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      const res = await axios.put(
        `https://community-connect-backend-wqwc.onrender.com/api/complaints/${id}`,
        { status }
      );
      if (res.data.success) {
        fetchComplaints();
      }
    } catch (error) {
      alert('Failed to update status');
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Tasks...</div>;

  return (
    <div className="space-y-6 animate-fade-in transition-colors duration-300">
      <div className="flex justify-between items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-800 transition-colors">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">Technician Portal</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">Assigned duties for <span className="text-gray-700 dark:text-gray-200 transition-colors">{user?.name}</span></p>
        </div>
        <button 
          onClick={() => { localStorage.removeItem('user'); navigate('/login'); }}
          className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-900/50 px-4 py-2 rounded-xl transition-all"
        >
          Logout
        </button>
      </div>

      <div className="flex items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">Active Assignments</h2>
        <div className="ml-3 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">{complaints.length}</div>
      </div>
      
      {complaints.length === 0 ? (
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-12 rounded-3xl border border-gray-200 dark:border-gray-800 text-center flex flex-col items-center transition-colors">
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-5 transition-colors">
            <CheckSquare className="w-10 h-10 text-green-500/50" />
          </div>
          <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">You're all caught up!</h3>
          <p className="text-gray-500 text-sm max-w-sm">There are no pending tasks assigned to you right now. Take a break.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {complaints.map(c => (
            <div key={c.id} className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-800 flex flex-col hover:border-gray-300 dark:hover:border-gray-700 transition-colors relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-primary/30 dark:from-primary/50 to-primary/5 dark:to-primary/10 transition-colors"></div>
              
              <div className="flex justify-between items-center mb-5">
                <span className="bg-primary/10 border border-primary/20 text-primary text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider">
                  Flat {c.flatNumber}
                </span>
                <span className="text-xs font-mono text-gray-500 bg-gray-50 dark:bg-gray-950 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-800 transition-colors">
                  {new Date(c.date).toLocaleDateString()}
                </span>
              </div>
              
              <h3 className="text-gray-700 dark:text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center transition-colors">
                <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-gray-400" /> Task Details
              </h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 mb-5 flex-grow bg-gray-50 dark:bg-gray-950/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 leading-relaxed transition-colors">
                {c.text || <span className="italic text-gray-400 dark:text-gray-500">Please check attached media or admin remarks for specifics.</span>}
              </p>

              {c.adminRemarks && (
                <div className="mb-5 bg-yellow-50 dark:bg-yellow-500/5 p-4 rounded-xl border border-yellow-200 dark:border-yellow-500/10 transition-colors">
                  <span className="font-semibold text-yellow-600 dark:text-yellow-500/80 text-xs uppercase block mb-1 transition-colors">Supervisor Note</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors">{c.adminRemarks}</span>
                </div>
              )}

              <div className="flex space-x-3 mt-auto pt-5 border-t border-gray-100 dark:border-gray-800 transition-colors">
                {c.status !== 'Work In Progress' && c.status !== 'Assigned' && (
                  <button
                    onClick={() => handleStatusUpdate(c.id, 'Work In Progress')}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 py-2.5 rounded-xl text-sm font-medium transition-all"
                  >
                    Start Work
                  </button>
                )}
                <button 
                  onClick={() => handleStatusUpdate(c.id, 'Completed')}
                  className="flex-1 bg-green-50 hover:bg-green-100 dark:bg-green-500/10 dark:hover:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20 hover:border-green-300 dark:hover:border-green-500/30 py-2.5 rounded-xl text-sm font-medium transition-all flex justify-center items-center"
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Mark Done
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkerDashboard;
