import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Sun, Moon, MapPin } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import WorkerDashboard from './pages/WorkerDashboard';
import WorkTrackPage from './pages/WorkTrackPage';
import WorkerProfile from './pages/WorkerProfile';
import PublicBoard from './pages/PublicBoard';
import CommunityMap from './pages/CommunityMap';
import ErrorBoundary from './ErrorBoundary';
import OnboardingLanding from './pages/OnboardingLanding';
import CreateCommunity from './pages/CreateCommunity';
import JoinCommunity from './pages/JoinCommunity';
import WorkerRegistration from './pages/WorkerRegistration';
import AdminFinance from './pages/AdminFinance';
import ResidentFinance from './pages/ResidentFinance';
import AdminVisitors from './pages/AdminVisitors';
import ResidentVisitors from './pages/ResidentVisitors';
import SecurityPackages from './pages/SecurityPackages';
import ResidentPackages from './pages/ResidentPackages';
import AdminPackages from './pages/AdminPackages';
import NoticeBoard from './pages/NoticeBoard';
import AdminNotices from './pages/AdminNotices';
import Events from './pages/Events';
import AdminEvents from './pages/AdminEvents';
import Polls from './pages/Polls';
import AdminPolls from './pages/AdminPolls';

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
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 font-sans selection:bg-primary/30 transition-colors duration-300">
          <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <Link to="/" className="flex items-center group py-1" aria-label="Community Connect Home">
                  <img
                    src="/assets/community-connect-logo.png"
                    alt="Community Connect"
                    className="h-9 sm:h-10 w-auto max-w-[240px] object-contain transition-transform group-hover:scale-[1.02]"
                  />
                </Link>
                
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
                  {/* Public routes */}
                  <Route path="/" element={<OnboardingLanding />} />
                  <Route path="/onboarding/create-community" element={<CreateCommunity />} />
                  <Route path="/onboarding/join-community" element={<JoinCommunity />} />
                  <Route path="/onboarding/join-worker" element={<WorkerRegistration />} />
                  <Route
                    path="/login"
                    element={
                      <PublicRoute>
                        <Login />
                      </PublicRoute>
                    }
                  />
                  <Route path="/public-board" element={<PublicBoard />} />
                  <Route path="/map" element={<CommunityMap />} />

                  {/* Resident protected routes */}
                  <Route
                    path="/user/dashboard"
                    element={
                      <ProtectedRoute allowedRoles={['resident']}>
                        <UserDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/user/finance"
                    element={
                      <ProtectedRoute allowedRoles={['resident']}>
                        <ResidentFinance />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/user/visitors"
                    element={
                      <ProtectedRoute allowedRoles={['resident']}>
                        <ResidentVisitors />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/user/packages"
                    element={
                      <ProtectedRoute allowedRoles={['resident']}>
                        <ResidentPackages />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/user/notices"
                    element={
                      <ProtectedRoute allowedRoles={['resident', 'admin']}>
                        <NoticeBoard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/user/events"
                    element={
                      <ProtectedRoute allowedRoles={['resident', 'admin']}>
                        <Events />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/user/polls"
                    element={
                      <ProtectedRoute allowedRoles={['resident', 'admin']}>
                        <Polls />
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin protected routes */}
                  <Route
                    path="/admin/dashboard"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/finance"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminFinance />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/visitors"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminVisitors />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/packages"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminPackages />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/notices"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminNotices />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/events"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminEvents />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/polls"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminPolls />
                      </ProtectedRoute>
                    }
                  />

                  {/* Worker protected routes */}
                  <Route
                    path="/worker/dashboard"
                    element={
                      <ProtectedRoute allowedRoles={['worker']}>
                        <WorkerDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/worker/work/:complaintId"
                    element={
                      <ProtectedRoute allowedRoles={['worker']}>
                        <WorkTrackPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/worker/profile"
                    element={
                      <ProtectedRoute allowedRoles={['worker']}>
                        <WorkerProfile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/worker/packages"
                    element={
                      <ProtectedRoute allowedRoles={['worker', 'admin']}>
                        <SecurityPackages />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
