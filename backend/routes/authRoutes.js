const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifySession, revokeSession } = require('../services/authService');
const CommunityUser = require('../models/CommunityUser');
const Worker = require('../models/Worker');
const Community = require('../models/Community');

// Demo users array for in-memory fallback
const DEMO_USERS = [
  { id: '1', email: 'resident@test.com', role: 'resident', name: 'John Doe', fullName: 'John Doe', flat: 'A-101', flatNumber: '101', communityName: 'Demo Society', communityId: 'demo-community-1' },
  { id: '2', email: 'admin@test.com', role: 'admin', name: 'Admin User', fullName: 'Admin User', flat: 'Admin', communityName: 'Demo Society', communityId: 'demo-community-1' },
  { id: '3', email: 'worker@test.com', role: 'worker', name: 'Bob Builder', fullName: 'Bob Builder', workerId: '3', profession: 'Electrician', workerRole: 'Maintenance', flat: 'Worker', communityName: 'Demo Society', communityId: 'demo-community-1' },
];

function extractBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.body && req.body.token) {
    return req.body.token;
  }
  return null;
}

/**
 * GET /api/auth/me
 * Restores and validates the authenticated session.
 */
router.get('/api/auth/me', async (req, res) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'No authorization token provided' });
    }

    const session = verifySession(token);
    if (!session) {
      return res.status(401).json({ success: false, message: 'Session expired or invalidated' });
    }

    const { id, role } = session;

    // Check MongoDB if connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      if (role === 'worker') {
        const workerDb = await Worker.findById(id).lean();
        if (workerDb) {
          if (workerDb.status === 'Suspended' || workerDb.status === 'Rejected' || workerDb.isActive === false) {
            return res.status(401).json({ success: false, message: 'Account suspended or inactive' });
          }

          const workerCommunityId = workerDb.communityId?.toString?.() || workerDb.societyId || null;
          let workerCommunityName = null;
          if (workerCommunityId) {
            try {
              const comm = await Community.findById(workerCommunityId).lean();
              workerCommunityName = comm?.name || null;
            } catch (_) {}
          }

          const { professionToRole } = require('../constants/workerRoles');
          const workerRole = workerDb.role || professionToRole(workerDb.profession);

          return res.json({
            success: true,
            user: {
              id: workerDb._id?.toString(),
              name: workerDb.name,
              fullName: workerDb.name,
              role: 'worker',
              workerId: workerDb._id?.toString(),
              profession: workerDb.profession,
              workerRole,
              communityId: workerCommunityId,
              communityName: workerCommunityName,
              status: workerDb.status,
            },
          });
        }
      } else {
        // Admin or Resident
        const dbUser = await CommunityUser.findById(id).lean();
        if (dbUser) {
          if (dbUser.status === 'rejected' || dbUser.isActive === false) {
            return res.status(401).json({ success: false, message: 'Account rejected or inactive' });
          }

          let communityName = null;
          if (dbUser.communityId) {
            try {
              const comm = await Community.findById(dbUser.communityId).lean();
              communityName = comm?.name || null;
            } catch (_) {}
          }

          return res.json({
            success: true,
            user: {
              id: dbUser._id?.toString(),
              fullName: dbUser.fullName,
              name: dbUser.fullName,
              role: dbUser.role,
              block: dbUser.block,
              flat: dbUser.flatNumber,
              flatNumber: dbUser.flatNumber,
              communityId: dbUser.communityId?.toString(),
              communityName: communityName,
              status: dbUser.status,
            },
          });
        }
      }
    }

    // Fallback: Check demo users
    const demo = DEMO_USERS.find(u => String(u.id) === String(id) || u.role === role);
    if (demo) {
      return res.json({ success: true, user: demo });
    }

    // Fallback to session info if valid token
    return res.json({
      success: true,
      user: {
        id: session.id,
        role: session.role,
        communityId: session.communityId,
        workerId: session.workerId,
      },
    });
  } catch (err) {
    console.error('Session restoration error in /api/auth/me:', err);
    return res.status(500).json({ success: false, message: 'Server error restoring session' });
  }
});

/**
 * POST /api/logout
 * Explicitly revokes and invalidates the session on the backend.
 */
router.post('/api/logout', async (req, res) => {
  try {
    const token = extractBearerToken(req);
    if (token) {
      revokeSession(token);
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error in /api/logout:', err);
    return res.status(500).json({ success: false, message: 'Server error during logout' });
  }
});

module.exports = router;
