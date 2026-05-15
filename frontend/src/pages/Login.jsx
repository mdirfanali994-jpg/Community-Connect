import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogIn, User, Lock } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post('https://community-connect-xsvo.onrender.com/api/login', { email, password });
      if (res.data.success) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        
        switch (res.data.user.role) {
          case 'admin':
            navigate('/admin/dashboard');
            break;
          case 'worker':
            navigate('/worker/dashboard');
            break;
          default:
            navigate('/user/dashboard');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] animate-fade-in">
      <div className="w-full max-w-md bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-8 rounded-3xl shadow-xl dark:shadow-2xl border border-gray-200 dark:border-gray-800 relative overflow-hidden group transition-colors duration-300">
        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 dark:bg-primary/20 rounded-full blur-[50px] transition-all duration-700 group-hover:bg-primary/20 dark:group-hover:bg-primary/30"></div>
        
        <div className="text-center mb-8 relative z-10">
          <div className="w-14 h-14 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm dark:shadow-lg transition-colors">
            <LogIn className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Welcome Back</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Sign in to manage community complaints</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center">
              <span className="w-1 h-4 bg-red-500 rounded-full mr-2"></span>
              {error}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Email Address</label>
            <div className="relative group/input">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within/input:text-primary transition-colors" />
              </div>
              <input
                type="email"
                required
                className="w-full pl-10 pr-3 py-3 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                placeholder="user@test.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Password</label>
            <div className="relative group/input">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within/input:text-primary transition-colors" />
              </div>
              <input
                type="password"
                required
                className="w-full pl-10 pr-3 py-3 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-500 dark:text-gray-400 font-mono mt-4 transition-colors">
            <div className="text-gray-700 dark:text-gray-300 mb-1 font-sans font-medium text-sm">Demo Accounts:</div>
            <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-800/50"><span className="text-gray-500">User</span> <span className="text-primary dark:text-primary/90">user@test.com</span></div>
            <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-800/50"><span className="text-gray-500">Admin</span> <span className="text-primary dark:text-primary/90">admin@test.com</span></div>
            <div className="flex justify-between items-center py-1"><span className="text-gray-500">Worker</span> <span className="text-primary dark:text-primary/90">worker@test.com</span></div>
            <div className="mt-2 text-gray-500 text-center border-t border-gray-200 dark:border-gray-800 pt-2">Password: <span className="text-gray-700 dark:text-gray-300">password</span></div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md dark:shadow-lg dark:shadow-primary/20 text-sm font-semibold text-white dark:text-gray-900 bg-gradient-to-r from-primary to-cyan-500 dark:to-cyan-400 hover:from-cyan-500 hover:to-primary dark:hover:from-cyan-400 dark:hover:to-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
          >
            {loading ? (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : 'Sign Into Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
