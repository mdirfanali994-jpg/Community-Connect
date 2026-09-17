import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Bell, Pin, Clock, Calendar, Search, FileText, Download, X, AlertTriangle, Info
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { connectAsRole } from '../services/socket';
import {
  NOTICE_CATEGORIES, NOTICE_CATEGORY_MAP, NOTICE_PRIORITIES, NOTICE_PRIORITY_MAP,
  formatDateTime, formatDate
} from '../components/community/communityConstants';

const NoticeBoard = () => {
  const [user, setUser] = useState(null);
  const [notices, setNotices] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  const fetchNotices = useCallback(async (uid) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/notices?userId=${uid}&category=${filter}&search=${encodeURIComponent(search)}`
      );
      if (res.data.success) {
        setNotices(res.data.notices);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('fetchNotices error:', err);
    }
  }, [filter, search]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw || (JSON.parse(raw).role !== 'resident' && JSON.parse(raw).role !== 'admin')) {
      navigate('/login');
      return;
    }
    const parsed = JSON.parse(raw);
    setUser(parsed);
    const uid = parsed.id;
    const load = async () => {
      setLoading(true);
      await fetchNotices(uid);
      setLoading(false);
    };
    load();

    const socket = connectAsRole('resident', parsed?.communityId);
    socket.on('notice:new', () => fetchNotices(uid));
    socket.on('notice:updated', () => fetchNotices(uid));
    socket.on('notice:deleted', () => fetchNotices(uid));
    return () => {
      socket.off('notice:new');
      socket.off('notice:updated');
      socket.off('notice:deleted');
    };
  }, [navigate, fetchNotices]);

  const handleOpen = async (notice) => {
    setSelected(notice);
    if (!notice.isRead) {
      try {
        await axios.get(`${API_BASE_URL}/notices/${notice._id}?userId=${user.id}`);
        fetchNotices(user.id);
      } catch (err) {
        console.error('mark read error:', err);
      }
    }
  };

  const priorityOrder = { emergency: 0, important: 1, normal: 2 };
  const sorted = [...notices].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
  });

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Notice Board...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notice Board</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Community announcements & updates</p>
            </div>
          </div>
        </div>
        {unreadCount > 0 && (
          <span className="mt-3 sm:mt-0 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-sm font-semibold">
            {unreadCount} unread
          </span>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notices..."
            className="w-full pl-9 pr-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-sm outline-none"
        >
          <option value="all">All Categories</option>
          {NOTICE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Notice Cards */}
      {sorted.length === 0 ? (
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-12 rounded-3xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">No notices found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((n) => {
            const priority = NOTICE_PRIORITIES.find((p) => p.key === n.priority);
            return (
              <div
                key={n._id}
                onClick={() => handleOpen(n)}
                className={`bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-5 rounded-2xl border transition-all cursor-pointer hover:border-primary/30 ${
                  n.priority === 'emergency'
                    ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                    : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {n.priority === 'emergency' && (
                        <span className="flex items-center px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-full text-xs font-semibold">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Emergency
                        </span>
                      )}
                      {n.priority === 'important' && (
                        <span className="flex items-center px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-semibold">
                          <Info className="w-3 h-3 mr-1" /> Important
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                        {NOTICE_CATEGORY_MAP[n.category] || n.category}
                      </span>
                      {n.pinned && (
                        <span className="flex items-center px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                          <Pin className="w-3 h-3 mr-1" /> Pinned
                        </span>
                      )}
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary inline-block" />}
                    </div>
                    <h3 className={`mt-2 font-semibold text-gray-900 dark:text-white ${!n.isRead ? 'font-bold' : ''}`}>
                      {n.title}
                    </h3>
                    {n.description && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2" dangerouslySetInnerHTML={{ __html: n.description }} />
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" />{formatDate(n.createdAt)}</span>
                      {n.attachments?.length > 0 && (
                        <span className="flex items-center"><FileText className="w-3 h-3 mr-1" />{n.attachments.length} attachment(s)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {selected.priority === 'emergency' && (
                    <span className="flex items-center px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-full text-xs font-semibold">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Emergency
                    </span>
                  )}
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                    {NOTICE_CATEGORY_MAP[selected.category] || selected.category}
                  </span>
                  {selected.pinned && (
                    <span className="flex items-center px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                      <Pin className="w-3 h-3 mr-1" /> Pinned
                    </span>
                  )}
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{selected.title}</h2>
              <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" />{formatDate(selected.createdAt)}</span>
                {selected.scheduledAt && (
                  <span className="flex items-center"><Clock className="w-3 h-3 mr-1" />Scheduled: {formatDateTime(selected.scheduledAt)}</span>
                )}
              </div>

              {selected.description && (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 mb-4"
                  dangerouslySetInnerHTML={{ __html: selected.description }}
                />
              )}

              {selected.attachments?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Attachments</h4>
                  <div className="space-y-2">
                    {selected.attachments.map((att, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                        <span className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                          <FileText className="w-4 h-4 mr-2 text-primary" />
                          {att.originalName || att.filename}
                        </span>
                        <a
                          href={`${API_BASE_URL.replace('/api', '')}/uploads/${att.filename}`}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeBoard;
