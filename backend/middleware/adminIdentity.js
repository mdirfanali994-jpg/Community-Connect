const CommunityUser = require('../models/CommunityUser');
const { verifySession } = require('../services/authService');

function normalizeHeaderValue(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function isValidObjectId(v) {
  return !!v && /^[a-fA-F0-9]{24}$/.test(String(v));
}

/**
 * Admin identity middleware.
 * - Supports headers:
 *   - x-admin-id: CommunityUser _id of the admin
 *   - x-community-id: Community _id the admin manages
 * - Also supports Authorization: Bearer <sessionToken>
 * - Validates admin exists, role=admin, and communityId matches.
 * - Attaches:
 *   req.adminIdentity = { adminUserId, communityId }
 */
async function requireAdminIdentity(req, res, next) {
  try {
    let adminId = normalizeHeaderValue(req.headers['x-admin-id']);
    let communityId = normalizeHeaderValue(req.headers['x-community-id']);

    // Fallback to Bearer token if headers not directly supplied
    if ((!adminId || !communityId) && req.headers['authorization']) {
      const authHeader = req.headers['authorization'];
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const session = verifySession(authHeader.slice(7).trim());
        if (session && session.role === 'admin') {
          adminId = adminId || normalizeHeaderValue(session.id);
          communityId = communityId || normalizeHeaderValue(session.communityId);
        }
      }
    }

    if (!adminId || !communityId) {
      return res.status(403).json({
        success: false,
        message: 'Missing admin identity headers (x-admin-id, x-community-id)',
      });
    }

    if (!isValidObjectId(adminId) || !isValidObjectId(communityId)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid admin identity headers',
      });
    }

    // Validate admin user
    const adminUser = await CommunityUser.findOne({
      _id: adminId,
      role: 'admin',
      communityId: communityId,
    }).lean();

    if (!adminUser) {
      return res.status(403).json({
        success: false,
        message: 'Invalid admin identity for the provided community',
      });
    }

    req.adminIdentity = {
      adminUserId: adminId,
      communityId,
    };

    return next();
  } catch (err) {
    console.error('requireAdminIdentity error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { requireAdminIdentity };
