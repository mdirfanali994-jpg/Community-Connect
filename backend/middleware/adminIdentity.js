const CommunityUser = require('../models/CommunityUser');

function normalizeHeaderValue(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function isValidObjectId(v) {
  return !!v && /^[a-fA-F0-9]{24}$/.test(v);
}

/**
 * Temporary admin identity middleware (pre-JWT).
 * - Expects headers:
 *   - x-admin-id: CommunityUser _id of the admin
 *   - x-community-id: Community _id the admin manages
 * - Validates admin exists, role=admin, and communityId matches.
 * - Attaches:
 *   req.adminIdentity = { adminUserId, communityId }
 *
 * Future JWT migration:
 * - Replace this middleware only; keep controller business logic unchanged.
 */
async function requireAdminIdentity(req, res, next) {
  try {
    const adminId = normalizeHeaderValue(req.headers['x-admin-id']);
    const communityId = normalizeHeaderValue(req.headers['x-community-id']);

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
