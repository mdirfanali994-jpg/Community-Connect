const mongoose = require('mongoose');
const Worker = require('../models/Worker');
const WorkerStatusHistory = require('../models/WorkerStatusHistory');
const WorkerRating = require('../models/WorkerRating');
const CommunityUser = require('../models/CommunityUser');
const Complaint = require('../models/Complaint');
const bcrypt = require('bcryptjs');

// Helper: check MongoDB connection state
function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

// Notification service and socket.io reference (set at runtime from server.js)
let notificationService = null;
let ioRef = null;

const setNotificationService = (ns) => { notificationService = ns; };
const setIO = (io) => { ioRef = io; };

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
 * Create a notification in DB and emit via socket
 */
async function createAndEmitNotification({ title, message, type, targetRole, complaintId, residentName, flatNumber, complaintText, complaintStatus, communityId, workerId }) {
  try {
    if (!notificationService) {
      // Fallback: direct Notification model creation
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
      return notification;
    }

    const notification = await notificationService.createComplaintSubmittedNotification({
      complaint: {
        id: complaintId,
        text: complaintText,
        status: complaintStatus,
        userName: residentName,
        flatNumber: flatNumber,
        communityId: communityId
      }
    });

    const room = targetRole && communityId ? `${targetRole}:${communityId}` : targetRole || 'admin';
    emitNotification('notification:new', notification, room);
    return notification;
  } catch (err) {
    console.error('createAndEmitNotification error:', err);
  }
}

/**
 * Public: Worker self-registration
 */
