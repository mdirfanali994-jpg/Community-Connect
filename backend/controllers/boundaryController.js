const mongoose = require('mongoose');
const CommunityBoundary = require('../models/CommunityBoundary');
const CommunityUser = require('../models/CommunityUser');
const Worker = require('../models/Worker');
const { validateBoundaryConfiguration } = require('../services/geofenceService');
const { verifySession } = require('../services/authService');

function isValidObjectId(v) {
  return !!v && /^[a-fA-F0-9]{24}$/.test(String(v));
}

/**
 * Helper to resolve the authenticated caller's communityId from request headers or query/body.
 * Ensures cross-community tenant isolation.
 */
async function resolveCallerCommunityId(req) {
  // Priority 1: Admin identity headers (set by requireAdminIdentity or manual headers)
  const xAdminId = req.headers['x-admin-id'];
  const xCommunityId = req.headers['x-community-id'];
  if (xAdminId && xCommunityId && isValidObjectId(xAdminId) && isValidObjectId(xCommunityId)) {
    const admin = await CommunityUser.findOne({
      _id: xAdminId,
      role: 'admin',
      communityId: xCommunityId,
    }).lean();
    if (admin) return String(admin.communityId);
  }

  // Priority 2: Bearer session token
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const session = verifySession(authHeader.slice(7).trim());
    if (session && session.communityId && isValidObjectId(session.communityId)) {
      return String(session.communityId);
    }
  }

  // Priority 3: Worker identity
  const workerId = req.headers['x-worker-id'] || req.query.workerId || req.body?.workerId;
  if (workerId && isValidObjectId(workerId)) {
    const worker = await Worker.findOne({ _id: String(workerId), isActive: true }).lean();
    if (worker && worker.communityId) return String(worker.communityId);
  }

  // Priority 4: Resident identity
  const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;
  if (userId && isValidObjectId(userId)) {
    const resident = await CommunityUser.findOne({ _id: String(userId), isActive: true }).lean();
    if (resident && resident.communityId) return String(resident.communityId);
  }

  return null;
}

/**
 * GET /api/boundary
 * Retrieves the configured boundary for the authenticated user's community.
 */
const getBoundary = async (req, res) => {
  try {
    const communityId = req.adminIdentity?.communityId || (await resolveCallerCommunityId(req));

    if (!communityId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Unable to determine authorized community context',
      });
    }

    const boundary = await CommunityBoundary.findOne({ communityId }).lean();

    if (!boundary) {
      return res.json({
        success: true,
        configured: false,
        boundary: null,
        message: 'No boundary has been configured for this community',
      });
    }

    return res.json({
      success: true,
      configured: true,
      boundary,
    });
  } catch (err) {
    console.error('getBoundary error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving boundary' });
  }
};

/**
 * POST /api/boundary (or PUT /api/boundary)
 * Configures or updates the community boundary.
 * Strictly restricted to verified community administrators.
 */
const saveBoundary = async (req, res) => {
  try {
    // Identity strictly verified by requireAdminIdentity
    const { adminUserId, communityId } = req.adminIdentity;

    const {
      mode,
      polygon,
      center,
      radius,
      maxAccuracyMeters,
      maxAgeSeconds,
      enabled = true,
    } = req.body;

    // Validate geometry and properties
    const validation = validateBoundaryConfiguration({
      mode,
      polygon,
      center,
      radius,
      maxAccuracyMeters,
      maxAgeSeconds,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    // Lookup admin name for audit trail
    const admin = await CommunityUser.findById(adminUserId).lean();
    const adminName = admin?.fullName || 'Community Admin';

    const updateData = {
      communityId,
      mode,
      enabled: enabled !== false,
      maxAccuracyMeters: maxAccuracyMeters ? Number(maxAccuracyMeters) : 100,
      maxAgeSeconds: maxAgeSeconds ? Number(maxAgeSeconds) : 120,
      updatedBy: adminUserId,
      updatedByName: adminName,
    };

    if (mode === 'polygon') {
      updateData.polygon = polygon.map((p) => ({
        lat: Number(p.lat),
        lng: Number(p.lng),
      }));
      // Clear radius fields when switching to polygon
      updateData.center = { lat: null, lng: null };
      updateData.radius = null;
    } else if (mode === 'radius') {
      updateData.center = {
        lat: Number(center.lat),
        lng: Number(center.lng),
      };
      updateData.radius = Number(radius);
      // Clear polygon fields when switching to radius
      updateData.polygon = [];
    }

    const saved = await CommunityBoundary.findOneAndUpdate(
      { communityId },
      {
        $set: updateData,
        $setOnInsert: { createdBy: adminUserId },
      },
      { returnDocument: 'after', upsert: true, runValidators: true, lean: true }
    );

    return res.json({
      success: true,
      message: 'Community boundary configured and saved successfully',
      boundary: saved,
    });
  } catch (err) {
    console.error('saveBoundary error:', err);
    return res.status(500).json({ success: false, message: 'Server error saving boundary configuration' });
  }
};

/**
 * PATCH /api/boundary/toggle
 * Enables or disables boundary enforcement without deleting the configuration.
 * Strictly restricted to verified community administrators.
 */
const toggleBoundary = async (req, res) => {
  try {
    const { adminUserId, communityId } = req.adminIdentity;
    const { enabled } = req.body;

    const boundary = await CommunityBoundary.findOne({ communityId });
    if (!boundary) {
      return res.status(404).json({
        success: false,
        message: 'No boundary configuration found for this community',
      });
    }

    boundary.enabled = enabled !== undefined ? Boolean(enabled) : !boundary.enabled;
    boundary.updatedBy = adminUserId;
    await boundary.save();

    return res.json({
      success: true,
      message: `Boundary enforcement ${boundary.enabled ? 'enabled' : 'disabled'} successfully`,
      boundary: boundary.toObject(),
    });
  } catch (err) {
    console.error('toggleBoundary error:', err);
    return res.status(500).json({ success: false, message: 'Server error toggling boundary state' });
  }
};

/**
 * DELETE /api/boundary
 * Deactivates or removes the community boundary.
 * Strictly restricted to verified community administrators.
 */
const deleteBoundary = async (req, res) => {
  try {
    const { adminUserId, communityId } = req.adminIdentity;

    const deleted = await CommunityBoundary.findOneAndDelete({ communityId }).lean();
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'No boundary configuration found for this community',
      });
    }

    return res.json({
      success: true,
      message: 'Community boundary deactivated and deleted successfully',
    });
  } catch (err) {
    console.error('deleteBoundary error:', err);
    return res.status(500).json({ success: false, message: 'Server error deleting boundary' });
  }
};

module.exports = {
  getBoundary,
  saveBoundary,
  toggleBoundary,
  deleteBoundary,
};
