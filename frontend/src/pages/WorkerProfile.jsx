import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Phone, Mail, Star, Briefcase, MapPin, Award, Clock, CheckCircle, Shield, ArrowLeft, Wrench, Calendar } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const WorkerProfile = () => {
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData || JSON.parse(userData).role !== 'worker') {
      navigate('/login');
      return;
    }

    const parsed = JSON.parse(userData);
    setUser(parsed);
    fetchWorkerProfile(parsed);
  }, [navigate]);

  const fetchWorkerProfile = async (parsedUser) => {
    try {
      const workerId = parsedUser?.workerId || parsedUser?.id || parsedUser?._id;
      if (!workerId) {
        setLoading(false);
        return;
      }

      const res = await axios.get(
        `${API_BASE_URL}/workers/${workerId}`
      );

      if (res.data.success) {
        setWorker(res.data.worker);
      }
    } catch (err) {
      console.error('Error fetching worker profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityToggle = async (newAvailability) => {
    try {
      const workerId = worker?._id || user?.workerId || user?.id;
      if (!workerId) return;

      await axios.put(
        `${API_BASE_URL}/workers/${workerId}/availability`,
        { availability: newAvailability }
      );
      setWorker(prev => ({ ...prev, availability: newAvailability }));
    } catch (err) {
      console.error('Error updating availability', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-10 rounded-3xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Worker profile not found.</p>
          <button onClick={() => navigate('/worker/dashboard')} className="mt-4 text-primary hover:underline text-sm">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in transition-colors duration-300 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px]" />
        <div className="relative z-10 flex items-center gap-2">
          <button onClick={() => navigate('/worker/dashboard')} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Profile</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{worker.name}</p>
          </div>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
              worker.status === 'Approved'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
            }`}>
              {worker.status}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Photo */}
          {worker.profilePhoto ? (
            <img
            src={`${API_BASE_URL.replace('/api', '')}/uploads/${worker.profilePhoto}`}
              alt={worker.name}
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl object-cover border-2 border-primary/20 shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
              <User className="w-12 h-12 text-primary" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{worker.name}</h2>
            <p className="text-primary font-medium mt-1">{worker.profession}</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Phone className="w-4 h-4 text-primary" />
                {worker.mobileNumber || '-'}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Mail className="w-4 h-4 text-primary" />
                {worker.email || '-'}
              </div>
              {worker.experience && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Briefcase className="w-4 h-4 text-primary" />
                  {worker.experience}
                </div>
              )}
              {worker.address && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4 text-primary" />
                  {worker.address}
                </div>
              )}
            </div>

            {/* Skills */}
            {worker.skills && worker.skills.length > 0 && (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {worker.skills.map((skill, idx) => (
                    <span key={idx} className="px-3 py-1 bg-primary/5 border border-primary/20 rounded-lg text-xs font-medium text-primary">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Availability Toggle */}
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-2">Availability</div>
            <div className="flex flex-col gap-2">
              {['Available', 'Busy', 'Offline'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleAvailabilityToggle(opt)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    worker.availability === opt
                      ? opt === 'Available'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                        : opt === 'Busy'
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      : 'bg-transparent text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-5 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="w-10 h-10 mx-auto bg-primary/10 rounded-xl flex items-center justify-center mb-2">
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{worker.completedJobs || worker.completedJobsCount || 0}</p>
          <p className="text-xs text-gray-500">Completed Jobs</p>
        </div>

        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-5 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="w-10 h-10 mx-auto bg-yellow-50 dark:bg-yellow-900/20 rounded-xl flex items-center justify-center mb-2">
            <Star className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {worker.averageRating ? worker.averageRating.toFixed(1) : worker.rating ? worker.rating.toFixed(1) : '-'}
          </p>
          <p className="text-xs text-gray-500">
            {worker.totalRatingsCount || 0} rat{(worker.totalRatingsCount || 0) !== 1 ? 'ings' : 'ing'}
          </p>
        </div>

        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-5 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="w-10 h-10 mx-auto bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{worker.availability || 'N/A'}</p>
          <p className="text-xs text-gray-500">Status</p>
        </div>

        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-5 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="w-10 h-10 mx-auto bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center mb-2">
            <Award className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{worker.experience || 'N/A'}</p>
          <p className="text-xs text-gray-500">Experience</p>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Shield className="w-5 h-5 text-primary mr-2" />
          Account Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block">Status</span>
            <span className="font-medium text-gray-900 dark:text-white">{worker.status}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Availability</span>
            <span className={`font-medium ${worker.availability === 'Available' ? 'text-green-600' : worker.availability === 'Busy' ? 'text-amber-600' : 'text-gray-600'}`}>
              {worker.availability || 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Aadhaar/ID</span>
            <span className="font-medium text-gray-900 dark:text-white">{worker.aadhaarNumber || '-'}</span>
          </div>
          {worker.completedJobsCount !== undefined && (
            <div>
              <span className="text-gray-500 block">Total Jobs Completed</span>
              <span className="font-medium text-gray-900 dark:text-white">{worker.completedJobsCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkerProfile;

