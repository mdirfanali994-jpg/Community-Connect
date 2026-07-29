const Notification = require('../models/Notification');
const CommunityUser = require('../models/CommunityUser');
const Worker = require('../models/Worker');
const { requireAdminIdentity } = require('../middleware/adminIdentity');

function getFirstHeader(req, key) {
  return req.headers?.[key] ?? null;
}

async function deriveCommunityIdFromIdentity(req) {
  // Admin identity via x-admin-id + x-community-id validated in requireAdminIdentity.
  const xAdminId = getFirstHeader(req, 'x-admin-id');
  const xCommunityId = getFirstHeader(req, 'x-community-id');
  if (xAdminId && xCommunityId) {
    let derived = null;
    await new Promise((resolve) => {
      requireAdminIdentity(
        {
          ...req,
          headers: req.headers,
        },
        { status: () => ({ json: () => resolve() }) },
        () => {
          derived = req.adminIdentity?.communityId || null;
          resolve();
        }
      );
    });
    return derived;
  }

  // Resident: query/userId
  const candidateUserId = req.query?.userId || req.body?.userId;
  const role = req.query?.role || req.body?.role;
  if (candidateUserId && (role === 'resident' || role === 'user')) {
    const userDoc = await CommunityUser.findOne({ _id: candidateUserId, role: 'resident' }).lean();
    return userDoc?.communityId?.toString?.() || null;
  }

  // Worker: query/userId or workerId
  const workerId = req.params?.workerId || candidateUserId;
  if (workerId && (role === 'worker' || req.query?.role === 'worker' || req.query?.workerId)) {
    const workerDoc = await Worker.findOne({ _id: workerId }).lean();
    return workerDoc?.communityId?.toString?.() || null;
  }

  // If nothing can be derived, do not risk leaking across tenants.
  return null;
}

const getNotificationsForRole = async (req, res) => {
  try {
    const { targetRole, communityId } = req.query;
    if (!targetRole) {
        return res.status(400).json({ success: false, message: 'targetRole is required' });
    }

    const scopeCommunityId = await deriveCommunityIdFromIdentity(req);
    if (!scopeCommunityId) {
      return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }

    const notificationsQuery = { targetRole, communityId: scopeCommunityId };
    if (communityId) notificationsQuery.communityId = communityId;

    const notifications = await Notification.find(notificationsQuery)
      .sort({ createdAt: -1 })
      .lean();


    res.json({ success: true, notifications });
  } catch (err) {
    console.error('getNotificationsForRole error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    const scopeCommunityId = await deriveCommunityIdFromIdentity(req);
    if (!scopeCommunityId) {
      return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }

    const updated = await Notification.findOneAndUpdate(
      { _id: id, communityId: scopeCommunityId },
      { read: true, readAt: new Date() },
      { new: true, lean: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification: updated });
  } catch (err) {
    console.error('markNotificationRead error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const markAllReadForRole = async (req, res) => {
  try {
    const { targetRole } = req.query;
    if (!targetRole) {
      return res.status(400).json({ success: false, message: 'targetRole is required' });
    }

    const scopeCommunityId = await deriveCommunityIdFromIdentity(req);
    if (!scopeCommunityId) {
      return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }

    await Notification.updateMany(
      { targetRole, read: false, communityId: scopeCommunityId },
      { $set: { read: true, readAt: new Date() } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('markAllReadForRole error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getNotificationsForRole,
  markNotificationRead,
  markAllReadForRole
};

