import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || null;
  });

  // loading represents initial session restoration from storage / verification
  const [loading, setLoading] = useState(true);

  // Synchronize axios defaults whenever token or user changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }

    if (user && user.role === 'admin') {
      const adminId = user.id || user._id;
      const commId = user.communityId;
      if (adminId) axios.defaults.headers.common['x-admin-id'] = String(adminId);
      if (commId) axios.defaults.headers.common['x-community-id'] = String(commId);
    } else {
      delete axios.defaults.headers.common['x-admin-id'];
      delete axios.defaults.headers.common['x-community-id'];
    }
  }, [token, user]);

  // Session restoration on mount / page refresh
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const storedUserRaw = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');

        if (!storedUserRaw && !storedToken) {
          if (isMounted) setLoading(false);
          return;
        }

        let parsedUser = null;
        if (storedUserRaw) {
          try {
            parsedUser = JSON.parse(storedUserRaw);
            if (isMounted) setUser(parsedUser);
          } catch (_) {
            localStorage.removeItem('user');
          }
        }

        if (storedToken) {
          if (isMounted) setToken(storedToken);

          // Verify session with the backend if token exists
          try {
            const res = await axios.get(`${API_BASE_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${storedToken}` },
              timeout: 4000,
            });

            if (res.data?.success && res.data?.user) {
              const freshUser = res.data.user;
              localStorage.setItem('user', JSON.stringify(freshUser));
              if (isMounted) setUser(freshUser);
            }
          } catch (verifyErr) {
            // If the server explicitly rejected the token as expired/invalid (401 or 403), revoke session
            const status = verifyErr.response?.status;
            if (status === 401 || status === 403) {
              console.warn('Session verification rejected by server; logging out.');
              localStorage.removeItem('user');
              localStorage.removeItem('token');
              if (isMounted) {
                setUser(null);
                setToken(null);
              }
            } else {
              // Network error, timeout, or 404 (endpoint not deployed on remote backend):
              // Preserve the restored user so page refresh works seamlessly!
              console.warn('Backend verification unavailable; preserving restored session.');
            }
          }
        }
      } catch (err) {
        console.error('Error during session restoration:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback((userData, authToken) => {
    // Generate a secure client token fallback if backend did not return one
    const effectiveToken = authToken || `cc_session_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', effectiveToken);

    setUser(userData);
    setToken(effectiveToken);
  }, []);

  const logout = useCallback(async () => {
    const currentToken = localStorage.getItem('token') || token;

    // Invalidate session on the backend
    if (currentToken) {
      try {
        await axios.post(
          `${API_BASE_URL}/logout`,
          {},
          {
            headers: { Authorization: `Bearer ${currentToken}` },
            timeout: 3000,
          }
        );
      } catch (_) {
        // Ignore backend errors during logout
      }
    }

    // Clear all client-side authentication credentials
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    delete axios.defaults.headers.common['x-admin-id'];
    delete axios.defaults.headers.common['x-community-id'];

    setUser(null);
    setToken(null);
  }, [token]);

  // Setup Axios 401 response interceptor for session expiration
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const isAuthError = error.response?.status === 401;
        const requestUrl = error.config?.url || '';
        const isLoginRequest = requestUrl.includes('/login');

        // If a protected request gets 401, invalidate session
        if (isAuthError && !isLoginRequest && user) {
          console.warn('Received 401 Unauthorized on protected request. Clearing session.');
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [logout, user]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!user,
      login,
      logout,
      setUser,
    }),
    [user, token, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
