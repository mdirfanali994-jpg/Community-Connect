import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, MapPin } from 'lucide-react';
import InteractiveComplaintMap from '../components/InteractiveComplaintMap';

const CommunityMap = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const raw = localStorage.getItem('user');
        const user = raw ? JSON.parse(raw) : null;
        const communityId = user?.communityId || user?.communityID || user?.community_id || null;
        const userId = user?.id || user?._id || user?.workerId || null;
        const role = user?.role || 'user';

        const headers = communityId ? { 'x-community-id': String(communityId) } : {};

        const res = await axios.get('https://community-connect-backend-wqwc.onrender.com/api/complaints', {
          headers,
          params: { role, userId }
        });
        if (res.data.success) {
          // Filter to only include complaints that have a valid lat/lng location
          const validComplaints = res.data.complaints.filter(c => c.location && c.location.lat && c.location.lng);
          setComplaints(validComplaints);
        }
      } catch (error) {
        console.error('Error fetching complaints:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in transition-colors duration-300 h-[calc(100vh-6rem)] flex flex-col pb-6">
      <div className="flex justify-between items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-800 transition-colors shrink-0">
        <div className="flex items-center">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl mr-4">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">Interactive Demo Map</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors text-sm">Real-time geographic view of community issues and status</p>
          </div>
        </div>
        <Link to="/public-board" className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-xl transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to List
        </Link>
      </div>

      <div className="flex-grow w-full relative z-0">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <InteractiveComplaintMap complaintsData={complaints.length > 0 ? complaints : undefined} />
        )}
      </div>
    </div>
  );
};

export default CommunityMap;
