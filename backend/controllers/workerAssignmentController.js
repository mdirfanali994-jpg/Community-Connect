const Worker = require('../models/Worker');
const Complaint = require('../models/Complaint');

/**
 * Admin: assign a worker to a complaint (society-scoped, backward compatible).
 * Stores new assignment metadata:
 * - assignment.workerId
 * - assignment.assignedBy
 * - assignment.assignedAt
 * - assignment.assignmentStatus
 *
 * Also updates:
 * - assignedWorker (legacy field) for backward compatibility with existing UI
 * - status to 'Assigned' (requirement), if provided (fallback otherwise)
 */
const assignWorkerToComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      workerId,
      assignedBy,
      assignmentStatus,
      societyId
    } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    // Verify worker existence + eligibility (optional society filter)
    const worker = await Worker.findOne({
      _id: workerId,
      isActive: true,
      status: 'Approved',
      ...(societyId ? { societyId } : {})
    }).lean();

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found or not active/approved' });
    }

    // Build update with new optional fields (so older complaints still work)
    const update = {
      // Legacy field (optional for existing dashboards)
      assignedWorker: worker.name,

      assignment: {
        workerId: worker._id.toString(),
        assignedBy: assignedBy || null,
        assignedAt: new Date().toISOString(),
        assignmentStatus: assignmentStatus || 'Assigned'
      },

      // Requirement: set complaint status to "Assigned" when assigning
      status: 'Assigned'
    };

    // Society scoping:
    // - if complaint has societyId set, enforce match
    // - otherwise allow update for backward compatibility (societyId optional)
    const complaintQuery = { id };
    if (societyId) complaintQuery.societyId = societyId;

    const updated = await Complaint.findOneAndUpdate(
      complaintQuery,
      update,
      { new: true, lean: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    return res.json({ success: true, complaint: updated });
  } catch (err) {
    console.error('assignWorkerToComplaint error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Worker: list complaints assigned to themselves.
 * Filters by:
 * - assignment.workerId
 * - societyId if complaint has societyId OR request provides societyId
 */
const listWorkersAssignedComplaints = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { societyId } = req.query;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    // Base query: assignment.workerId
    const query = {
      'assignment.workerId': workerId
    };

    // Society scoping rule:
    // - if societyId is provided, enforce it
    // - but because societyId is optional on older complaints, we accept complaints that either:
    //   a) match societyId OR
    //   b) have no societyId (backward compatible mode)
    if (societyId) {
      query.$or = [
        { societyId },
        { societyId: null }
      ];
    }

    // Mirror old worker workflow: exclude Completed (but requirement wants assigned)
    query.status = { $ne: 'Completed' };

    const complaints = await Complaint.find(query).sort({ date: -1 }).lean();
    return res.json({ success: true, complaints });
  } catch (err) {
    console.error('listWorkersAssignedComplaints error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  assignWorkerToComplaint,
  listWorkersAssignedComplaints
};