const registerWorker = async (req, res) => {
  try {
    // Require MongoDB — worker registration needs database
    if (!isMongoConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database is not connected. Please try again later or contact the administrator.'
      });
    }

    const {
      name,
      mobileNumber,
      email,
      password,
      confirmPassword,
      skills,
      experience,
      aadhaarNumber,
      communityId,
      address,
      profession
    } = req.body;

    if (!name || !mobileNumber || !email || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields: name, mobileNumber, email, password' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // Check for existing worker
    const existingWorker = await Worker.findOne({ email: normalizedEmail }).lean();
    if (existingWorker) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Check for existing community user
    const existingUser = await CommunityUser.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Validate community
    if (!communityId) {
      return res.status(400).json({ success: false, message: 'Please select a society/community' });
    }

    const Community = require('../models/Community');
    const community = await Community.findById(communityId).lean();
    if (!community) {
      return res.status(404).json({ success: false, message: 'Society not found' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Parse skills (sent as JSON stringified array from frontend FormData)
    let parsedSkills = [];
    if (typeof skills === 'string') {
      try {
        parsedSkills = JSON.parse(skills);
        if (!Array.isArray(parsedSkills)) parsedSkills = [];
      } catch {
        // Fallback: treat as comma-separated
        parsedSkills = skills.split(',').map(s => s.trim()).filter(Boolean);
      }
    } else if (Array.isArray(skills)) {
      parsedSkills = skills;
    }

    // Determine profession from first skill if not provided
    const workerProfession = profession || parsedSkills[0] || 'Worker';

    // Handle profile photo
    const profilePhoto = req.file ? req.file.filename : null;

    const worker = await Worker.create({
      name,
      mobileNumber,
      email: normalizedEmail,
      password: passwordHash,
      profession: workerProfession,
      skills: parsedSkills,
      experience: experience || '',
      aadhaarNumber: aadhaarNumber || '',
      address: address || '',
      profilePhoto,
      communityId: communityId,
      societyId: String(communityId),
      status: 'Pending',
      isActive: true,
      availability: 'Available',
      assignedComplaints: []
    });

    // Notify admin about new worker registration
    await createAndEmitNotification({
      title: 'New Worker Registration',
      message: `Worker ${name} has registered and is awaiting approval.`,
      type: 'WORKER_REGISTERED',
      targetRole: 'admin',
      communityId: communityId,
      residentName: name,
      complaintText: `Skills: ${parsedSkills.join(', ')}`,
      complaintStatus: 'Pending'
    });

    res.status(201).json({
      success: true,
      message: 'Your registration is awaiting approval from the Society Admin.',
      workerId: worker._id.toString()
    });
  } catch (err) {
    console.error('registerWorker error:', err);
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin: Create worker (auto-approved)
 */
const createWorker = async (req, res) => {
  try {
    const { communityId, error: authError } = await deriveCommunityFromAdminHeaders(req);
    if (authError) {
      return res.status(403).json({ success: false, message: authError });
    }

    const {
      name,
      mobileNumber,
      email,
      profession,
      skills,
      experience,
      blockAssigned,
      password
    } = req.body;

    if (!name || !mobileNumber || !email || !profession || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const worker = await Worker.create({
      societyId: communityId,
      communityId: communityId,
      name,
      mobileNumber,
      email,
      profession,
      skills: skills ? (typeof skills === 'string' ? skills.split(',').map(s => s.trim()) : skills) : [],
      experience: experience || '',
      blockAssigned: blockAssigned || null,
      password: passwordHash,
      status: 'Approved',
      isActive: true,
      availability: 'Available',
      assignedComplaints: []
    });

    res.status(201).json({ success: true, worker });
  } catch (err) {
    console.error('createWorker error:', err);
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin: List workers for assignment (only approved + active)
 */
const listWorkersForAssignment = async (req, res) => {
  try {
    const { communityId: adminCommunityId, error: authError } = await deriveCommunityFromAdminHeaders(req);

    let scopeCommunityId = adminCommunityId;

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

    if (!scopeCommunityId) {
      return res.json({ success: true, workers: [] });
    }

    const filter = { isActive: true, status: 'Approved', communityId: scopeCommunityId };

    const workers = await Worker.find(filter).sort({ createdAt: -1 }).lean();

    // Count active jobs for each worker
    const activeComplaints = await Complaint.find({
      'assignment.workerId': { $in: workers.map(w => w._id.toString()) },
      status: { $nin: ['Completed', 'Closed'] }
    }).lean();

    const activeJobsMap = {};
    activeComplaints.forEach(c => {
      const wid = c.assignment?.workerId;
      if (wid) activeJobsMap[wid] = (activeJobsMap[wid] || 0) + 1;
    });

    const sanitized = workers.map(w => ({
      id: w._id?.toString?.() || w.id,
      _id: w._id,
      societyId: w.societyId,
      communityId: w.communityId,
      name: w.name,
      profession: w.profession,
      skills: w.skills || [],
      experience: w.experience || '',
      mobileNumber: w.mobileNumber,
      email: w.email,
      blockAssigned: w.blockAssigned || null,
      availability: w.availability || 'Available',
      rating: w.rating || 0,
      completedJobs: w.completedJobs || 0,
      currentActiveJobs: activeJobsMap[w._id.toString()] || 0
    }));

    res.json({ success: true, workers: sanitized });
  } catch (err) {
    console.error('listWorkersForAssignment error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin: List all workers with status filters
 */
const listAllWorkers = async (req, res) => {
  try {
    const { communityId, error: authError } = await deriveCommunityFromAdminHeaders(req);
    if (authError) {
      return res.status(403).json({ success: false, message: authError });
    }

    const { status, search } = req.query;

    const filter = { communityId };
    if (status && status !== 'All') {
      filter.status = status;
    }
    if (search) {
      const searchRegex = new RegExp(String(search), 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { mobileNumber: searchRegex },
        { profession: searchRegex },
        { skills: searchRegex }
      ];
    }

    const workers = await Worker.find(filter).sort({ createdAt: -1 }).lean();

    // Get active job counts
    const activeComplaints = await Complaint.find({
      'assignment.workerId': { $in: workers.map(w => w._id.toString()) },
      status: { $nin: ['Completed', 'Closed'] }
    }).lean();

    const activeJobsMap = {};
    activeComplaints.forEach(c => {
      const wid = c.assignment?.workerId;
      if (wid) activeJobsMap[wid] = (activeJobsMap[wid] || 0) + 1;
    });

    const enriched = workers.map(w => ({
      ...w,
      currentActiveJobs: activeJobsMap[w._id.toString()] || 0
    }));

    res.json({ success: true, workers: enriched });
  } catch (err) {
    console.error('listAllWorkers error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get single worker by ID
 */
const getWorkerById = async (req, res) => {
  try {
    const { workerId } = req.params;

    let scopeCommunityId = null;
    const { communityId: adminCommunityId } = await deriveCommunityFromAdminHeaders(req).catch(() => ({ communityId: null }));
    scopeCommunityId = adminCommunityId;

    if (!scopeCommunityId) {
      const worker = await Worker.findOne({ _id: workerId }).lean();
      if (worker) scopeCommunityId = worker.communityId?.toString();
    }

    if (!scopeCommunityId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const worker = await Worker.findOne({ _id: workerId, communityId: scopeCommunityId }).lean();
    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    // Get completed job count
    const completedCount = await Complaint.countDocuments({
      'assignment.workerId': workerId,
      status: 'Completed'
    });

    // Get ratings
    const ratings = await WorkerRating.find({ workerId }).lean();
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    res.json({
      success: true,
      worker: {
        ...worker,
        completedJobsCount: completedCount,
        averageRating: Math.round(avgRating * 10) / 10,
        totalRatingsCount: ratings.length
      }
    });
  } catch (err) {
    console.error('getWorkerById error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin: Update worker status (approve/reject/suspend/activate)
 */
const updateWorkerStatus = async (req, res) => {
  try {
    const { communityId, error: authError } = await deriveCommunityFromAdminHeaders(req);
    if (authError) {
      return res.status(403).json({ success: false, message: authError });
    }

    const { workerId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!status || !['Approved', 'Rejected', 'Suspended', 'Pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const updateData = { status };
    if (status === 'Approved') {
      updateData.isActive = true;
    } else if (status === 'Rejected') {
      updateData.isActive = false;
      updateData.rejectionReason = rejectionReason || '';
    } else if (status === 'Suspended') {
      updateData.isActive = false;
    }

    const worker = await Worker.findOneAndUpdate(
      { _id: workerId, communityId },
      updateData,
      { new: true, lean: true }
    );

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    // Notify worker about status change
    let notificationTitle = '';
    let notificationMessage = '';
    if (status === 'Approved') {
      notificationTitle = 'Registration Approved';
      notificationMessage = 'You have been approved by Admin. You can now login to your dashboard.';
    } else if (status === 'Rejected') {
      notificationTitle = 'Registration Rejected';
      notificationMessage = rejectionReason
        ? `Your registration was rejected: ${rejectionReason}`
        : 'Your registration was rejected by the Community Administrator.';
    } else if (status === 'Suspended') {
      notificationTitle = 'Account Suspended';
      notificationMessage = 'Your account has been suspended. Please contact the Community Administrator.';
    }

    if (notificationTitle) {
      const Notification = require('../models/Notification');
      const notif = await Notification.create({
        title: notificationTitle,
        message: notificationMessage || '',
        type: 'WORKER_STATUS',
        targetRole: 'worker',
        communityId: communityId,
        residentName: worker.name,
        complaintText: notificationMessage || '',
        complaintStatus: status
      });

      const room = `worker:${workerId}`;
      emitNotification('notification:new', notif.toObject ? notif.toObject() : notif, room);
    }

    res.json({ success: true, worker });
  } catch (err) {
    console.error('updateWorkerStatus error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Worker: Update availability
 */
const updateWorkerAvailability = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { availability } = req.body;

    if (!availability || !['Available', 'Busy', 'Offline'].includes(availability)) {
      return res.status(400).json({ success: false, message: 'Invalid availability value' });
    }

    const worker = await Worker.findOneAndUpdate(
      { _id: workerId },
      { availability },
      { new: true, lean: true }
    );

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    res.json({ success: true, worker });
  } catch (err) {
    console.error('updateWorkerAvailability error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin: Delete worker
 */
const deleteWorker = async (req, res) => {
  try {
    const { communityId, error: authError } = await deriveCommunityFromAdminHeaders(req);
    if (authError) {
      return res.status(403).json({ success: false, message: authError });
    }

    const { workerId } = req.params;
    const worker = await Worker.findOneAndDelete({ _id: workerId, communityId });

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    res.json({ success: true, message: 'Worker deleted successfully' });
  } catch (err) {
    console.error('deleteWorker error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin: Worker analytics summary
 */
const getWorkerAnalytics = async (req, res) => {
  try {
    const { communityId, error: authError } = await deriveCommunityFromAdminHeaders(req);
    if (authError) {
      return res.status(403).json({ success: false, message: authError });
    }

    const allWorkers = await Worker.find({ communityId }).lean();

    const total = allWorkers.length;
    const pending = allWorkers.filter(w => w.status === 'Pending').length;
    const approved = allWorkers.filter(w => w.status === 'Approved').length;
    const suspended = allWorkers.filter(w => w.status === 'Suspended').length;
    const rejected = allWorkers.filter(w => w.status === 'Rejected').length;
    const available = allWorkers.filter(w => w.status === 'Approved' && w.availability === 'Available').length;
    const busy = allWorkers.filter(w => w.status === 'Approved' && w.availability === 'Busy').length;

    // Completed jobs across all workers
    const totalCompletedJobs = allWorkers.reduce((sum, w) => sum + (w.completedJobs || 0), 0);

    // Top performing workers (by completed jobs)
    const topWorkers = [...allWorkers]
      .filter(w => w.status === 'Approved')
      .sort((a, b) => (b.completedJobs || 0) - (a.completedJobs || 0))
      .slice(0, 5)
      .map(w => ({
        id: w._id,
        name: w.name,
        completedJobs: w.completedJobs || 0,
        rating: w.rating || 0,
        skills: w.skills || []
      }));

    res.json({
      success: true,
      analytics: {
        total,
        pending,
        approved,
        suspended,
        rejected,
        available,
        busy,
        totalCompletedJobs,
        topWorkers
      }
    });
  } catch (err) {
    console.error('getWorkerAnalytics error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createWorker,
  registerWorker,
  listWorkersForAssignment,
  listAllWorkers,
  updateWorkerStatus,
  deleteWorker,
  getWorkerById,
  updateWorkerAvailability,
  getWorkerAnalytics,
  setNotificationService,
  setIO
};

