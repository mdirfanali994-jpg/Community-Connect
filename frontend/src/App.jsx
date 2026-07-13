import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Sun, Moon, MapPin } from 'lucide-react';
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import WorkerDashboard from './pages/WorkerDashboard';
import PublicBoard from './pages/PublicBoard';
import CommunityMap from './pages/CommunityMap';
import ErrorBoundary from './ErrorBoundary';
import OnboardingLanding from './pages/OnboardingLanding';
import CreateCommunity from './pages/CreateCommunity';
import JoinCommunity from './pages/JoinCommunity';

function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // Default to dark based on premium theme
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 font-sans selection:bg-primary/30 transition-colors duration-300">
        <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400">Community Connect</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <Link to="/map" className="flex items-center text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors">
                  <MapPin className="w-4 h-4 mr-1.5" />
                  Map View
                </Link>
                <button 
                  onClick={toggleTheme}
                  className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Toggle Theme"
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </nav>
        
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 relative">
          {/* Subtle background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 dark:bg-primary/10 blur-[120px] rounded-full pointer-events-none transition-colors duration-300"></div>
          
          <div className="relative z-10">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<OnboardingLanding />} />
                <Route path="/onboarding/create-community" element={<CreateCommunity />} />
                <Route path="/onboarding/join-community" element={<JoinCommunity />} />
                <Route path="/login" element={<Login />} />
                <Route path="/user/dashboard" element={<UserDashboard />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/worker/dashboard" element={<WorkerDashboard />} />
                <Route path="/public-board" element={<PublicBoard />} />
                <Route path="/map" element={<CommunityMap />} />
              </Routes>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
