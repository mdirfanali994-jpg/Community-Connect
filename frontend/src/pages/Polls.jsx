import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart2, CheckCircle2, Lock, X } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { connectAsRole } from '../services/socket';
import { POLL_CHOICE_LABELS, formatDateTime } from '../components/community/communityConstants';

const Polls = () => {
  const [user, setUser] = useState(null);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('open');
  const [selected, setSelected] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [voting, setVoting] = useState(false);
  const navigate = useNavigate();

  const fetchPolls = useCallback(async (uid) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/polls?userId=${uid}&status=${scope}`);
      if (res.data.success) setPolls(res.data.polls);
    } catch (err) {
      console.error('fetchPolls error:', err);
    }
  }, [scope]);

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
      await fetchPolls(uid);
      setLoading(false);
    };
    load();

    const socket = connectAsRole('resident', parsed?.communityId);
    socket.on('poll:new', () => fetchPolls(uid));
    socket.on('poll:updated', () => fetchPolls(uid));
    socket.on('poll:deleted', () => fetchPolls(uid));
    socket.on('poll:vote', () => fetchPolls(uid));
    return () => {
      socket.off('poll:new');
      socket.off('poll:updated');
      socket.off('poll:deleted');
      socket.off('poll:vote');
    };
  }, [navigate, fetchPolls]);

  const openPoll = (p) => {
    setSelected(p);
    setSelectedOptions(p.myVote || []);
  };

  const toggleOption = (idx) => {
    setSelectedOptions((prev) => {
      const poll = selected;
      if (poll?.choiceMode === 'single') {
        return [idx];
      }
      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
      return [...prev, idx];
    });
  };

  const handleVote = async () => {
    if (!user || !selected) return;
    if (selectedOptions.length === 0) {
      alert('Please select at least one option');
      return;
    }
    setVoting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/polls/${selected._id}/vote`, {
        userId: user.id,
        selectedIndexes: selectedOptions,
      });
      if (res.data.success) {
        const refreshed = res.data.poll;
        setSelected(refreshed);
        setSelectedOptions(refreshed.myVote || []);
        await fetchPolls(user.id);
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to submit vote');
    } finally {
      setVoting(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Loading Polls...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
            <BarChart2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Community Polls</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Have your say in community decisions</p>
          </div>
        </div>
      </div>

      {/* Scope Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'open', label: 'Open Polls' },
          { key: 'closed', label: 'Closed Polls' },
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

      {/* Poll Cards */}
      {polls.length === 0 ? (
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-12 rounded-3xl border border-gray-200 dark:border-gray-800 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <BarChart2 className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">No polls found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {polls.map((p) => (
            <div
              key={p._id}
              onClick={() => openPoll(p)}
              className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 p-5 cursor-pointer hover:border-primary/30 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  p.closed ? 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                }`}>
                  {p.closed ? 'Closed' : 'Open'}
                </span>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {p.anonymous && <span className="flex items-center"><Lock className="w-3 h-3 mr-0.5" /> Anonymous</span>}
                  <span>{POLL_CHOICE_LABELS[p.choiceMode] || p.choiceMode}</span>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{p.title}</h3>
              <p className="text-xs text-gray-500 mb-3">{p.totalVotes} votes</p>
              {p.myVote && (
                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">✓ Voted</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Poll Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      selected.closed ? 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    }`}>
                      {selected.closed ? 'Closed' : 'Open'}
                    </span>
                    {selected.anonymous && <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-900/20 text-gray-500 rounded-full text-xs"><Lock className="w-3 h-3 inline mr-0.5" />Anonymous</span>}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selected.title}</h2>
                  {selected.expiresAt && (
                    <p className="text-xs text-gray-500 mt-1">Ends: {formatDateTime(selected.expiresAt)}</p>
                  )}
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              {selected.description && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{selected.description}</p>
              )}

              {/* Options */}
              <div className="space-y-3 mb-4">
                {selected.options.map((opt, idx) => {
                  const isVoted = selected.myVote?.includes(idx);
                  const isSelected = selectedOptions.includes(idx);
                  const showResults = !selected.closed && selected.hideResultsUntilEnd && !isVoted;
                  const result = selected.results?.[idx];
                  const pct = showResults ? 0 : (result?.percentage || 0);

                  return (
                    <div
                      key={idx}
                      onClick={() => { if (!selected.closed && !isVoted) toggleOption(idx); }}
                      className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50'
                      } ${selected.closed || isVoted ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {!showResults && (
                        <div
                          className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                      <div className="relative flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{opt.text}</span>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                      </div>
                      {!showResults && !selected.closed && !isVoted && isSelected && (
                        <div className="relative text-xs text-primary mt-1">Selected</div>
                      )}
                      {!showResults && (selected.closed || isVoted) && (
                        <div className="relative flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500">{result?.count || 0} vote{(result?.count || 0) === 1 ? '' : 's'}</span>
                          <span className="text-xs font-bold text-primary">{pct}%</span>
                        </div>
                      )}
                      {showResults && (
                        <div className="relative text-xs text-gray-500 mt-1">Vote to see results</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Vote Action */}
              {!selected.closed && !selected.myVote && (
                <button
                  onClick={handleVote}
                  disabled={voting || selectedOptions.length === 0}
                  className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                >
                  {voting ? 'Submitting...' : selected.choiceMode === 'multiple' ? `Submit Vote (${selectedOptions.length} selected)` : 'Submit Vote'}
                </button>
              )}

              {selected.myVote && (
                <div className="text-center text-sm text-gray-500">You have voted on this poll.</div>
              )}

              <div className="text-center text-xs text-gray-500 mt-3">{selected.totalVotes} total votes</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Polls;
