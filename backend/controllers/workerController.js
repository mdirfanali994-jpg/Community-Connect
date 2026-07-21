const Worker = require('../models/Worker');
const CommunityUser = require('../models/CommunityUser');

/**
 * Derive requester's communityId from admin identity headers.
 * Returns { communityId, error }.
 */
async function deriveCommunityFromAdminHeaders(req) {
  const xAdminId = req.headers['x-admin-id'];
  const xCommunityId = req.headers['x-community-id'];
  if (!xAdminId || !xCommunityId) {
    return { communityId: null, error: 'Missing admin identity headers (x-admin-id, x-community-id)' };
  }
  const admin = await CommunityUser.findOne({ _id: xAdminId, role: 'admin', communityId: xCommunityId }).lean();
  if (!admin) {
    return { communityId: null, error: 'Invalid admin identity for the provided community' };
  }
  return { communityId: String(admin.communityId), error: null };
}

const createWorker = async (req, res) => {
  try {
    // Derive communityId from authenticated admin identity — NEVER trust frontend body.
    const { communityId, error: authError } = await deriveCommunityFromAdminHeaders(req);
    if (authError) {
      return res.status(403).json({ success: false, message: authError });
    }

    const {
      name,
      mobileNumber,
      email,
      profession,
      blockAssigned,
      password
    } = req.body;

    if (!name || !mobileNumber || !email || !profession || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const worker = await Worker.create({
      societyId: communityId,
      communityId: communityId,
      name,
      mobileNumber,
      email,
      profession,
      blockAssigned: blockAssigned || null,
      password,
      status: 'Approved',
      isActive: true,
      assignedComplaints: []
    });

    res.status(201).json({ success: true, worker });
  } catch (err) {
    console.error('createWorker error:', err);
    // Handle duplicate email gracefully
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const listWorkersForAssignment = async (req, res) => {
  try {
    // Derive communityId from authenticated identity — NEVER trust query params.
    // Try admin identity headers first.
    const { communityId: adminCommunityId, error: authError } = await deriveCommunityFromAdminHeaders(req);

    let scopeCommunityId = adminCommunityId;

    // Fallback: if not admin, try resident/worker identity from userId + role query params
    if (!scopeCommunityId) {
      const userId = req.query?.userId;
      const role = req.query?.role;
      if (userId && role === 'resident') {
        const userDoc = await CommunityUser.findOne({ _id: userId, role: 'resident' }).lean();
        scopeCommunityId = userDoc?.communityId?.toString?.() || null;
      } else if (userId && role === 'worker') {
        const workerDoc = await Worker.findOne({ _id: String(userId) }).lean();
        scopeCommunityId = workerDoc?.communityId?.toString?.() || workerDoc?.societyId || null;
      }
    }

    // If no identity-derived community, return empty set — never leak cross-society data.
    if (!scopeCommunityId) {
      return res.json({ success: true, workers: [] });
    }

    const filter = { isActive: true, status: 'Approved', communityId: scopeCommunityId };

    const workers = await Worker.find(filter).sort({ createdAt: -1 }).lean();

    // Keep response minimal for assignment UI
    const sanitized = workers.map(w => ({
      id: w._id?.toString?.() || w.id,
      _id: w._id,
      // Keep societyId for UI/backward compatibility
      societyId: w.societyId,
      communityId: w.communityId,
      name: w.name,
      profession: w.profession,
      blockAssigned: w.blockAssigned || null
    }));

    res.json({ success: true, workers: sanitized });
  } catch (err) {
    console.error('listWorkersForAssignment error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createWorker,
  listWorkersForAssignment
};

