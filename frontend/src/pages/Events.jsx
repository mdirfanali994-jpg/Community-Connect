import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Calendar, MapPin, Clock, Users, CheckCircle, XCircle, HelpCircle, QrCode, Search, X
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { API_BASE_URL } from '../config/api';
import { connectAsRole } from '../services/socket';
import {
  EVENT_CATEGORIES, EVENT_CATEGORY_MAP, RSVP_STATUSES, formatDateTime, formatDate
} from '../components/community/communityConstants';

const Events = () => {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('upcoming');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInCode, setCheckInCode] = useState('');
  const [rsvpBusy, setRsvpBusy] = useState(null);
  const navigate = useNavigate();

  const fetchEvents = useCallback(async (uid) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/events?userId=${uid}&scope=${scope}&category=${category}`
      );
      if (res.data.success) setEvents(res.data.events);
    } catch (err) {
      console.error('fetchEvents error:', err);
    }
  }, [scope, category]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw || JSON.parse(raw).role !== 'resident') {
      navigate('/login');
      return;
    }
    const parsed = JSON.parse(raw);
    setUser(parsed);
    const uid = parsed.id;
    const load = async () => {
      setLoading(true);
      await fetchEvents(uid);
      setLoading(false);
    };
    load();

    const socket = connectAsRole('resident', parsed?.communityId);
    socket.on('event:new', () => fetchEvents(uid));
    socket.on('event:updated', () => fetchEvents(uid));
    socket.on('event:deleted', () => fetchEvents(uid));
    return () => {
      socket.off('event:new');
      socket.off('event:updated');
      socket.off('event:deleted');
    };
  }, [navigate, fetchEvents]);

  const handleRsvp = async (eventId, status) => {
    if (!user) return;
    setRsvpBusy(eventId);
    try {
      const res = await axios.put(`${API_BASE_URL}/events/${eventId}/rsvp`, {
        userId: user.id,
        status,
      });
      if (res.data.success) {
        setSelected(null);
        await fetchEvents(user.id);
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to RSVP');
    } finally {
      setRsvpBusy(null);
    }
  };

  const handleViewCheckIn = async (eventId) => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/events/${eventId}/checkin?userId=${user.id}`);
      if (res.data.success) {
        setCheckInCode(res.data.checkInCode);
        setShowCheckIn(true);
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to load check-in code');
    }
  };

  const openEvent = async (event) => {
    setSelected(event);
    try {
      const res = await axios.get(`${API_BASE_URL}/events/${event._id}?userId=${user.id}`);
      if (res.data.success) setSelected(res.data.event);
    } catch (err) {
      console.error('load event error:', err);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Events...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Community Events</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">RSVP and stay connected with your community</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {[
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'past', label: 'Past' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                scope === s.key ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-sm outline-none"
        >
          <option value="all">All Categories</option>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Event Cards */}
      {events.length === 0 ? (
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-12 rounded-3xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">No events found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((e) => (
            <div
              key={e._id}
              onClick={() => openEvent(e)}
              className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden cursor-pointer hover:border-primary/30 transition-all"
            >
              {e.banner && (
                <img
                  src={`${API_BASE_URL.replace('/api', '')}/uploads/${e.banner}`}
                  alt={e.title}
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                    {EVENT_CATEGORY_MAP[e.category] || e.category}
                  </span>
                  {e.myRsvp && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      e.myRsvp === 'going' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
                      e.myRsvp === 'maybe' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' :
                      'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400'
                    }`}>
                      {e.myRsvp === 'going' ? 'Going' : e.myRsvp === 'maybe' ? 'Maybe' : 'Not Going'}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{e.title}</h3>
                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex items-center"><Calendar className="w-3 h-3 mr-1.5" />{formatDateTime(e.date)}</div>
                  {e.venue && <div className="flex items-center"><MapPin className="w-3 h-3 mr-1.5" />{e.venue}</div>}
                  <div className="flex items-center"><Users className="w-3 h-3 mr-1.5" />{e.going} going{e.maxParticipants > 0 ? ` / ${e.maxParticipants}` : ''}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[85vh] overflow-y-auto">
            {selected.banner && (
              <img src={`${API_BASE_URL.replace('/api', '')}/uploads/${selected.banner}`} alt={selected.title} className="w-full h-48 object-cover rounded-t-3xl" />
            )}
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">{EVENT_CATEGORY_MAP[selected.category] || selected.category}</span>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-2">{selected.title}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-primary" />
                  <div>
                    <span className="text-xs text-gray-500 block">Date & Time</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDateTime(selected.date)}</span>
                  </div>
                </div>
                {selected.venue && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-primary" />
                    <div>
                      <span className="text-xs text-gray-500 block">Venue</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{selected.venue}</span>
                    </div>
                  </div>
                )}
                {selected.organizer && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                    <span className="text-xs text-gray-500 block">Organizer</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{selected.organizer}</span>
                  </div>
                )}
                <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                  <span className="text-xs text-gray-500 block">Capacity</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {selected.maxParticipants > 0 ? `${selected.going}/${selected.maxParticipants} going${selected.spotsLeft !== null ? ` (${selected.spotsLeft} left)` : ''}` : `${selected.going} going (unlimited)`}
                  </span>
                </div>
              </div>

              {selected.description && (
                <div className="mb-4 text-sm text-gray-700 dark:text-gray-300">{selected.description}</div>
              )}

              {/* RSVP Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => handleRsvp(selected._id, 'going')}
                  disabled={rsvpBusy === selected._id || (selected.spotsLeft === 0 && selected.myRsvp !== 'going')}
                  className={`flex items-center px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                    selected.myRsvp === 'going' ? 'bg-green-500 text-white' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 mr-1.5" /> {selected.myRsvp === 'going' ? 'Going' : 'Going'}
                </button>
                <button
                  onClick={() => handleRsvp(selected._id, 'maybe')}
                  disabled={rsvpBusy === selected._id}
                  className={`flex items-center px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                    selected.myRsvp === 'maybe' ? 'bg-amber-500 text-white' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <HelpCircle className="w-4 h-4 mr-1.5" /> {selected.myRsvp === 'maybe' ? 'Maybe' : 'Maybe'}
                </button>
                <button
                  onClick={() => handleRsvp(selected._id, 'not_going')}
                  disabled={rsvpBusy === selected._id}
                  className={`flex items-center px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                    selected.myRsvp === 'not_going' ? 'bg-red-500 text-white' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                  }`}
                >
                  <XCircle className="w-4 h-4 mr-1.5" /> {selected.myRsvp === 'not_going' ? 'Not Going' : 'Not Going'}
                </button>
                {selected.myRsvp === 'going' && (
                  <button
                    onClick={() => handleViewCheckIn(selected._id)}
                    className="flex items-center px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold"
                  >
                    <QrCode className="w-4 h-4 mr-1.5" /> Check-in Code
                  </button>
                )}
              </div>

              {/* Attendees */}
              {selected.attendees?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Attendees ({selected.attendees.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selected.attendees.map((a, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-50 dark:bg-gray-950/50 rounded-lg text-xs text-gray-700 dark:text-gray-300">
                        {a.residentName} {a.block}-{a.flatNumber} {a.checkedIn && '✅'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Check-in Code Modal */}
      {showCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm border border-gray-200 dark:border-gray-800 shadow-2xl p-6 text-center">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <QrCode className="w-5 h-5 mr-2 text-primary" /> Event Check-in
              </h3>
              <button onClick={() => setShowCheckIn(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex justify-center p-4">
              <div className="bg-white p-3 rounded-xl shadow-lg">
                <QRCode value={checkInCode} size={180} />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-2">Show this QR to the organizer at the event.</p>
            <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800 font-mono font-bold text-primary">{checkInCode}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
