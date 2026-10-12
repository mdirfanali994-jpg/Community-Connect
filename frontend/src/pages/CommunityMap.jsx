import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, MapPin } from 'lucide-react';
import InteractiveComplaintMap from '../components/InteractiveComplaintMap';
import { API_BASE_URL } from '../config/api';

const CommunityMap = () => {
  const [complaints, setComplaints] = useState([]);
  const [boundaryCenter, setBoundaryCenter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const raw = localStorage.getItem('user');
        const user = raw ? JSON.parse(raw) : null;
        const communityId = user?.communityId || user?.communityID || user?.community_id || null;
        const userId = user?.id || user?._id || user?.workerId || null;
        const role = user?.role || 'user';
        const token = localStorage.getItem('token');

        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (communityId) headers['x-community-id'] = String(communityId);
        if (userId) {
          if (role === 'admin') {
            headers['x-admin-id'] = String(userId);
          } else if (role === 'worker' || role === 'security') {
            headers['x-worker-id'] = String(userId);
          } else {
            headers['x-user-id'] = String(userId);
          }
        }

        // Coordinate validator: strictly checks finite numbers within valid geographic ranges
        // Never relies on truthiness checks so valid zero coordinates (0,0) are preserved
        const isValidCoordinate = (lat, lng) => {
          if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
          const numLat = Number(lat);
          const numLng = Number(lng);
          return (
            Number.isFinite(numLat) &&
            Number.isFinite(numLng) &&
            numLat >= -90 &&
            numLat <= 90 &&
            numLng >= -180 &&
            numLng <= 180
          );
        };

        // If unauthenticated or no community context, display neutral map view cleanly
        if (!userId && !communityId) {
          setComplaints([]);
          setBoundaryCenter(null);
          setLoading(false);
          return;
        }

        // 1. Fetch complaints for community
        const complaintsPromise = axios.get(`${API_BASE_URL}/complaints`, {
          headers,
          params: { role, userId }
        }).catch((err) => {
          console.warn('Map complaints fetch notice:', err?.response?.data?.message || err?.message);
          return null;
        });

        // 2. Fetch community boundary center if available
        const boundaryPromise = axios.get(`${API_BASE_URL}/boundary`, {
          headers,
          params: { userId }
        }).catch(() => null);

        const [complaintsRes, boundaryRes] = await Promise.all([complaintsPromise, boundaryPromise]);

        if (complaintsRes?.data?.success && Array.isArray(complaintsRes.data.complaints)) {
          const validComplaints = complaintsRes.data.complaints.reduce((acc, c) => {
            const rawLat = c.location?.lat ?? c.lat;
            const rawLng = c.location?.lng ?? c.lng;
            if (isValidCoordinate(rawLat, rawLng)) {
              const lat = Number(rawLat);
              const lng = Number(rawLng);
              acc.push({
                ...c,
                location: {
                  ...(c.location || {}),
                  lat,
                  lng
                },
                lat,
                lng
              });
            }
            return acc;
          }, []);
          setComplaints(validComplaints);
        } else {
          setComplaints([]);
        }

        if (boundaryRes?.data?.success && boundaryRes.data.configured && boundaryRes.data.boundary) {
          const b = boundaryRes.data.boundary;
          if (b.mode === 'radius' && b.center && isValidCoordinate(b.center.lat, b.center.lng)) {
            setBoundaryCenter([Number(b.center.lat), Number(b.center.lng)]);
          } else if (b.mode === 'polygon' && Array.isArray(b.polygon)) {
            const validPts = b.polygon.filter(pt => isValidCoordinate(pt?.lat, pt?.lng));
            if (validPts.length >= 3) {
              const sum = validPts.reduce(
                (acc, pt) => ({ lat: acc.lat + Number(pt.lat), lng: acc.lng + Number(pt.lng) }),
                { lat: 0, lng: 0 }
              );
              setBoundaryCenter([sum.lat / validPts.length, sum.lng / validPts.length]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching map data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in transition-colors duration-300 h-[calc(100vh-6rem)] flex flex-col pb-6">
      <div className="flex justify-between items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-800 transition-colors shrink-0">
        <div className="flex items-center">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl mr-4">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">Interactive Community Map</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors text-sm">Geographic view of community issues and status</p>
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
          <InteractiveComplaintMap complaintsData={complaints} communityCenter={boundaryCenter} />
        )}
      </div>
    </div>
  );
};

export default CommunityMap;
