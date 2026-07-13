import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Search, UserPlus, Building, Loader2, KeyRound } from 'lucide-react';

const JoinCommunity = () => {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [block, setBlock] = useState('');
  const [flatNumber, setFlatNumber] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasSelection = useMemo(() => Boolean(selectedCommunityId), [selectedCommunityId]);

  useEffect(() => {
    const run = async () => {
      const q = search.trim();
      if (!q) {
        setCommunities([]);
        return;
      }
      setSearchLoading(true);
      try {
        const res = await axios.get(
          `https://community-connect-backend-wqwc.onrender.com/api/onboarding/communities?search=${encodeURIComponent(
            q
          )}`
        );
        if (res.data.success) {
          setCommunities(res.data.communities || []);
        } else {
          setCommunities([]);
        }
      } catch (e) {
        console.error('community search error:', e);
        setCommunities([]);
      } finally {
        setSearchLoading(false);
      }
    };

    // Debounce-ish: simple timeout to reduce spam without new dependencies
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [search]);

  const handlePickCommunity = (communityId) => {
    setSelectedCommunityId(communityId);
    setError('');
  };

  const validate = () => {
    if (!hasSelection) return 'Please select a community from the search results.';
    if (!fullName.trim()) return 'Full name is required';
    if (!email.trim()) return 'Email is required';
    if (!phone.trim()) return 'Phone is required';
    if (!block.trim()) return 'Block is required';
    if (!flatNumber.trim()) return 'Flat number is required';
    if (!password) return 'Password is required';
    if (!confirmPassword) return 'Confirm password is required';
    if (password !== confirmPassword) return 'Password and confirm password must match';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        fullName,
        email,
        phone,
        communityId: selectedCommunityId,
        block,
        flatNumber,
        password,
        confirmPassword,
      };

      const res = await axios.post(
        'https://community-connect-backend-wqwc.onrender.com/api/onboarding/join-community',
        payload
      );

      if (res.data.success) {
        alert('Your request has been sent to the Community Administrator. Please wait for approval.');
        navigate('/login');
        return;
      }

      setError(res.data.message || 'Failed to send request');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in transition-colors duration-300">
      <div className="flex justify-between items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 relative overflow-hidden shrink-0">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                Join Existing Community
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors text-sm">
                Search your society and request access.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="relative z-10 flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-6 transition-colors"
      >
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center">
            <span className="w-1 h-4 bg-red-500 rounded-full mr-2" />
            {error}
          </div>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors flex items-center">
            <Search className="w-5 h-5 text-primary mr-2" />
            Find Community
          </h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Search by name</label>
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="Start typing your society name..."
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {communities.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-950/40 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select one</div>
              <div className="space-y-2">
                {communities.map((c) => {
                  const active = c._id === selectedCommunityId;
                  return (
                    <button
                      type="button"
                      key={c._id}
                      onClick={() => handlePickCommunity(c._id)}
                      className={
                        active
                          ? 'w-full text-left px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-gray-900 dark:text-gray-100'
                          : 'w-full text-left px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary/30'
                      }
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {active ? 'Selected' : 'Click to select'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasSelection && (
            <div className="text-sm text-green-600 dark:text-green-400 font-medium">
              Community selected. Continue the request below.
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors flex items-center">
            <UserPlus className="w-5 h-5 text-primary mr-2" />
            Resident Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="Your full name"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="Phone number"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Block</label>
              <input
                value={block}
                onChange={(e) => setBlock(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="e.g. A, B, C..."
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Flat Number</label>
              <input
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="e.g. 101, A-101..."
                required
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors flex items-center">
            <KeyRound className="w-5 h-5 text-primary mr-2" />
            Create Password
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                required
              />
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            After you submit, your request will be sent to the Community Administrator for approval.
          </div>
        </section>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-3.5 px-4 bg-gradient-to-r from-primary to-cyan-500 dark:from-primary dark:to-cyan-400 hover:from-cyan-500 hover:to-primary dark:hover:from-cyan-400 dark:hover:to-primary text-white dark:text-gray-950 rounded-xl font-bold shadow-md dark:shadow-lg shadow-primary/20 dark:shadow-primary/20 transition-all disabled:opacity-50"
        >
          {loading ? 'Sending Request...' : 'Send Request'}
        </button>
      </form>
    </div>
  );
};

export default JoinCommunity;
