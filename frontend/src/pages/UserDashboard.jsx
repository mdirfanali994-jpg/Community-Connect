import { useState, useEffect, useRef } from 'react';

import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Mic, MicOff, Image as ImageIcon, MapPin, Send, AlertCircle, CheckCircle, User, Phone, Star, ThumbsUp, RotateCcw, Clock, Calendar, Camera, Wallet, Shield } from 'lucide-react';
import { MapContainer, Marker, useMapEvents, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet markers in React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { API_BASE_URL } from '../config/api';


delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});



function LocationSelector({ location, setLocation }) {
  useMapEvents({
    click(e) {
      setLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return location ? <Marker position={[location.lat, location.lng]} /> : null;
}

const StatusTimelineView = ({ complaint }) => {
  const statusFlow = [
    'Submitted', 'Verified', 'Assigned', 'Accepted', 'Started', 'Work In Progress', 'Completed', 'Resident Approved'
  ];
  const currentIndex = statusFlow.indexOf(complaint.status);

  if (!complaint.timeline) return null;

  return (
    <div className="mt-4 space-y-3">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Status Timeline</h4>
      <div className="relative pl-6 space-y-3">
        {statusFlow.map((status, idx) => {
          const timelineEntry = (complaint.timeline || []).find(t => t.status === status);
          const isActive = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <div key={status} className="relative">
              {idx < statusFlow.length - 1 && (
                <div className={`absolute left-[-10px] top-4 w-0.5 h-full ${isActive ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
              <div className={`absolute left-[-14px] top-1 w-3 h-3 rounded-full border-2 ${
                isCurrent ? 'bg-primary border-primary' :
                isActive ? 'bg-primary/30 border-primary' :
                'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'
              }`} />
              <div className={`text-xs ${isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                <span className="font-medium">{status}</span>
                {timelineEntry && (
                  <span className="ml-2 text-gray-500">
                    {timelineEntry.updatedAt ? new Date(timelineEntry.updatedAt).toLocaleString() : ''}
                    {timelineEntry.updatedBy ? ` - by ${timelineEntry.updatedBy}` : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const UserDashboard = () => {
  const [user, setUser] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [location, setLocation] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mapUrl, setMapUrl] = useState('/community-map.jpg');
  const [ratingModal, setRatingModal] = useState({ open: false, complaintId: null });
  const [workerRating, setWorkerRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  void mapUrl;


  const navigate = useNavigate();


  const recognitionRef = useRef(null);

  const fetchComplaints = async (userId, communityId) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/complaints?role=resident&userId=${userId}`,
        {
          headers: {
            'x-community-id': communityId,
          },
        }
      );

      if (res.data.success) {
        setComplaints(res.data.complaints);
      }
    } catch (err) {
      console.error('Error fetching complaints', err);
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');

    const run = async () => {





      if (!userData) {
        navigate('/login');
        return;
      }
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'resident') {
        navigate('/login');
        return;
      }

      setUser(parsedUser);

      // Society-scoped fetches
      await fetchComplaints(parsedUser.id, parsedUser.communityId);

      // Map settings are global prototype right now; keep call non-blocking
      // Keep map settings call; mapUrl is used by the modal UI
      try {
        const mapRes = await axios.get(
          `${API_BASE_URL}/settings/map`
        );
        if (mapRes?.data?.success && mapRes?.data?.mapUrl) {
          setMapUrl(mapRes.data.mapUrl);
        }
      } catch (mapErr) {
        console.error('Error fetching map settings', mapErr);
      }



    };

    run();

    return () => {};
  }, [navigate]);

  useEffect(() => {
    // Initialize Speech Recognition
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;

      // Avoid repeated chunk concatenation.
      recognitionRef.current.interimResults = false;

      // Track last committed transcript so we never append the same final chunk twice.
      let lastFinal = '';

      recognitionRef.current.onresult = (event) => {
        const results = event.results;
        let latestFinal = '';

        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i] && results[i].isFinal) {
            latestFinal = results[i][0]?.transcript || '';
            break;
          }
        }

        latestFinal = latestFinal.trim();
        if (!latestFinal) return;

        if (latestFinal === lastFinal) return;
        lastFinal = latestFinal;

        setText((prev) => {
          const prevTrim = (prev || '').trim();
          return prevTrim ? `${prevTrim} ${latestFinal}` : latestFinal;
        });
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {


    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      setText('');
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !image) {
      alert("Please provide text or an image for your complaint.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('text', text);
    formData.append('userId', user.id);
    formData.append('userName', user.name);
    formData.append('flatNumber', user.flat);
    if (location) formData.append('location', JSON.stringify(location));
    if (image) formData.append('image', image);

    try {
      const res = await axios.post(`${API_BASE_URL}/complaints`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setText('');
        setImage(null);
        setLocation(null);
        fetchComplaints(user.id, user.communityId);
        alert('Complaint registered successfully!');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to submit complaint');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCompletion = async (complaintId) => {
    try {
      const res = await axios.put(
        `${API_BASE_URL}/complaints/${complaintId}/approve-completion`,
        { userId: user.id }
      );
      if (res.data.success) {
        alert('✅ You have approved the completed work. Complaint is now closed.');
        fetchComplaints(user.id, user.communityId);
      }
    } catch (err) {
      console.error('Error approving completion', err);
      alert('Failed to approve completion');
    }
  };

  const handleRequestRework = async (complaintId) => {
    const reason = prompt('Please describe what needs rework:');
    if (!reason) return;
    try {
      const res = await axios.put(
        `${API_BASE_URL}/complaints/${complaintId}/request-rework`,
        { userId: user.id, review: reason }
      );
      if (res.data.success) {
        alert('Rework requested. Worker will be notified.');
        fetchComplaints(user.id, user.communityId);
      }
    } catch (err) {
      console.error('Error requesting rework', err);
      alert('Failed to request rework');
    }
  };

  const handleRateWorker = async () => {
    if (!ratingModal.complaintId) return;
    try {
      const complaint = complaints.find(c => c.id === ratingModal.complaintId);
      const workerId = complaint?.assignment?.workerId || complaint?.workerDetails?.workerId;
      if (!workerId) {
        alert('Worker ID not found');
        return;
      }
      await axios.post(
        `${API_BASE_URL}/workers/${workerId}/rate`,
        {
          complaintId: ratingModal.complaintId,
          rating: workerRating,
          review: ratingComment,
          userId: user.id
        }
      );
      alert('✅ Rating submitted successfully!');
      setRatingModal({ open: false, complaintId: null });
      setWorkerRating(5);
      setRatingComment('');
    } catch (err) {
      console.error('Error rating worker', err);
      alert('Failed to submit rating');
    }
  };

  const getProgressPercentage = (status) => {
    const statuses = ['Submitted', 'Verified', 'Assigned', 'Accepted', 'Started', 'Work In Progress', 'Completed', 'Resident Approved'];
    const index = statuses.indexOf(status);
    return index === -1 ? 0 : (index / (statuses.length - 1)) * 100;
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in transition-colors duration-300">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 relative overflow-hidden group transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] group-hover:bg-primary/20 transition-all"></div>
        <div className="relative z-10 mb-4 sm:mb-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">Resident Dashboard - {user?.communityName || 'Your Society'}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">Welcome to {user?.communityName || 'Your Society'}, <span className="text-gray-700 dark:text-gray-200 font-medium">{user.name}</span> <span className="px-2 py-0.5 ml-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-xs font-mono text-primary transition-colors">FLAT {user.flat}</span></p>

        </div>
        <div className="relative z-10 flex items-center space-x-4">
          <Link to="/public-board" className="text-primary hover:text-primary-dark hover:underline text-sm font-medium transition-colors">
            View Public Board
          </Link>
          <button 
            onClick={() => { localStorage.removeItem('user'); navigate('/login'); }}
            className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-900/50 px-4 py-2 rounded-xl transition-all"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module Navigation Card */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/user/finance"
            className="group flex items-center gap-4 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-5 rounded-3xl border border-gray-200 dark:border-gray-800 hover:border-primary/30 dark:hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center transition-all group-hover:scale-110 group-hover:bg-primary/20">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Finance & Maintenance</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Bills, payments & society expenses</p>
            </div>
          </Link>

          <Link
            to="/user/visitors"
            className="group flex items-center gap-4 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-5 rounded-3xl border border-gray-200 dark:border-gray-800 hover:border-primary/30 dark:hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center transition-all group-hover:scale-110 group-hover:bg-primary/20">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Visitor Management</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Invite visitors, QR passes & OTP</p>
            </div>
          </Link>
        </div>
        {/* Registration Form */}
        <div className="lg:col-span-1 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 relative overflow-hidden h-fit transition-colors">
          <div className="absolute top-0 right-0 w-64 h-2 bg-gradient-to-l from-primary/50 to-transparent"></div>
          
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5 flex items-center transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mr-3 transition-colors">
              <AlertCircle className="w-4 h-4 text-primary" />
            </div>
            Register Complaint
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={toggleRecording}
                className={`flex-1 flex items-center justify-center py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                  isRecording 
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 shadow-[0_0_15px_rgba(248,113,113,0.3)] animate-pulse' 
                    : 'bg-primary/5 dark:bg-primary/10 text-primary hover:bg-primary/10 dark:hover:bg-primary/20 border border-primary/20 dark:border-primary/20 hover:border-primary/30 dark:hover:border-primary/40'
                }`}
              >
                {isRecording ? <MicOff className="w-5 h-5 mr-2" /> : <Mic className="w-5 h-5 mr-2" />}
                {isRecording ? 'Recording...' : 'Voice Input'}
              </button>
            </div>

            <div className="relative group/textarea">
              <textarea
                rows="4"
                className="w-full p-4 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary text-gray-900 dark:text-gray-200 text-sm resize-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                placeholder="Describe your complaint here or use voice recording..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            <div className="flex space-x-3">
              <label className="flex-1 flex items-center justify-center py-2.5 px-4 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer transition-all">
                <ImageIcon className={`w-4 h-4 mr-2 ${image ? 'text-primary' : ''}`} />
                <span className="truncate max-w-[100px]">{image ? image.name : 'Add Image'}</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => setImage(e.target.files[0])}
                />
              </label>

              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                className={`flex-1 flex items-center justify-center py-2.5 px-4 border rounded-xl text-sm font-medium transition-all ${
                  location 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' 
                    : 'bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <MapPin className={`w-4 h-4 mr-2 ${location ? 'text-green-600 dark:text-green-400' : ''}`} />
                {location ? 'Location Set' : 'Location'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3.5 px-4 bg-gradient-to-r from-primary to-cyan-500 dark:from-primary dark:to-cyan-400 hover:from-cyan-500 hover:to-primary dark:hover:from-cyan-400 dark:hover:to-primary text-white dark:text-gray-950 rounded-xl font-bold shadow-md dark:shadow-lg shadow-primary/20 dark:shadow-primary/20 transition-all disabled:opacity-50 mt-6"
            >
              <Send className="w-4 h-4 mr-2" />
              {loading ? 'Submitting...' : 'Submit Complaint'}
            </button>
          </form>
        </div>

        {/* My Complaints List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors">My Complaints</h2>
            <div className="ml-3 px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400 transition-colors">{complaints.length}</div>
          </div>
          
          {complaints.length === 0 ? (
            <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-10 rounded-3xl border border-gray-200 dark:border-gray-800 text-center flex flex-col items-center justify-center min-h-[300px] transition-colors">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 transition-colors">
                <CheckCircle className="w-8 h-8 text-gray-400 dark:text-gray-600 transition-colors" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium transition-colors">You haven't registered any complaints yet.</p>
              <p className="text-gray-500 dark:text-gray-600 text-sm mt-2 transition-colors">All caught up! Community is running smooth.</p>
            </div>
          ) : (
            complaints.map(complaint => (
              <div key={complaint.id} className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl border border-gray-200 dark:border-gray-800 hover:border-primary/20 dark:hover:border-gray-700 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-semibold text-primary tracking-wider uppercase mb-1 block">
                      ID: #{complaint.id.substring(complaint.id.length - 6)} • {new Date(complaint.date).toLocaleDateString()}
                    </span>
                    <p className="text-gray-900 dark:text-gray-200 font-medium text-lg transition-colors">{complaint.text || <span className="text-gray-400 dark:text-gray-500 italic">No text provided (Image/Voice attached)</span>}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    complaint.status === 'Completed' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/50' :
                    complaint.status === 'Work In Progress' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' :
                    complaint.status === 'Resident Approved' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700' :
                    'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50'
                  }`}>
                    {complaint.status === 'Resident Approved' ? 'Closed' : complaint.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-6 relative bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-200/50 dark:border-gray-800/50 transition-colors">
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded-full bg-gray-200 dark:bg-gray-800 transition-colors">
                    <div style={{ width: `${getProgressPercentage(complaint.status)}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-1000 ease-out ${
                      complaint.status === 'Completed' || complaint.status === 'Resident Approved' ? 'bg-green-500' : 'bg-primary'
                    }`}></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-500 font-medium uppercase tracking-wider transition-colors">
                    <span className={getProgressPercentage(complaint.status) >= 0 ? 'text-gray-700 dark:text-gray-300' : ''}>Submitted</span>
                    <span className={`hidden sm:inline ${getProgressPercentage(complaint.status) >= 14 ? 'text-gray-700 dark:text-gray-300' : ''}`}>Verified</span>
                    <span className={`hidden sm:inline ${getProgressPercentage(complaint.status) >= 28 ? 'text-gray-700 dark:text-gray-300' : ''}`}>Assigned</span>
                    <span className={`hidden sm:inline ${getProgressPercentage(complaint.status) >= 42 ? 'text-gray-700 dark:text-gray-300' : ''}`}>Accepted</span>
                    <span className={`hidden sm:inline ${getProgressPercentage(complaint.status) >= 57 ? 'text-gray-700 dark:text-gray-300' : ''}`}>Started</span>
                    <span className={`hidden sm:inline ${getProgressPercentage(complaint.status) >= 71 ? 'text-gray-700 dark:text-gray-300' : ''}`}>WIP</span>
                    <span className={getProgressPercentage(complaint.status) >= 85 ? 'text-green-600 dark:text-green-400' : ''}>Done</span>
                  </div>
                </div>

                {/* Worker Details */}
                {(complaint.assignedWorker || complaint.assignment?.workerId) && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <User className="w-4 h-4 mr-1.5 text-primary" />
                      Assigned Worker
                    </h4>
                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-950/50 p-3 rounded-xl border border-gray-200/50 dark:border-gray-800/50">
                      {(complaint.workerDetails?.profilePhoto || complaint.completion?.workerPhoto) ? (
                        <img
                          src={`${API_BASE_URL.replace('/api', '')}/uploads/${complaint.workerDetails?.profilePhoto || complaint.completion?.workerPhoto}`}
                          alt={complaint.assignedWorker}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-200 block text-sm">{complaint.assignedWorker}</span>
                        {complaint.workerDetails?.profession && (
                          <span className="text-xs text-gray-500">{complaint.workerDetails.profession}</span>
                        )}
                        {complaint.workerDetails?.mobileNumber && (
                          <div className="flex items-center text-xs text-gray-500 mt-0.5">
                            <Phone className="w-3 h-3 mr-1" />
                            {complaint.workerDetails.mobileNumber}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Completion Images & Action Buttons */}
                {complaint.status === 'Completed' && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <Camera className="w-4 h-4 mr-1.5 text-green-500" />
                      Completion Photos
                    </h4>
                    {complaint.completion?.photos && complaint.completion.photos.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                        {complaint.completion.photos.map((img, idx) => (
                          <img
                            key={idx}
                            src={`${API_BASE_URL.replace('/api', '')}/uploads/${img}`}
                            alt={`Completion ${idx + 1}`}
                            className="w-full h-24 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mb-4">No completion photos uploaded.</p>
                    )}

                    {complaint.completion?.notes && (
                      <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 mb-4">
                        <span className="text-primary/70 text-xs uppercase tracking-wide block mb-1">Completion Notes</span>
                        <span className="text-sm text-gray-800 dark:text-gray-200">{complaint.completion.notes}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleApproveCompletion(complaint.id)}
                        className="flex items-center px-4 py-2.5 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-xl text-sm font-semibold transition-all"
                      >
                        <ThumbsUp className="w-4 h-4 mr-2" />
                        Approve Completion
                      </button>
                      <button
                        onClick={() => handleRequestRework(complaint.id)}
                        className="flex items-center px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-sm font-semibold transition-all"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Request Rework
                      </button>
                    </div>
                  </div>
                )}

                {/* Resident Approved - Show rating option */}
                {complaint.status === 'Resident Approved' && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => setRatingModal({ open: true, complaintId: complaint.id })}
                      className="flex items-center px-4 py-2.5 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 rounded-xl text-sm font-semibold transition-all"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Rate Worker
                    </button>
                  </div>
                )}

                {/* Timeline */}
                {complaint.timeline && complaint.timeline.length > 0 && (
                  <StatusTimelineView complaint={complaint} />
                )}
                
                {(complaint.assignedWorker || complaint.adminRemarks) && complaint.status !== 'Completed' && complaint.status !== 'Resident Approved' && (
                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 text-sm grid grid-cols-1 sm:grid-cols-2 gap-4 transition-colors">
                    {complaint.assignedWorker && (
                      <div className="bg-gray-50 dark:bg-gray-950/50 p-3 rounded-xl border border-gray-200/50 dark:border-gray-800/50 transition-colors">
                        <span className="text-gray-500 text-xs uppercase tracking-wide block mb-1">Assigned Technician:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200 transition-colors">{complaint.assignedWorker}</span>
                      </div>
                    )}
                    {complaint.adminRemarks && (
                      <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 transition-colors">
                        <span className="text-primary/70 text-xs uppercase tracking-wide block mb-1">Admin Remarks:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200 transition-colors">{complaint.adminRemarks}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Rating Modal */}
      {ratingModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center mb-4">
                <Star className="w-5 h-5 mr-2 text-yellow-500" />
                Rate Worker
              </h3>
              <div className="flex items-center justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setWorkerRating(star)}
                    className={`p-1 transition-all ${
                      star <= workerRating ? 'text-yellow-500 scale-110' : 'text-gray-300 dark:text-gray-600'
                    }`}
                  >
                    <Star className="w-8 h-8 fill-current" />
                  </button>
                ))}
              </div>
              <textarea
                rows="3"
                placeholder="Add a comment (optional)..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm resize-none transition-all"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleRateWorker}
                  className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm transition-all"
                >
                  Submit Rating
                </button>
                <button
                  onClick={() => setRatingModal({ open: false, complaintId: null })}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {showMapModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-950/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-primary" />
                Select Location on Community Map
              </h3>
              <button 
                onClick={() => setShowMapModal(false)}
                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-200 dark:bg-gray-800 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                Close & Save
              </button>
            </div>
            <div className="flex-grow bg-gray-200 dark:bg-gray-950 relative z-0">
              <MapContainer 
                center={[28.6139, 77.2090]}
                zoom={15}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                <LocationSelector location={location} setLocation={setLocation} />
              </MapContainer>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-950/50 border-t border-gray-200 dark:border-gray-800 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
              {location ? 'Location selected! Click "Close & Save" when done.' : 'Click anywhere on the map to drop a pin.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
