const CommunityUser = require('../models/CommunityUser');
const Community = require('../models/Community');

// In this project auth is not JWT; admin identity is currently not securely enforced.
// For backward compatibility, we will:
 // - support filtering by optional query param `communityId`
 // - if not provided, list across all pending users (admin-only UI path)
 // Later sprint can tighten auth if needed.

const listResidentRequests = async (req, res) => {
  try {
    // Identity is validated by requireAdminIdentity middleware
    const adminCommunityId = req.adminIdentity?.communityId;

    const query = {
      role: 'resident',
      status: 'pending',
      isActive: true,
      communityId: adminCommunityId,
    };

    const requests = await CommunityUser.find(query).sort({ createdAt: -1 }).lean();

    const response = requests.map((r) => ({
      ...r,
      requestId: r._id,
      // kept for UI compatibility if it expects communityName; derived safely
      communityName: r.communityId ? String(r.communityId) : null,
    }));

    return res.json({ success: true, requests: response });
  } catch (err) {
    console.error('listResidentRequests error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const approveResidentRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminCommunityId = req.adminIdentity?.communityId;

    const updated = await CommunityUser.findOneAndUpdate(
      { _id: requestId, role: 'resident', communityId: adminCommunityId },
      { status: 'approved', isActive: true },
      { new: true, lean: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    return res.json({ success: true, request: updated });
  } catch (err) {
    console.error('approveResidentRequest error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const rejectResidentRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminCommunityId = req.adminIdentity?.communityId;

    const updated = await CommunityUser.findOneAndUpdate(
      { _id: requestId, role: 'resident', communityId: adminCommunityId },
      { status: 'rejected', isActive: false },
      { new: true, lean: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    return res.json({ success: true, request: updated });
  } catch (err) {
    console.error('rejectResidentRequest error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  listResidentRequests,
  approveResidentRequest,
  rejectResidentRequest,
};
