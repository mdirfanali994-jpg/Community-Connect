import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, CheckCircle, Clock, User, MapPin, Calendar,
  Image as ImageIcon, Video, FileText, Send, Camera, Star,
  ThumbsUp, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const WorkTrackPage = () => {
  const { complaintId } = useParams();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completionPhotos, setCompletionPhotos] = useState([]);
  const [completionVideo, setCompletionVideo] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const [workerId, setWorkerId] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData || JSON.parse(userData).role !== 'worker') {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    const wId = parsedUser?.workerId || parsedUser?._id || parsedUser?.id;
    setWorkerId(wId);

    if (complaintId) {
      fetchComplaintDetails(wId);
      fetchTimeline();
    }
  }, [complaintId, navigate]);

  const fetchComplaintDetails = async (wId) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/workers/${wId}/complaints`
      );
      if (res.data.success) {
        const found = res.data.complaints.find(c => c.id === complaintId);
        if (found) {
          setComplaint(found);
        }
      }
    } catch (err) {
      console.error('Error fetching complaint', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/complaints/${complaintId}/timeline`
      );
      if (res.data.success) {
        setTimeline(res.data.timeline || []);
      }
    } catch (err) {
      console.error('Error fetching timeline', err);
    }
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    setCompletionPhotos(prev => [...prev, ...files]);
  };

  const removePhoto = (index) => {
    setCompletionPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleComplete = async () => {
    if (completionPhotos.length === 0) {
      setError('Please upload at least one completion photo');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      completionPhotos.forEach(photo => {
        formData.append('completionPhotos', photo);
      });
      if (completionVideo) {
        formData.append('completionVideo', completionVideo);
      }
      formData.append('workerId', workerId);
      formData.append('completionNotes', completionNotes);

      const res = await axios.put(
        `${API_BASE_URL}/complaints/${complaintId}/complete`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (res.data.success) {
        alert('✅ Work completed successfully! Waiting for resident confirmation.');
        navigate('/worker/dashboard');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to complete work');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading...</div>;

  if (!complaint) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Complaint not found</p>
        <button onClick={() => navigate('/worker/dashboard')} className="mt-4 text-primary hover:underline">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const imageBaseUrl = `${API_BASE_URL.replace('/api', '')}/uploads/`;

  return (
    <div className="space-y-6 animate-fade-in transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/worker/dashboard')}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Work Details</h1>
            <p className="text-sm text-gray-500">Complaint #{complaintId?.substring(complaintId.length - 6)}</p>
          </div>
        </div>

        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
          complaint.status === 'Completed' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' :
          complaint.status === 'Closed' ? 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800' :
          'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        }`}>
          {complaint.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Complaint Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6 transition-colors">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Complaint Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-950/50 p-4 rounded-xl border border-gray-200/50 dark:border-gray-800/50">
                <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Resident</span>
                <span className="font-medium text-gray-900 dark:text-white flex items-center">
                  <User className="w-4 h-4 mr-2 text-primary" />{complaint.userName}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-950/50 p-4 rounded-xl border border-gray-200/50 dark:border-gray-800/50">
                <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Flat Number</span>
                <span className="font-medium text-gray-900 dark:text-white flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-primary" />{complaint.flatNumber}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-950/50 p-4 rounded-xl border border-gray-200/50 dark:border-gray-800/50">
                <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Date</span>
                <span className="font-medium text-gray-900 dark:text-white flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-primary" />{new Date(complaint.date).toLocaleDateString()}
                </span>
              </div>
              {complaint.category && (
                <div className="bg-gray-50 dark:bg-gray-950/50 p-4 rounded-xl border border-gray-200/50 dark:border-gray-800/50">
                  <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Category</span>
                  <span className="font-medium text-gray-900 dark:text-white">{complaint.category}</span>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-950/50 p-4 rounded-xl border border-gray-200/50 dark:border-gray-800/50">
              <span className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Description</span>
              <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{complaint.text || 'No description provided'}</p>
            </div>

            {/* Complaint Images */}
            {complaint.image && (
              <div className="mt-4">
                <span className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Complaint Image</span>
                <img
                  src={`${imageBaseUrl}${complaint.image}`}
                  alt="Complaint"
                  className="rounded-xl max-h-64 object-cover border border-gray-200 dark:border-gray-800"
                />
              </div>
            )}

            {/* Admin Remarks */}
            {complaint.adminRemarks && (
              <div className="mt-4 bg-yellow-50 dark:bg-yellow-500/5 p-4 rounded-xl border border-yellow-200 dark:border-yellow-500/10">
                <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-500 uppercase block mb-1">Admin Remarks</span>
                <p className="text-sm text-gray-700 dark:text-gray-300">{complaint.adminRemarks}</p>
              </div>
            )}
          </div>

          {/* Completion Form */}
          {(complaint.status === 'Work In Progress' || complaint.status === 'In Progress' || complaint.status === 'Started' || complaint.status === 'Accepted') && (
            <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6 transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Camera className="w-5 h-5 mr-2 text-primary" />
                Complete Work
              </h2>

              {error && (
                <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Upload Photos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Completion Photos * (at least 1 required)
                  </label>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {completionPhotos.map((photo, index) => (
                      <div key={index} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Preview ${index}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <label className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-all bg-gray-50 dark:bg-gray-950/50">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        multiple
                      />
                    </label>
                  </div>
                </div>

                {/* Upload Video (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Completion Video (Optional)
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl cursor-pointer hover:border-primary/30 transition-all">
                    <Video className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-500 truncate">
                      {completionVideo ? completionVideo.name : 'Upload video'}
                    </span>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => setCompletionVideo(e.target.files[0])}
                    />
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Completion Notes
                  </label>
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    rows="3"
                    className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="Describe the work done..."
                  />
                </div>

                <button
                  onClick={handleComplete}
                  disabled={submitting}
                  className="w-full flex justify-center items-center py-3.5 px-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Submitting...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Send className="w-4 h-4 mr-2" />
                      Submit Completed Work
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Completed Work Display */}
          {complaint.completion && complaint.completion.photos && complaint.completion.photos.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6 transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                Completion Evidence
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {complaint.completion.photos.map((photo, idx) => (
                  <div key={idx} className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                    <img
                      src={`${imageBaseUrl}${photo}`}
                      alt={`Completion ${idx + 1}`}
                      className="w-full h-40 object-cover"
                    />
                  </div>
                ))}
              </div>

              {complaint.completion.video && (
                <div className="mb-4">
                  <span className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Completion Video</span>
                  <video
                    controls
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 max-h-64"
                  >
                    <source src={`${imageBaseUrl}${complaint.completion.video}`} />
                  </video>
                </div>
              )}

              {complaint.completion.notes && (
                <div className="bg-gray-50 dark:bg-gray-950/50 p-4 rounded-xl border border-gray-200/50 dark:border-gray-800/50">
                  <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Notes</span>
                  <p className="text-gray-800 dark:text-gray-200">{complaint.completion.notes}</p>
                </div>
              )}

              <div className="mt-4 text-xs text-gray-500 flex items-center">
                <Calendar className="w-3 h-3 mr-1" />
                Completed on {complaint.completion.completedAt ? new Date(complaint.completion.completedAt).toLocaleString() : 'N/A'}
                {complaint.completion.completedBy && <span className="ml-3">by {complaint.completion.completedBy}</span>}
              </div>

              {complaint.status === 'Completed' && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Awaiting resident confirmation
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar - Timeline */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6 transition-colors">
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="flex items-center justify-between w-full text-left"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Status Timeline</h2>
              {showTimeline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showTimeline && (
              <div className="mt-4 space-y-4">
                {timeline.length === 0 ? (
                  <p className="text-sm text-gray-500">No timeline entries yet.</p>
                ) : (
                  <div className="relative">
                    {timeline.map((entry, idx) => (
                      <div key={idx} className="flex items-start gap-3 pb-4 relative">
                        {idx < timeline.length - 1 && (
                          <div className="absolute left-[7px] top-5 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                        )}
                        <div className={`w-4 h-4 rounded-full mt-0.5 border-2 shrink-0 ${
                          entry.icon === 'submitted' ? 'bg-purple-500 border-purple-200' :
                          entry.icon === 'verified' ? 'bg-teal-500 border-teal-200' :
                          entry.icon === 'assigned' ? 'bg-blue-500 border-blue-200' :
                          entry.icon === 'accepted' ? 'bg-indigo-500 border-indigo-200' :
                          entry.icon === 'started' ? 'bg-cyan-500 border-cyan-200' :
                          entry.icon === 'in_progress' ? 'bg-amber-500 border-amber-200' :
                          entry.icon === 'completed' ? 'bg-green-500 border-green-200' :
                          entry.icon === 'approved' ? 'bg-emerald-500 border-emerald-200' :
                          entry.icon === 'reopened' ? 'bg-orange-500 border-orange-200' :
                          'bg-gray-500 border-gray-200'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.stage}</p>
                          {entry.person && (
                            <p className="text-xs text-gray-500">by {entry.person}</p>
                          )}
                          {entry.remarks && (
                            <p className="text-xs text-gray-400 mt-0.5 italic">"{entry.remarks}"</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {entry.date} {entry.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6 transition-colors">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Info</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className="font-medium text-gray-900 dark:text-white">{complaint.status}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Priority</span>
                <span className={`font-medium ${
                  complaint.priority === 'Urgent' ? 'text-red-500' :
                  complaint.priority === 'High' ? 'text-orange-500' : 'text-gray-900 dark:text-white'
                }`}>
                  {complaint.priority || 'Normal'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Assigned Worker</span>
                <span className="font-medium text-gray-900 dark:text-white">{complaint.assignedWorker || '-'}</span>
              </div>
              {complaint.assignment?.assignedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Assigned On</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(complaint.assignment.assignedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkTrackPage;

