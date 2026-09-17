import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Bell, Plus, Pin, Trash2, Pencil, Eye, X, Download, Search, Calendar, RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { connectAsRole } from '../services/socket';
import {
  NOTICE_CATEGORIES, NOTICE_CATEGORY_MAP, NOTICE_PRIORITIES, formatDateTime, formatDate
} from '../components/community/communityConstants';

const initialForm = {
  title: '',
  description: '',
  category: 'general',
  priority: 'normal',
  pinned: false,
  scheduledAt: '',
  expiresAt: '',
};

const AdminNotices = () => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...initialForm });
  const [editing, setEditing] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [flashMsg, setFlashMsg] = useState('');
  const navigate = useNavigate();

  const getHeaders = useCallback(() => {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return {
      'x-admin-id': String(user.id),
      'x-community-id': String(user.communityId),
    };
  }, []);

  const showFlash = useCallback((msg, type = 'success') => {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(''), 4000);
  }, []);

  const fetchNotices = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(
        `${API_BASE_URL}/notices/admin?status=${filter}&search=${encodeURIComponent(search)}`,
        { headers }
      );
      if (res.data.success) setNotices(res.data.notices);
    } catch (err) {
      console.error('fetchNotices error:', err);
    }
  }, [getHeaders, filter, search]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw || JSON.parse(raw).role !== 'admin') {
      navigate('/login');
      return;
    }
    const parsed = JSON.parse(raw);
    const load = async () => {
      setLoading(true);
      await fetchNotices();
      setLoading(false);
    };
    load();

    const socket = connectAsRole('admin', parsed?.communityId);
    socket.on('notice:new', () => fetchNotices());
    socket.on('notice:updated', () => fetchNotices());
    socket.on('notice:deleted', () => fetchNotices());
    return () => {
      socket.off('notice:new');
      socket.off('notice:updated');
      socket.off('notice:deleted');
    };
  }, [navigate, fetchNotices]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const headers = getHeaders();
    if (!headers) return;
    if (!form.title.trim()) {
      showFlash('Title is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('category', form.category);
      fd.append('priority', form.priority);
      fd.append('pinned', form.pinned);
      if (form.scheduledAt) fd.append('scheduledAt', form.scheduledAt);
      if (form.expiresAt) fd.append('expiresAt', form.expiresAt);
      attachments.forEach((f) => fd.append('attachments', f));

      let res;
      if (editing) {
        res = await axios.put(`${API_BASE_URL}/notices/${editing}`, fd, { headers });
      } else {
        res = await axios.post(`${API_BASE_URL}/notices`, fd, { headers });
      }
      if (res.data.success) {
        showFlash(editing ? 'Notice updated' : 'Notice created');
        setShowForm(false);
        setForm({ ...initialForm });
        setEditing(null);
        setAttachments([]);
        await fetchNotices();
      }
    } catch (err) {
      showFlash(err?.response?.data?.message || 'Failed to save notice', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this notice?')) return;
    const headers = getHeaders();
    if (!headers) return;
    try {
      await axios.delete(`${API_BASE_URL}/notices/${id}`, { headers });
      showFlash('Notice deleted');
      await fetchNotices();
    } catch (err) {
      showFlash('Failed to delete', 'error');
    }
  };

  const handleTogglePin = async (id, pinned) => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      await axios.put(`${API_BASE_URL}/notices/${id}/pin`, { pinned: !pinned }, { headers });
      await fetchNotices();
    } catch (err) {
      console.error('pin error:', err);
    }
  };

  const handleExport = async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/notices/export`, { headers, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'notices.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('export error:', err);
    }
  };

  const startEdit = (n) => {
    setEditing(n._id);
    setForm({
      title: n.title,
      description: n.description || '',
      category: n.category,
      priority: n.priority,
      pinned: n.pinned,
      scheduledAt: n.scheduledAt ? new Date(n.scheduledAt).toISOString().slice(0, 10) : '',
      expiresAt: n.expiresAt ? new Date(n.expiresAt).toISOString().slice(0, 10) : '',
    });
    setAttachments([]);
    setShowForm(true);
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Notice Board...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notice Board</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Create and manage community notices</p>
        </div>
        <div className="flex items-center gap-2 mt-3 sm:mt-0">
          <button onClick={handleExport} className="flex items-center px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-medium hover:bg-primary/20">
            <Download className="w-4 h-4 mr-1.5" /> Export
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ ...initialForm }); setAttachments([]); }}
            className="flex items-center px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" /> {showForm ? 'Close' : 'New Notice'}
          </button>
        </div>
      </div>

      {flashMsg && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl text-sm">
          {flashMsg}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Notice' : 'Create Notice'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-gray-500">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Notice title"
                required
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-gray-500">Description (rich text)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                placeholder="Write the notice content..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none"
              >
                {NOTICE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none"
              >
                {NOTICE_PRIORITIES.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Schedule Date</label>
              <input
                type="date"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Expiry Date</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Attachments (images/PDF/DOCX)</label>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => setAttachments(Array.from(e.target.files))}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary"
              />
            </div>
            <label className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="h-4 w-4 text-primary rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Pin to top</span>
            </label>
          </div>
          <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
            {submitting ? 'Saving...' : editing ? 'Update Notice' : 'Create Notice'}
          </button>
        </form>
      )}

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notices..."
            className="w-full pl-9 pr-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-sm outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="scheduled">Scheduled</option>
          <option value="expired">Expired</option>
        </select>
        <button onClick={fetchNotices} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-primary">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Notices Table */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Reads</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {notices.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-12 text-center text-gray-500">No notices found.</td></tr>
              ) : (
                notices.map((n) => (
                  <tr key={n._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                        {n.pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
                        {n.title}
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(n.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{NOTICE_CATEGORY_MAP[n.category] || n.category}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        n.priority === 'emergency' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' :
                        n.priority === 'important' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                        'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                      }`}>
                        {NOTICE_PRIORITIES.find((p) => p.key === n.priority)?.label || n.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        n.status === 'active' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' :
                        n.status === 'scheduled' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                        'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                      }`}>{n.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{n.readCount}/{n.totalResidents} ({n.unreadCount} unread)</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => setSelected(n)} className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary" title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleTogglePin(n._id, n.pinned)} className={`p-1.5 rounded-lg ${n.pinned ? 'bg-primary/10 text-primary' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary'}`} title={n.pinned ? 'Unpin' : 'Pin'}>
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => startEdit(n)} className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(n._id)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-600" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selected.title}</h2>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" />{formatDateTime(selected.createdAt)}</span>
                <span>•</span>
                <span>{NOTICE_CATEGORY_MAP[selected.category] || selected.category}</span>
                {selected.scheduledAt && <span>• Scheduled: {formatDateTime(selected.scheduledAt)}</span>}
              </div>
              {selected.description && (
                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 mb-4" dangerouslySetInnerHTML={{ __html: selected.description }} />
              )}
              {selected.attachments?.length > 0 && (
                <div className="space-y-2">
                  {selected.attachments.map((att, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{att.originalName || att.filename}</span>
                      <a href={`${API_BASE_URL.replace('/api', '')}/uploads/${att.filename}`} download target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20">
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotices;
