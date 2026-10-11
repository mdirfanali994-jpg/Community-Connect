import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Prevent temporary authentication-loading states from being incorrectly treated as logged-out
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 animate-pulse">
        <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Restoring session...
        </p>
      </div>
    );
  }

  // Not authenticated: redirect to /login with replace to prevent back-button loops
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Check role authorization if restricted to specific roles
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect to the user's role-appropriate home
    if (user.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (user.role === 'worker') {
      return <Navigate to="/worker/dashboard" replace />;
    } else {
      return <Navigate to="/user/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
