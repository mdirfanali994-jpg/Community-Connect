import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, Clock, ShieldCheck } from 'lucide-react';

const PublicBoard = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const res = await axios.get('https://community-connect-backend-wqwc.onrender.com/api/complaints');
        if (res.data.success) {
          setComplaints(res.data.complaints);
        }
      } catch (error) {
        console.error('Error fetching complaints', error);
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Synchronizing Data...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12 transition-colors duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-8 rounded-3xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-800 relative overflow-hidden transition-colors">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/10 dark:bg-primary/5 rounded-full blur-[60px] transition-colors"></div>
        
        <div className="relative z-10 text-center sm:text-left mb-5 sm:mb-0">
          <div className="flex items-center justify-center sm:justify-start mb-2">
            <ShieldCheck className="w-6 h-6 text-primary mr-2" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight transition-colors">Transparency Hub</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 transition-colors">Public log of community issues and resolution tracking.</p>
        </div>
        
        <Link to="/login" className="relative z-10 text-white dark:text-gray-950 font-bold bg-gradient-to-r from-primary to-cyan-500 dark:from-primary dark:to-cyan-400 hover:from-cyan-500 hover:to-primary dark:hover:from-cyan-400 dark:hover:to-primary px-6 py-2.5 rounded-xl transition-all shadow-md dark:shadow-lg shadow-primary/20 dark:shadow-primary/20 transform hover:-translate-y-0.5">
          Go to Portal
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {complaints.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-gray-50 dark:bg-gray-900/40 rounded-3xl border border-gray-200 dark:border-gray-800/50 text-gray-500 transition-colors">
            No complaints logged in the community yet. Everything is pristine!
          </div>
        ) : (
          complaints.map(c => (
            <div key={c.id} className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-gray-800 p-6 hover:border-gray-300 dark:hover:border-gray-700 shadow-sm hover:shadow-md dark:shadow-none dark:hover:shadow-lg dark:hover:shadow-primary/5 transition-all flex flex-col relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl pointer-events-none"></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <span className="text-sm font-bold text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 px-3 py-1.5 rounded-lg shadow-inner transition-colors">Flat {c.flatNumber}</span>
                {c.status === 'Completed' ? (
                  <span className="flex items-center text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-900/50 px-2.5 py-1.5 rounded-lg transition-colors">
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Done
                  </span>
                ) : (
                  <span className="flex items-center text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-lg transition-colors">
                    <Clock className="w-3.5 h-3.5 mr-1.5" /> {c.status}
                  </span>
                )}
              </div>
              
              <div className="flex-grow mb-6 relative z-10">
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed transition-colors">
                  {c.text || <span className="italic text-gray-400 dark:text-gray-600">Attachment Provided</span>}
                </p>
              </div>

              <div className="flex flex-col space-y-2 mt-auto pt-4 border-t border-gray-100 dark:border-gray-800/80 text-xs relative z-10 transition-colors">
                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-950/30 p-2 rounded-lg transition-colors">
                  <span className="text-gray-500 uppercase tracking-wide">Reported</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300 transition-colors">{new Date(c.date).toLocaleDateString()}</span>
                </div>
                {c.assignedWorker && (
                  <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-950/30 p-2 rounded-lg transition-colors">
                    <span className="text-gray-500 uppercase tracking-wide">Assigned</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300 transition-colors">{c.assignedWorker}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PublicBoard;
