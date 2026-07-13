import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Building2, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';

const CreateCommunity = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [communityName, setCommunityName] = useState('');
  const [communityAddress, setCommunityAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [communityType, setCommunityType] = useState('Society');
  const [gatedCommunity, setGatedCommunity] = useState(false);

  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const validate = () => {
    if (!communityName.trim()) return 'Community name is required';
    if (!communityAddress.trim()) return 'Community address is required';
    if (!city.trim()) return 'City is required';
    if (!state.trim()) return 'State is required';
    if (!pinCode.trim()) return 'Pincode is required';

    if (!adminFullName.trim()) return 'Admin full name is required';
    if (!adminEmail.trim()) return 'Admin email is required';
    if (!adminPhone.trim()) return 'Admin phone is required';

    if (!password) return 'Password is required';
    if (!confirmPassword) return 'Confirm password is required';
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
        communityName,
        communityAddress,
        city,
        state,
        pinCode,
        communityType,
        gatedCommunity,
        adminFullName,
        adminEmail,
        adminPhone,
        password,
        confirmPassword,
      };

      const res = await axios.post(
        'https://community-connect-backend-wqwc.onrender.com/api/onboarding/create-community',
        payload
      );

      if (res.data.success) {
        alert('Community created successfully. Please login with your admin credentials.');
        navigate('/login');
        return;
      }

      setError(res.data.message || 'Failed to create community');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create community');
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
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                Create Community
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors text-sm">
                Set up your society admin account to manage resident requests and complaints.
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
            <ShieldCheck className="w-5 h-5 text-primary mr-2" />
            Society Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Community Name</label>
              <input
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="e.g. Green Valley Residency"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Community Type</label>
              <select
                value={communityType}
                onChange={(e) => setCommunityType(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              >
                <option value="Society">Society</option>
                <option value="Apartment">Apartment</option>
                <option value="Gated Community">Gated Community</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
              <input
                value={communityAddress}
                onChange={(e) => setCommunityAddress(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="Street / Locality"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="City"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">State</label>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="State"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pincode</label>
              <input
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="e.g. 560001"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gated Community</label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={gatedCommunity}
                  onChange={(e) => setGatedCommunity(e.target.checked)}
                  className="h-4 w-4 text-primary focus:ring-primary/50"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {gatedCommunity ? 'Yes' : 'No'}
                </span>
              </label>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">
            Admin Account
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Admin Full Name</label>
              <input
                value={adminFullName}
                onChange={(e) => setAdminFullName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="Full name"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Admin Email</label>
              <input
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                type="email"
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="admin@community.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Admin Phone</label>
              <input
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="Phone number"
                required
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors flex items-center">
            <KeyRound className="w-5 h-5 text-primary mr-2" />
            Set Password
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
        </section>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-3.5 px-4 bg-gradient-to-r from-primary to-cyan-500 dark:from-primary dark:to-cyan-400 hover:from-cyan-500 hover:to-primary dark:hover:from-cyan-400 dark:hover:to-primary text-white dark:text-gray-950 rounded-xl font-bold shadow-md dark:shadow-lg shadow-primary/20 dark:shadow-primary/20 transition-all disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Community'}
        </button>
      </form>
    </div>
  );
};

export default CreateCommunity;
