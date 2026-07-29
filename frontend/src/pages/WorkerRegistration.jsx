import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Search, Wrench, UserPlus, KeyRound, Camera, MapPin } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const SKILL_OPTIONS = [
  'Electrician', 'Plumber', 'Carpenter', 'Cleaner',
  'Security', 'Gardener', 'Painter', 'Technician', 'Others'
];

const WorkerRegistration = () => {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');

  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [experience, setExperience] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [address, setAddress] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
          `${API_BASE_URL}/onboarding/communities?search=${encodeURIComponent(q)}`
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

    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [search]);

  const toggleSkill = (skill) => {
    setSelectedSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const validate = () => {
    if (!hasSelection) return 'Please select a society from the search results.';
    if (!name.trim()) return 'Full name is required';
    if (!mobileNumber.trim()) return 'Mobile number is required';
    if (!email.trim()) return 'Email is required';
    if (!password) return 'Password is required';
    if (!confirmPassword) return 'Confirm password is required';
    if (password !== confirmPassword) return 'Passwords do not match';
    if (selectedSkills.length === 0) return 'Please select at least one skill';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('mobileNumber', mobileNumber);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('confirmPassword', confirmPassword);
      formData.append('skills', JSON.stringify(selectedSkills));
      formData.append('experience', experience);
      formData.append('aadhaarNumber', aadhaarNumber);
      formData.append('communityId', selectedCommunityId);
      formData.append('address', address);
      if (profilePhoto) {
        formData.append('profilePhoto', profilePhoto);
      }

      const res = await axios.post(
        `${API_BASE_URL}/workers/register`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (res.data.success) {
        setSuccess('Your registration is awaiting approval from the Society Admin.');
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(res.data.message || 'Registration failed');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed. Please try again.');
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
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                Join as Worker
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors text-sm">
                Register as a service professional for your community.
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

        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 rounded-xl text-sm flex items-center">
            <span className="w-1 h-4 bg-green-500 rounded-full mr-2" />
            {success}
          </div>
        )}

        {/* Society Selection */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors flex items-center">
            <Search className="w-5 h-5 text-primary mr-2" />
            Select Your Society
          </h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Search by society name</label>
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="Start typing your society name..."
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          {communities.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-950/40 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select one:</div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {communities.map((c) => {
                  const active = c._id === selectedCommunityId;
                  return (
                    <button
                      type="button"
                      key={c._id}
                      onClick={() => { setSelectedCommunityId(c._id); setError(''); }}
                      className={
                        active
                          ? 'w-full text-left px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-gray-900 dark:text-gray-100'
                          : 'w-full text-left px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary/30'
                      }
                    >
                      <div className="font-medium">{c.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasSelection && (
            <div className="text-sm text-green-600 dark:text-green-400 font-medium">
              ✓ Society selected.
            </div>
          )}
        </section>

        {/* Personal Details */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors flex items-center">
            <UserPlus className="w-5 h-5 text-primary mr-2" />
            Personal Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="Your full name"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number *</label>
              <input
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="Phone number"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email *</label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Aadhaar/ID Number</label>
              <input
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="Optional ID number"
              />
            </div>
          </div>
        </section>

        {/* Skills & Experience */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors flex items-center">
            <Wrench className="w-5 h-5 text-primary mr-2" />
            Skills & Experience
          </h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Skills * (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((skill) => (
                <button
                  type="button"
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    selectedSkills.includes(skill)
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-primary/30'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Experience</label>
              <select
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              >
                <option value="">Select experience</option>
                <option value="Fresher">Fresher</option>
                <option value="1-2 years">1-2 years</option>
                <option value="3-5 years">3-5 years</option>
                <option value="5-10 years">5-10 years</option>
                <option value="10+ years">10+ years</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Profile Photo</label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl cursor-pointer hover:border-primary/30 transition-all">
                <Camera className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-500 truncate">
                  {profilePhoto ? profilePhoto.name : 'Upload photo'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setProfilePhoto(e.target.files[0])}
                />
              </label>
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors flex items-center">
            <MapPin className="w-5 h-5 text-primary mr-2" />
            Address
          </h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows="2"
              className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="Your residential address"
            />
          </div>
        </section>

        {/* Password */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors flex items-center">
            <KeyRound className="w-5 h-5 text-primary mr-2" />
            Create Password
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password *</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password *</label>
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
            After registration, your profile will be sent to the Society Admin for approval.
            You will be notified once approved.
          </div>
        </section>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-3.5 px-4 bg-gradient-to-r from-primary to-cyan-500 dark:from-primary dark:to-cyan-400 hover:from-cyan-500 hover:to-primary dark:hover:from-cyan-400 dark:hover:to-primary text-white dark:text-gray-950 rounded-xl font-bold shadow-md dark:shadow-lg shadow-primary/20 dark:shadow-primary/20 transition-all disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Submitting...
            </span>
          ) : (
            'Register as Worker'
          )}
        </button>
      </form>
    </div>
  );
};

export default WorkerRegistration;

