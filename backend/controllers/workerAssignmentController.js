const Worker = require('../models/Worker');
const WorkerStatusHistory = require('../models/WorkerStatusHistory');
const WorkerRating = require('../models/WorkerRating');
const Complaint = require('../models/Complaint');
const CommunityUser = require('../models/CommunityUser');

// Socket.io reference (set at runtime from server.js)
let ioRef = null;

const setIO = (io) => { ioRef = io; };

/**
 * Emit real-time notification via socket.io
 */
async function emitNotification(type, data, targetRoom) {
  if (ioRef) {
    const room = targetRoom || 'admin';
    ioRef.to(room).emit(type, data);
    console.log(`📤 [socket] emitted ${type} to room ${room}`);
  }
}

/**
 * Create notification in DB and emit via socket
 */
async function createAndEmitNotification({ title, message, type, targetRole, complaintId, residentName, flatNumber, complaintText, complaintStatus, communityId }) {
  try {
    const Notification = require('../models/Notification');
    const notification = await Notification.create({
      title: title || '',
      message: message || '',
      type: type || 'WORKER_EVENT',
      targetRole: targetRole || 'admin',
      complaintId: complaintId || null,
      residentName: residentName || '',
      flatNumber: flatNumber || '',
      complaintText: complaintText || '',
      complaintStatus: complaintStatus || '',
      communityId: communityId || null,
      read: false,
      createdAt: new Date()
    });

    const room = targetRole && communityId ? `${targetRole}:${communityId}` : targetRole || 'admin';
    emitNotification('notification:new', notification.toObject ? notification.toObject() : notification, room);

    // Also emit to the general role room
    emitNotification('notification:new', notification.toObject ? notification.toObject() : notification, targetRole || 'admin');

    return notification;
  } catch (err) {
    console.error('createAndEmitNotification error:', err);
  }
}

/**
 * Record status history entry
 */
async function recordStatusHistory({ complaintId, workerId, status, updatedBy, remarks, communityId }) {
  try {
    await WorkerStatusHistory.create({
      complaintId,
      workerId: workerId || '',
      status,
      timestamp: new Date(),
      updatedBy: updatedBy || 'system',
      remarks: remarks || '',
      communityId: communityId || null
    });
  } catch (err) {
    console.error('recordStatusHistory error:', err);
  }
}

/**
 * Admin: assign a worker to a complaint (society-scoped, backward compatible).
 */
const assignWorkerToComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      workerId,
      assignedBy,
      assignmentStatus,
    } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    // Verify worker existence + eligibility
    const worker = await Worker.findOne({
      _id: workerId,
      isActive: true,
      status: 'Approved',
    }).lean();

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found or not active/approved' });
    }

    const now = new Date().toISOString();

    const update = {
      assignedWorker: worker.name,
      workerDetails: {
        workerId: worker._id.toString(),
        name: worker.name,
        photo: worker.profilePhoto || '',
        phone: worker.mobileNumber || '',
        skills: worker.skills || []
      },
      assignment: {
        workerId: worker._id.toString(),
        assignedBy: assignedBy || null,
        assignedAt: now,
        assignmentStatus: assignmentStatus || 'Assigned'
      },
      status: 'Assigned',
      'timeline.assigned': now
    };

    const complaintQuery = { id };
    if (worker?.communityId) {
      complaintQuery.communityId = worker.communityId;
    }

    const complaint = await Complaint.findOne({ id, communityId: worker.communityId }).lean();

    const updated = await Complaint.findOneAndUpdate(
      complaintQuery,
      update,
      { new: true, lean: true }
    );

    if (!updated) {
      return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }

    // Record status history
    await recordStatusHistory({
      complaintId: id,
      workerId: worker._id.toString(),
      status: 'Assigned',
      updatedBy: assignedBy || 'admin',
      remarks: `Assigned to ${worker.name}`,
      communityId: worker.communityId
    });

    // Update worker's assigned complaints list
    await Worker.findByIdAndUpdate(worker._id, {
      $addToSet: { assignedComplaints: id }
    });

    // Notifications
    // 1. Notify worker
    await createAndEmitNotification({
      title: 'New Complaint Assigned',
      message: `Complaint #${id.substring(id.length - 6)} has been assigned to you.`,
      type: 'COMPLAINT_ASSIGNED',
      targetRole: 'worker',
      complaintId: id,
      residentName: complaint?.userName || '',
      flatNumber: complaint?.flatNumber || '',
      complaintText: complaint?.text || '',
      complaintStatus: 'Assigned',
      communityId: worker.communityId
    });

    // 2. Notify resident
    if (complaint?.userId) {
      const resident = await CommunityUser.findOne({ _id: complaint.userId }).lean();
      await createAndEmitNotification({
        title: 'Complaint Assigned',
        message: `Your complaint has been assigned to ${worker.name}.`,
        type: 'COMPLAINT_ASSIGNED',
        targetRole: 'resident',
        complaintId: id,
        residentName: resident?.fullName || complaint?.userName || '',
        flatNumber: complaint?.flatNumber || '',
        complaintText: complaint?.text || '',
        complaintStatus: 'Assigned',
        communityId: worker.communityId
      });
    }

    // Set worker availability to Busy
    await Worker.findByIdAndUpdate(worker._id, { availability: 'Busy' });

    return res.json({ success: true, complaint: updated });
  } catch (err) {
    console.error('assignWorkerToComplaint error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Worker: Accept assigned work
 */
const acceptComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const now = new Date().toISOString();

    const complaint = await Complaint.findOneAndUpdate(
      { id, 'assignment.workerId': workerId },
      {
        status: 'Accepted',
        'assignment.assignmentStatus': 'Accepted',
        'timeline.accepted': now
      },
      { new: true, lean: true }
    );

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found or not assigned to you' });
    }

    await recordStatusHistory({
      complaintId: id,
      workerId,
      status: 'Accepted',
      updatedBy: 'worker',
      remarks: 'Worker accepted the work',
      communityId: complaint.communityId
    });

    // Notify admin and resident
    const worker = await Worker.findById(workerId).lean();
    const message = `${worker?.name || 'Worker'} has accepted the complaint.`;

    await createAndEmitNotification({
      title: 'Complaint Accepted',
      message,
      type: 'COMPLAINT_ACCEPTED',
      targetRole: 'admin',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Accepted',
      communityId: complaint.communityId,
      residentName: complaint.userName,
      flatNumber: complaint.flatNumber
    });

    await createAndEmitNotification({
      title: 'Worker Accepted Work',
      message,
      type: 'COMPLAINT_ACCEPTED',
      targetRole: 'resident',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Accepted',
      communityId: complaint.communityId,
      residentName: complaint.userName,
      flatNumber: complaint.flatNumber
    });

    res.json({ success: true, complaint });
  } catch (err) {
    console.error('acceptComplaint error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Worker: Start work
 */
const startComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const now = new Date().toISOString();

    const complaint = await Complaint.findOneAndUpdate(
      { id, 'assignment.workerId': workerId },
      {
        status: 'Work In Progress',
        'assignment.assignmentStatus': 'Started',
        'timeline.started': now
      },
      { new: true, lean: true }
    );

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found or not assigned to you' });
    }

    await recordStatusHistory({
      complaintId: id,
      workerId,
      status: 'Started',
      updatedBy: 'worker',
      remarks: 'Worker started the work',
      communityId: complaint.communityId
    });

    const worker = await Worker.findById(workerId).lean();
    const message = `${worker?.name || 'Worker'} has started working on the complaint.`;

    await createAndEmitNotification({
      title: 'Work Started',
      message,
      type: 'COMPLAINT_STARTED',
      targetRole: 'admin',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Work In Progress',
      communityId: complaint.communityId,
      residentName: complaint.userName,
      flatNumber: complaint.flatNumber
    });

    await createAndEmitNotification({
      title: 'Work Started',
      message,
      type: 'COMPLAINT_STARTED',
      targetRole: 'resident',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Work In Progress',
      communityId: complaint.communityId,
      residentName: complaint.userName,
      flatNumber: complaint.flatNumber
    });

    res.json({ success: true, complaint });
  } catch (err) {
    console.error('startComplaint error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Worker: Mark in progress
 */
const markInProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const now = new Date().toISOString();

    const complaint = await Complaint.findOneAndUpdate(
      { id, 'assignment.workerId': workerId },
      {
        status: 'Work In Progress',
        'assignment.assignmentStatus': 'In Progress',
        'timeline.inProgress': now
      },
      { new: true, lean: true }
    );

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found or not assigned to you' });
    }

    await recordStatusHistory({
      complaintId: id,
      workerId,
      status: 'In Progress',
      updatedBy: 'worker',
      remarks: 'Worker marked as in progress',
      communityId: complaint.communityId
    });

    const worker = await Worker.findById(workerId).lean();
    const message = `${worker?.name || 'Worker'} has updated the complaint to In Progress.`;

    await createAndEmitNotification({
      title: 'Work In Progress',
      message,
      type: 'COMPLAINT_IN_PROGRESS',
      targetRole: 'admin',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Work In Progress',
      communityId: complaint.communityId
    });

    await createAndEmitNotification({
      title: 'Progress Update',
      message,
      type: 'COMPLAINT_IN_PROGRESS',
      targetRole: 'resident',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Work In Progress',
      communityId: complaint.communityId
    });

    res.json({ success: true, complaint });
  } catch (err) {
    console.error('markInProgress error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Worker: Complete work with proof images
 */
const completeComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId, completionNotes } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const now = new Date().toISOString();

    // Get uploaded files
    const completionPhotos = req.files?.completionPhotos
      ? req.files.completionPhotos.map(f => f.filename)
      : [];
    const completionVideo = req.files?.completionVideo?.[0]?.filename || null;

    if (completionPhotos.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one completion photo is required' });
    }

    const worker = await Worker.findById(workerId).lean();

    const update = {
      status: 'Completed',
      'assignment.assignmentStatus': 'Completed',
      'timeline.completed': now,
      completion: {
        photos: completionPhotos,
        video: completionVideo,
        notes: completionNotes || '',
        completedAt: now,
        completedBy: worker?.name || 'Worker'
      }
    };

    const complaint = await Complaint.findOneAndUpdate(
      { id, 'assignment.workerId': workerId },
      update,
      { new: true, lean: true }
    );

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found or not assigned to you' });
    }

    await recordStatusHistory({
      complaintId: id,
      workerId,
      status: 'Completed',
      updatedBy: 'worker',
      remarks: completionNotes || 'Work completed',
      communityId: complaint.communityId
    });

    // Update worker's completed jobs count
    await Worker.findByIdAndUpdate(workerId, {
      $inc: { completedJobs: 1 },
      availability: 'Available'
    });

    const message = `${worker?.name || 'Worker'} has completed the work.`;

    // Notify admin
    await createAndEmitNotification({
      title: 'Work Completed',
      message: `Complaint #${id.substring(id.length - 6)} completed. Please review.`,
      type: 'COMPLAINT_COMPLETED',
      targetRole: 'admin',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Completed',
      communityId: complaint.communityId,
      residentName: complaint.userName,
      flatNumber: complaint.flatNumber
    });

    // Notify resident
    await createAndEmitNotification({
      title: 'Work Completed',
      message: `Your complaint has been marked as completed by ${worker?.name || 'Worker'}. Please confirm.`,
      type: 'COMPLAINT_COMPLETED',
      targetRole: 'resident',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Completed',
      communityId: complaint.communityId,
      residentName: complaint.userName,
      flatNumber: complaint.flatNumber
    });

    // Emit real-time to all dashboards
    emitNotification('complaint:updated', complaint, `admin:${complaint.communityId}`);
    emitNotification('complaint:updated', complaint, `resident:${complaint.communityId}`);
    emitNotification('complaint:updated', complaint, `worker:${complaint.communityId}`);

    res.json({
      success: true,
      complaint,
      message: 'Work completed successfully. Waiting for resident confirmation.'
    });
  } catch (err) {
    console.error('completeComplaint error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident: Approve completion
 */
const residentApproveCompletion = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, review } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const now = new Date().toISOString();

    const complaint = await Complaint.findOneAndUpdate(
      { id, userId },
      {
        status: 'Closed',
        'residentConfirmation.status': 'approved',
        'residentConfirmation.confirmedAt': now,
        'residentConfirmation.review': review || '',
        'timeline.approved': now
      },
      { new: true, lean: true }
    );

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    await recordStatusHistory({
      complaintId: id,
      workerId: complaint.assignment?.workerId || '',
      status: 'Closed',
      updatedBy: 'resident',
      remarks: review || 'Resident approved the completion',
      communityId: complaint.communityId
    });

    // Notify admin and worker
    await createAndEmitNotification({
      title: 'Complaint Closed',
      message: 'Resident has approved the completed work. Complaint is now closed.',
      type: 'COMPLAINT_CLOSED',
      targetRole: 'admin',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Closed',
      communityId: complaint.communityId,
      residentName: complaint.userName,
      flatNumber: complaint.flatNumber
    });

    await createAndEmitNotification({
      title: 'Complaint Closed',
      message: 'Resident has approved your work. Complaint closed.',
      type: 'COMPLAINT_CLOSED',
      targetRole: 'worker',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Closed',
      communityId: complaint.communityId,
      residentName: complaint.userName,
      flatNumber: complaint.flatNumber
    });

    emitNotification('complaint:updated', complaint, `admin:${complaint.communityId}`);
    emitNotification('complaint:updated', complaint, `worker:${complaint.communityId}`);

    res.json({ success: true, complaint, message: 'Complaint closed successfully.' });
  } catch (err) {
    console.error('residentApproveCompletion error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident: Request rework
 */
const residentRequestRework = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, review } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const now = new Date().toISOString();

    const complaint = await Complaint.findOneAndUpdate(
      { id, userId },
      {
        status: 'Reopened',
        'residentConfirmation.status': 'rework',
        'residentConfirmation.confirmedAt': now,
        'residentConfirmation.review': review || '',
        'timeline.reopened': now
      },
      { new: true, lean: true }
    );

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    await recordStatusHistory({
      complaintId: id,
      workerId: complaint.assignment?.workerId || '',
      status: 'Reopened',
      updatedBy: 'resident',
      remarks: review || 'Resident requested rework',
      communityId: complaint.communityId
    });

    // Notify admin and worker
    await createAndEmitNotification({
      title: 'Rework Requested',
      message: review
        ? `Resident requested rework: ${review}`
        : 'Resident has requested rework on the complaint.',
      type: 'COMPLAINT_REWORK',
      targetRole: 'admin',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Reopened',
      communityId: complaint.communityId,
      residentName: complaint.userName,
      flatNumber: complaint.flatNumber
    });

    await createAndEmitNotification({
      title: 'Rework Required',
      message: review
        ? `Resident has requested changes: ${review}`
        : 'Resident has requested rework on the completed work.',
      type: 'COMPLAINT_REWORK',
      targetRole: 'worker',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Reopened',
      communityId: complaint.communityId,
      residentName: complaint.userName,
      flatNumber: complaint.flatNumber
    });

    emitNotification('complaint:updated', complaint, `admin:${complaint.communityId}`);

    res.json({ success: true, complaint, message: 'Rework requested. Complaint reopened.' });
  } catch (err) {
    console.error('residentRequestRework error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin: Reassign worker
 */
const reassignWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId, assignedBy } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const worker = await Worker.findOne({
      _id: workerId,
      isActive: true,
      status: 'Approved',
    }).lean();

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found or not active/approved' });
    }

    // Get the current complaint to know previous worker
    const currentComplaint = await Complaint.findOne({ id }).lean();

    const now = new Date().toISOString();

    const update = {
      assignedWorker: worker.name,
      workerDetails: {
        workerId: worker._id.toString(),
        name: worker.name,
        photo: worker.profilePhoto || '',
        phone: worker.mobileNumber || '',
        skills: worker.skills || []
      },
      assignment: {
        workerId: worker._id.toString(),
        assignedBy: assignedBy || 'Admin',
        assignedAt: now,
        assignmentStatus: 'Assigned'
      },
      status: 'Assigned',
      'timeline.assigned': now
    };

    const complaint = await Complaint.findOneAndUpdate(
      { id },
      update,
      { new: true, lean: true }
    );

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    await recordStatusHistory({
      complaintId: id,
      workerId: worker._id.toString(),
      status: 'Assigned (Reassigned)',
      updatedBy: 'admin',
      remarks: `Reassigned to ${worker.name}`,
      communityId: complaint.communityId
    });

    // Notify new worker
    await createAndEmitNotification({
      title: 'Complaint Reassigned',
      message: `Complaint #${id.substring(id.length - 6)} has been reassigned to you.`,
      type: 'COMPLAINT_REASSIGNED',
      targetRole: 'worker',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Assigned',
      communityId: complaint.communityId,
      residentName: complaint.userName,
      flatNumber: complaint.flatNumber
    });

    // Notify resident
    await createAndEmitNotification({
      title: 'Worker Reassigned',
      message: `Your complaint has been reassigned to ${worker.name}.`,
      type: 'COMPLAINT_REASSIGNED',
      targetRole: 'resident',
      complaintId: id,
      complaintText: complaint.text,
      complaintStatus: 'Assigned',
      communityId: complaint.communityId,
      residentName: complaint.userName,
      flatNumber: complaint.flatNumber
    });

    res.json({ success: true, complaint });
  } catch (err) {
    console.error('reassignWorker error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Worker: list complaints assigned to themselves.
 */
const listWorkersAssignedComplaints = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { communityId } = req.query;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const worker = await Worker.findOne({ _id: workerId }).lean();
    const derivedCommunityId = worker?.communityId?.toString?.() || null;
    const query = { 'assignment.workerId': workerId };

    if (!derivedCommunityId && !communityId) {
      return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }
    const scopeCommunityId = derivedCommunityId || communityId;
    query.communityId = scopeCommunityId;

    const complaints = await Complaint.find(query).sort({ date: -1 }).lean();
    return res.json({ success: true, complaints });
  } catch (err) {
    console.error('listWorkersAssignedComplaints error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get complaint timeline
 */
const getComplaintTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const { communityId } = req.query;

    const complaint = await Complaint.findOne({ id }).lean();

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Get status history
    const history = await WorkerStatusHistory.find({ complaintId: id })
      .sort({ timestamp: 1 })
      .lean();

    // Build timeline entries
    const timeline = [];

    const addTimelineEntry = (label, timestamp, icon) => {
      if (timestamp) {
        timeline.push({
          stage: label,
          timestamp,
          date: new Date(timestamp).toLocaleDateString(),
          time: new Date(timestamp).toLocaleTimeString(),
          person: label === 'Submitted' ? complaint.userName : 
                  label === 'Verified' ? 'Admin' :
                  label === 'Assigned' ? (complaint.assignedWorker || 'Admin') :
                  label === 'Accepted' ? (complaint.workerDetails?.name || complaint.assignedWorker || 'Worker') :
                  label === 'Started' ? (complaint.workerDetails?.name || complaint.assignedWorker || 'Worker') :
                  label === 'In Progress' ? (complaint.workerDetails?.name || complaint.assignedWorker || 'Worker') :
                  label === 'Completed' ? (complaint.completion?.completedBy || complaint.workerDetails?.name || 'Worker') :
                  label === 'Closed' ? complaint.userName :
                  label === 'Reopened' ? complaint.userName : '-',
          icon
        });
      }
    };

    addTimelineEntry('Submitted', complaint.timeline?.submitted || complaint.date, 'submitted');
    addTimelineEntry('Verified', complaint.timeline?.verified, 'verified');
    addTimelineEntry('Assigned', complaint.timeline?.assigned, 'assigned');
    addTimelineEntry('Accepted', complaint.timeline?.accepted, 'accepted');
    addTimelineEntry('Started', complaint.timeline?.started, 'started');
    addTimelineEntry('In Progress', complaint.timeline?.inProgress, 'in_progress');
    addTimelineEntry('Completed', complaint.timeline?.completed, 'completed');
    addTimelineEntry('Closed', complaint.timeline?.approved, 'approved');
    addTimelineEntry('Reopened', complaint.timeline?.reopened, 'reopened');

    // Also add history entries that aren't in the timeline
    for (const h of history) {
      const exists = timeline.some(t => t.stage === h.status);
      if (!exists) {
        timeline.push({
          stage: h.status,
          timestamp: h.timestamp,
          date: new Date(h.timestamp).toLocaleDateString(),
          time: new Date(h.timestamp).toLocaleTimeString(),
          person: h.updatedBy === 'worker' ? (complaint.workerDetails?.name || 'Worker') :
                  h.updatedBy === 'resident' ? complaint.userName : 'Admin',
          remarks: h.remarks,
          icon: 'custom'
        });
      }
    }

    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({ success: true, timeline, complaint });
  } catch (err) {
    console.error('getComplaintTimeline error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Rate worker after job completion
 */
const rateWorker = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { complaintId, rating, review, userId } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    if (!complaintId || !userId) {
      return res.status(400).json({ success: false, message: 'complaintId and userId are required' });
    }

    // Check if already rated
    const existingRating = await WorkerRating.findOne({ complaintId }).lean();
    if (existingRating) {
      return res.status(409).json({ success: false, message: 'Already rated for this complaint' });
    }

    // Get complaint for community scoping
    const complaint = await Complaint.findOne({ id: complaintId }).lean();
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    await WorkerRating.create({
      workerId,
      complaintId,
      residentId: userId,
      rating: Number(rating),
      review: review || '',
      communityId: complaint.communityId
    });

    // Update worker's average rating
    const allRatings = await WorkerRating.find({ workerId }).lean();
    const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
    await Worker.findByIdAndUpdate(workerId, {
      rating: Math.round(avgRating * 10) / 10,
      totalRatings: allRatings.length
    });

    res.json({ success: true, message: 'Rating submitted successfully' });
  } catch (err) {
    console.error('rateWorker error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  assignWorkerToComplaint,
  listWorkersAssignedComplaints,
  acceptComplaint,
  startComplaint,
  markInProgress,
  completeComplaint,
  residentApproveCompletion,
  residentRequestRework,
  reassignWorker,
  getComplaintTimeline,
  rateWorker,
  setIO
};
