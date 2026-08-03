const mongoose = require('mongoose');
const Visitor = require('../models/Visitor');
const VisitorLog = require('../models/VisitorLog');
const VisitorSettings = require('../models/VisitorSettings');
const CommunityUser = require('../models/CommunityUser');
const Worker = require('../models/Worker');
const { VISITOR_TYPE_KEYS, isDeliveryType } = require('../constants/visitorTypes');
const { professionToRole } = require('../constants/workerRoles');

// Socket.io reference (set at runtime from server.js)
let ioRef = null;

const setIO = (io) => { ioRef = io; };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateVisitorId(communityId) {
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `V-${ts}${rand}`;
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateQrPayload(visitorId, communityId) {
  // 10 minutes from now
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  return JSON.stringify({ visitorId, communityId, expiresAt });
}

function getOTPExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
}

async function emitNotification(type, data, targetRoom) {
  if (ioRef) {
    const room = targetRoom || 'admin';
    ioRef.to(room).emit(type, data);
    console.log(`📤 [socket] emitted ${type} to room ${room}`);
  }
}

async function createNotif({ title, message, type, targetRole, communityId, entityId, residentName, flatNumber, recipientId, action, metadata }) {
  try {
    const Notification = require('../models/Notification');
    const notif = await Notification.create({
      title: title || '',
      message: message || '',
      type: type || 'VISITOR_EVENT',
      targetRole: targetRole || 'admin',
      entityType: 'visitor',
      entityId: entityId || null,
      action: action || null,
      metadata: metadata || {},
      communityId: communityId || null,
      recipientId: recipientId || null,
      residentName: residentName || '',
      flatNumber: flatNumber || '',
      read: false,
      createdAt: new Date(),
    });
    const room = targetRole && communityId ? `${targetRole}:${communityId}` : targetRole || 'admin';
    emitNotification('notification:new', notif.toObject ? notif.toObject() : notif, room);
    return notif;
  } catch (err) {
    console.error('createNotif error:', err);
  }
}

async function logVisitorEvent({ visitorId, communityId, event, actor, actorRole, notes, metadata }) {
  try {
    await VisitorLog.create({
      visitorId,
      communityId,
      event,
      timestamp: new Date(),
      actor: actor || '',
      actorRole: actorRole || 'system',
      notes: notes || '',
      metadata: metadata || {},
    });
  } catch (err) {
    console.error('logVisitorEvent error:', err);
  }
}

// Derive communityId from admin identity headers
async function deriveCommunityFromAdminHeaders(req) {
  const xAdminId = req.headers['x-admin-id'];
  const xCommunityId = req.headers['x-community-id'];
  if (!xAdminId || !xCommunityId) {
    return { communityId: null, error: 'Missing admin identity headers' };
  }
  const admin = await CommunityUser.findOne({ _id: xAdminId, role: 'admin', communityId: xCommunityId }).lean();
  if (!admin) {
    return { communityId: null, error: 'Invalid admin identity' };
  }
  return { communityId: String(admin.communityId), error: null };
}

// Derive communityId from worker identity (for security guards)
async function deriveCommunityFromWorkerHeaders(req) {
  const xWorkerId = req.headers['x-worker-id'];
  if (!xWorkerId) {
    return { communityId: null, error: 'Missing worker identity header (x-worker-id)' };
  }
  const worker = await Worker.findOne({ _id: xWorkerId, isActive: true }).lean();
  if (!worker) {
    return { communityId: null, error: 'Invalid worker identity' };
  }
  return { communityId: String(worker.communityId), worker, error: null };
}

// ─── Resident Endpoints ───────────────────────────────────────────────────────

/**
 * Resident creates a visitor invitation.
 * POST /api/visitors
 */
const createVisitor = async (req, res) => {
  try {
    const { userId } = req.body; // resident's CommunityUser _id
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    // Derive communityId from resident identity
    const resident = await CommunityUser.findOne({ _id: userId, role: 'resident' }).lean();
    if (!resident) {
      return res.status(403).json({ success: false, message: 'Forbidden: resident not found' });
    }
    const communityId = String(resident.communityId);

    const {
      visitorName,
      phoneNumber,
      visitorType,
      vehicleNumber,
      purpose,
      expectedDate,
      expectedTime,
      duration,
      notes,
    } = req.body;

    if (!visitorName || !phoneNumber || !visitorType || !expectedDate) {
      return res.status(400).json({ success: false, message: 'visitorName, phoneNumber, visitorType, and expectedDate are required' });
    }

    if (!VISITOR_TYPE_KEYS.includes(visitorType)) {
      return res.status(400).json({ success: false, message: 'Invalid visitor type' });
    }

    // Check blacklist
    const settings = await VisitorSettings.findOne({ communityId }).lean();
    if (settings?.blacklistedVisitors?.length > 0) {
      const isBlacklisted = settings.blacklistedVisitors.some(
        (b) => b.identifier === phoneNumber || b.identifier.toLowerCase() === visitorName.toLowerCase()
      );
      if (isBlacklisted) {
        return res.status(403).json({ success: false, message: 'This visitor has been blacklisted by the community' });
      }
    }

    // Generate visitor pass
    const visitorId = generateVisitorId(communityId);
    const otp = generateOTP();
    const otpExpiresAt = getOTPExpiry();
    const qrPayload = generateQrPayload(visitorId, communityId);

    const approvalRequired = settings?.defaultApprovalRequired !== false;

    // Check daily limit
    if (settings?.maxVisitorsPerDay > 0) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const todayCount = await Visitor.countDocuments({
        communityId,
        residentId: userId,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        status: { $ne: 'cancelled' },
      });
      if (todayCount >= settings.maxVisitorsPerDay) {
        return res.status(403).json({ success: false, message: `Daily visitor limit (${settings.maxVisitorsPerDay}) reached` });
      }
    }

    const visitor = await Visitor.create({
      communityId,
      residentId: userId,
      residentName: resident.fullName || '',
      block: resident.block || '',
      flatNumber: resident.flatNumber || '',
      visitorName,
      phoneNumber,
      visitorType,
      vehicleNumber: vehicleNumber || '',
      purpose: purpose || '',
      expectedDate: new Date(expectedDate),
      expectedTime: expectedTime || '',
      duration: duration || '',
      notes: notes || '',
      visitorId,
      qrPayload,
      otp,
      otpExpiresAt,
      otpUsed: false,
      status: 'scheduled',
      approvalRequired,
      approvalStatus: approvalRequired ? 'pending' : null,
      createdBy: userId,
    });

    // Log event
    await logVisitorEvent({
      visitorId: visitor._id,
      communityId,
      event: 'scheduled',
      actor: resident.fullName,
      actorRole: 'resident',
      notes: `Visitor ${visitorName} scheduled for ${expectedDate}`,
    });

    // Notify security
    await createNotif({
      title: 'New Visitor Scheduled',
      message: `${visitorName} is expected at ${resident.block || ''}-${resident.flatNumber || ''}`,
      type: 'VISITOR_SCHEDULED',
      targetRole: 'admin',
      communityId,
      entityId: visitor._id.toString(),
      residentName: resident.fullName,
      flatNumber: resident.flatNumber,
      action: 'visitor_scheduled',
      metadata: { visitorType, visitorName, phoneNumber, visitorId },
    });

    return res.status(201).json({
      success: true,
      visitor: visitor.toObject(),
    });
  } catch (err) {
    console.error('createVisitor error:', err);
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate visitor entry' });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident lists their visitors.
 * GET /api/visitors/my?userId=xxx&status=scheduled&page=1&limit=20
 */
const getMyVisitors = async (req, res) => {
  try {
    const { userId, status, page = 1, limit = 20 } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const resident = await CommunityUser.findOne({ _id: userId, role: 'resident' }).lean();
    if (!resident) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const query = { communityId: String(resident.communityId), residentId: userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const total = await Visitor.countDocuments(query);
    const visitors = await Visitor.find(query)
      .sort({ expectedDate: -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    return res.json({ success: true, visitors, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('getMyVisitors error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident gets upcoming visitors.
 * GET /api/visitors/upcoming?userId=xxx
 */
const getUpcomingVisitors = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const resident = await CommunityUser.findOne({ _id: userId, role: 'resident' }).lean();
    if (!resident) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const now = new Date();
    const visitors = await Visitor.find({
      communityId: String(resident.communityId),
      residentId: userId,
      expectedDate: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
      status: { $in: ['scheduled', 'arrived'] },
    })
      .sort({ expectedDate: 1, expectedTime: 1 })
      .limit(20)
      .lean();

    return res.json({ success: true, visitors });
  } catch (err) {
    console.error('getUpcomingVisitors error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident cancels a visitor.
 * PUT /api/visitors/:id/cancel
 */
const cancelVisitor = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const resident = await CommunityUser.findOne({ _id: userId, role: 'resident' }).lean();
    if (!resident) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const visitor = await Visitor.findOneAndUpdate(
      { _id: id, communityId: String(resident.communityId), residentId: userId, status: { $in: ['scheduled', 'arrived'] } },
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: resident.fullName,
        cancelledReason: reason || 'Cancelled by resident',
      },
      { new: true, lean: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found or already processed' });
    }

    await logVisitorEvent({
      visitorId: id,
      communityId: String(resident.communityId),
      event: 'cancelled',
      actor: resident.fullName,
      actorRole: 'resident',
      notes: reason || 'Cancelled by resident',
    });

    await createNotif({
      title: 'Visitor Cancelled',
      message: `${visitor.visitorName} has been cancelled by ${resident.fullName}`,
      type: 'VISITOR_CANCELLED',
      targetRole: 'admin',
      communityId: String(resident.communityId),
      entityId: id,
      residentName: resident.fullName,
      flatNumber: resident.flatNumber,
      action: 'visitor_cancelled',
    });

    return res.json({ success: true, visitor });
  } catch (err) {
    console.error('cancelVisitor error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident gets visitor pass details (QR, OTP, status).
 * GET /api/visitors/:id/pass
 */
const getVisitorPass = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const resident = await CommunityUser.findOne({ _id: userId, role: 'resident' }).lean();
    if (!resident) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const visitor = await Visitor.findOne({
      _id: id,
      communityId: String(resident.communityId),
      residentId: userId,
    }).lean();

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    // Generate fresh OTP if expired
    let otp = visitor.otp;
    let otpExpiresAt = visitor.otpExpiresAt;
    if (visitor.otpUsed || !visitor.otpExpiresAt || new Date(visitor.otpExpiresAt) < new Date()) {
      otp = generateOTP();
      otpExpiresAt = getOTPExpiry();
      await Visitor.findByIdAndUpdate(id, { otp, otpExpiresAt, otpUsed: false });
    }

    // Generate fresh QR payload
    const qrPayload = generateQrPayload(visitor.visitorId, String(resident.communityId));

    return res.json({
      success: true,
      pass: {
        visitorId: visitor.visitorId,
        visitorName: visitor.visitorName,
        visitorType: visitor.visitorType,
        phoneNumber: visitor.phoneNumber,
        vehicleNumber: visitor.vehicleNumber,
        expectedDate: visitor.expectedDate,
        expectedTime: visitor.expectedTime,
        flatNumber: visitor.flatNumber,
        block: visitor.block,
        status: visitor.status,
        otp,
        otpExpiresAt,
        qrPayload,
        createdAt: visitor.createdAt,
      },
    });
  } catch (err) {
    console.error('getVisitorPass error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident approves a visitor (after arrival notification).
 * PUT /api/visitors/:id/approve
 */
const approveVisitorArrival = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const resident = await CommunityUser.findOne({ _id: userId, role: 'resident' }).lean();
    if (!resident) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const visitor = await Visitor.findOneAndUpdate(
      { _id: id, communityId: String(resident.communityId), residentId: userId, status: 'arrived' },
      {
        approvalStatus: 'approved',
        residentApprovedAt: new Date(),
        residentApprovedBy: resident.fullName,
      },
      { new: true, lean: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found or not in arrived status' });
    }

    await logVisitorEvent({
      visitorId: id,
      communityId: String(resident.communityId),
      event: 'resident_approved',
      actor: resident.fullName,
      actorRole: 'resident',
      notes: 'Resident approved visitor entry',
    });

    await createNotif({
      title: 'Visitor Approved',
      message: `${resident.fullName} approved entry for ${visitor.visitorName}`,
      type: 'VISITOR_APPROVED',
      targetRole: 'admin',
      communityId: String(resident.communityId),
      entityId: id,
      residentName: resident.fullName,
      flatNumber: resident.flatNumber,
      action: 'visitor_approved',
    });

    return res.json({ success: true, visitor });
  } catch (err) {
    console.error('approveVisitorArrival error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Security Endpoints ───────────────────────────────────────────────────────

/**
 * Security gets today's visitors.
 * GET /api/visitors/today?workerId=xxx
 */
const getTodayVisitors = async (req, res) => {
  try {
    const { workerId } = req.query;
    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const worker = await Worker.findOne({ _id: workerId, isActive: true }).lean();
    if (!worker) {
      return res.status(403).json({ success: false, message: 'Forbidden: worker not found' });
    }

    const communityId = String(worker.communityId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const visitors = await Visitor.find({
      communityId,
      $or: [
        { expectedDate: { $gte: startOfDay, $lte: endOfDay } },
        { arrivedAt: { $gte: startOfDay, $lte: endOfDay } },
        { enteredAt: { $gte: startOfDay, $lte: endOfDay } },
        { exitedAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    })
      .sort({ expectedDate: -1, createdAt: -1 })
      .limit(100)
      .lean();

    const stats = {
      total: visitors.length,
      expected: visitors.filter((v) => v.status === 'scheduled').length,
      arrived: visitors.filter((v) => v.status === 'arrived').length,
      inside: visitors.filter((v) => v.status === 'entered').length,
      completed: visitors.filter((v) => v.status === 'exited' || v.status === 'completed').length,
      cancelled: visitors.filter((v) => v.status === 'cancelled').length,
      rejected: visitors.filter((v) => v.status === 'rejected').length,
      pendingApproval: visitors.filter((v) => v.status === 'arrived' && v.approvalStatus === 'pending').length,
      deliveries: visitors.filter((v) => isDeliveryType(v.visitorType)).length,
    };

    return res.json({ success: true, visitors, stats });
  } catch (err) {
    console.error('getTodayVisitors error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Search visitors by phone, visitorId, OTP, name.
 * GET /api/visitors/search?query=xxx&workerId=xxx
 */
const searchVisitor = async (req, res) => {
  try {
    const { query, workerId } = req.query;
    if (!query || !workerId) {
      return res.status(400).json({ success: false, message: 'query and workerId are required' });
    }

    const worker = await Worker.findOne({ _id: workerId, isActive: true }).lean();
    if (!worker) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const communityId = String(worker.communityId);
    const searchRegex = new RegExp(String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const visitors = await Visitor.find({
      communityId,
      $or: [
        { phoneNumber: searchRegex },
        { visitorName: searchRegex },
        { visitorId: searchRegex },
        { otp: query },
        { flatNumber: searchRegex },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json({ success: true, visitors });
  } catch (err) {
    console.error('searchVisitor error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Security marks visitor as arrived.
 * PUT /api/visitors/:id/arrived
 */
const markArrived = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const worker = await Worker.findOne({ _id: workerId, isActive: true }).lean();
    if (!worker) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const visitor = await Visitor.findOneAndUpdate(
      { _id: id, communityId: String(worker.communityId), status: 'scheduled' },
      {
        status: 'arrived',
        arrivedAt: new Date(),
        securityVerifiedBy: worker.name,
        securityVerifiedAt: new Date(),
      },
      { new: true, lean: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found or already processed' });
    }

    await logVisitorEvent({
      visitorId: id,
      communityId: String(worker.communityId),
      event: 'arrived',
      actor: worker.name,
      actorRole: 'security',
      notes: 'Visitor arrived at gate',
    });

    // Notify resident
    await createNotif({
      title: 'Visitor Has Arrived',
      message: `${visitor.visitorName} has arrived at the gate. Please approve their entry.`,
      type: 'VISITOR_ARRIVED',
      targetRole: 'resident',
      communityId: String(worker.communityId),
      entityId: id,
      residentName: visitor.residentName,
      flatNumber: visitor.flatNumber,
      recipientId: visitor.residentId,
      action: 'visitor_arrived',
      metadata: { visitorName: visitor.visitorName, visitorType: visitor.visitorType },
    });

    // Notify admin
    await createNotif({
      title: 'Visitor Arrived',
      message: `${visitor.visitorName} has arrived at ${visitor.block || ''}-${visitor.flatNumber || ''}`,
      type: 'VISITOR_ARRIVED',
      targetRole: 'admin',
      communityId: String(worker.communityId),
      entityId: id,
      residentName: visitor.residentName,
      flatNumber: visitor.flatNumber,
      action: 'visitor_arrived',
    });

    return res.json({ success: true, visitor });
  } catch (err) {
    console.error('markArrived error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Security marks visitor as entered (after OTP/QR verification or resident approval).
 * PUT /api/visitors/:id/enter
 */
const markEntered = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId, otp, qrCode } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const worker = await Worker.findOne({ _id: workerId, isActive: true }).lean();
    if (!worker) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const communityId = String(worker.communityId);
    const query = { _id: id, communityId, status: { $in: ['scheduled', 'arrived'] } };

    // If OTP provided, verify it
    if (otp) {
      query.otp = otp;
      query.otpUsed = false;
      query.otpExpiresAt = { $gte: new Date() };
    }

    const visitor = await Visitor.findOneAndUpdate(
      query,
      {
        status: 'entered',
        enteredAt: new Date(),
        securityVerifiedBy: worker.name,
        securityVerifiedAt: new Date(),
        ...(otp ? { otpUsed: true } : {}),
      },
      { new: true, lean: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found, already entered, or invalid OTP' });
    }

    const eventNote = otp ? 'OTP verified, visitor entered' : 'Visitor entered (manual)';
    await logVisitorEvent({
      visitorId: id,
      communityId,
      event: 'entered',
      actor: worker.name,
      actorRole: 'security',
      notes: eventNote,
      metadata: otp ? { verificationMethod: 'otp' } : { verificationMethod: 'manual' },
    });

    if (otp) {
      await logVisitorEvent({
        visitorId: id,
        communityId,
        event: 'otp_verified',
        actor: worker.name,
        actorRole: 'security',
        notes: 'OTP verified successfully',
      });
    }

    // Notify resident
    await createNotif({
      title: 'Visitor Entered',
      message: `${visitor.visitorName} has entered the community.`,
      type: 'VISITOR_ENTERED',
      targetRole: 'resident',
      communityId,
      entityId: id,
      residentName: visitor.residentName,
      flatNumber: visitor.flatNumber,
      recipientId: visitor.residentId,
      action: 'visitor_entered',
    });

    await createNotif({
      title: 'Visitor Entered',
      message: `${visitor.visitorName} entered at ${visitor.block || ''}-${visitor.flatNumber || ''}`,
      type: 'VISITOR_ENTERED',
      targetRole: 'admin',
      communityId,
      entityId: id,
      residentName: visitor.residentName,
      flatNumber: visitor.flatNumber,
      action: 'visitor_entered',
    });

    return res.json({ success: true, visitor });
  } catch (err) {
    console.error('markEntered error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Security marks visitor as exited.
 * PUT /api/visitors/:id/exit
 */
const markExited = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const worker = await Worker.findOne({ _id: workerId, isActive: true }).lean();
    if (!worker) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const visitor = await Visitor.findOneAndUpdate(
      { _id: id, communityId: String(worker.communityId), status: 'entered' },
      {
        status: 'exited',
        exitedAt: new Date(),
      },
      { new: true, lean: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found or not inside' });
    }

    await logVisitorEvent({
      visitorId: id,
      communityId: String(worker.communityId),
      event: 'exited',
      actor: worker.name,
      actorRole: 'security',
      notes: 'Visitor exited the community',
    });

    await createNotif({
      title: 'Visitor Exited',
      message: `${visitor.visitorName} has exited the community.`,
      type: 'VISITOR_EXITED',
      targetRole: 'resident',
      communityId: String(worker.communityId),
      entityId: id,
      residentName: visitor.residentName,
      flatNumber: visitor.flatNumber,
      recipientId: visitor.residentId,
      action: 'visitor_exited',
    });

    return res.json({ success: true, visitor });
  } catch (err) {
    console.error('markExited error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Security rejects a visitor.
 * PUT /api/visitors/:id/reject
 */
const markRejected = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId, reason } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const worker = await Worker.findOne({ _id: workerId, isActive: true }).lean();
    if (!worker) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const visitor = await Visitor.findOneAndUpdate(
      { _id: id, communityId: String(worker.communityId), status: { $in: ['scheduled', 'arrived'] } },
      {
        status: 'rejected',
        cancelledAt: new Date(),
        cancelledBy: worker.name,
        cancelledReason: reason || 'Rejected by security',
      },
      { new: true, lean: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found or already processed' });
    }

    await logVisitorEvent({
      visitorId: id,
      communityId: String(worker.communityId),
      event: 'rejected',
      actor: worker.name,
      actorRole: 'security',
      notes: reason || 'Rejected by security',
    });

    return res.json({ success: true, visitor });
  } catch (err) {
    console.error('markRejected error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get visitor timeline.
 * GET /api/visitors/:id/timeline
 */
const getVisitorTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await VisitorLog.find({ visitorId: id }).sort({ timestamp: 1 }).lean();
    return res.json({ success: true, timeline: logs });
  } catch (err) {
    console.error('getVisitorTimeline error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Admin Endpoints ──────────────────────────────────────────────────────────

/**
 * Admin gets visitor analytics.
 * GET /api/visitors/analytics
 */
const getVisitorAnalytics = async (req, res) => {
  try {
    const { communityId, error } = await deriveCommunityFromAdminHeaders(req);
    if (error) {
      return res.status(403).json({ success: false, message: error });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayCount, weekCount, monthCount, allVisitors, logs] = await Promise.all([
      Visitor.countDocuments({ communityId, createdAt: { $gte: startOfDay } }),
      Visitor.countDocuments({ communityId, createdAt: { $gte: startOfWeek } }),
      Visitor.countDocuments({ communityId, createdAt: { $gte: startOfMonth } }),
      Visitor.find({ communityId }).lean(),
      VisitorLog.find({ communityId, timestamp: { $gte: startOfDay } }).lean(),
    ]);

    const inside = allVisitors.filter((v) => v.status === 'entered').length;
    const completed = allVisitors.filter((v) => v.status === 'exited' || v.status === 'completed').length;
    const rejected = allVisitors.filter((v) => v.status === 'rejected').length;
    const deliveries = allVisitors.filter((v) => isDeliveryType(v.visitorType)).length;
    const guests = allVisitors.filter((v) => v.visitorType === 'guest').length;
    const cancelled = allVisitors.filter((v) => v.status === 'cancelled').length;

    // Peak hours (from today's logs)
    const hourCounts = {};
    logs.forEach((log) => {
      const hour = new Date(log.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Visitor type breakdown
    const typeBreakdown = {};
    allVisitors.forEach((v) => {
      typeBreakdown[v.visitorType] = (typeBreakdown[v.visitorType] || 0) + 1;
    });

    return res.json({
      success: true,
      analytics: {
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
        inside,
        completed,
        rejected,
        cancelled,
        deliveries,
        guests,
        total: allVisitors.length,
        peakHours: hourCounts,
        typeBreakdown,
      },
    });
  } catch (err) {
    console.error('getVisitorAnalytics error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin lists all visitors (with filters).
 * GET /api/visitors/all?status=xxx&page=1&limit=20
 */
const listAllVisitors = async (req, res) => {
  try {
    const { communityId, error } = await deriveCommunityFromAdminHeaders(req);
    if (error) {
      return res.status(403).json({ success: false, message: error });
    }

    const { status, visitorType, page = 1, limit = 20 } = req.query;
    const query = { communityId };
    if (status && status !== 'all') query.status = status;
    if (visitorType && visitorType !== 'all') query.visitorType = visitorType;

    const total = await Visitor.countDocuments(query);
    const visitors = await Visitor.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    return res.json({ success: true, visitors, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('listAllVisitors error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin gets/sets visitor settings.
 * GET /api/visitors/settings
 * PUT /api/visitors/settings
 */
const getVisitorSettings = async (req, res) => {
  try {
    const { communityId, error } = await deriveCommunityFromAdminHeaders(req);
    if (error) {
      return res.status(403).json({ success: false, message: error });
    }

    let settings = await VisitorSettings.findOne({ communityId }).lean();
    if (!settings) {
      settings = await VisitorSettings.create({ communityId });
    }

    return res.json({ success: true, settings });
  } catch (err) {
    console.error('getVisitorSettings error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateVisitorSettings = async (req, res) => {
  try {
    const { communityId, error } = await deriveCommunityFromAdminHeaders(req);
    if (error) {
      return res.status(403).json({ success: false, message: error });
    }

    const { defaultApprovalRequired, maxVisitorsPerDay } = req.body;
    const update = {};
    if (defaultApprovalRequired !== undefined) update.defaultApprovalRequired = defaultApprovalRequired;
    if (maxVisitorsPerDay !== undefined) update.maxVisitorsPerDay = maxVisitorsPerDay;

    const settings = await VisitorSettings.findOneAndUpdate(
      { communityId },
      { $set: update },
      { new: true, upsert: true, lean: true }
    );

    return res.json({ success: true, settings });
  } catch (err) {
    console.error('updateVisitorSettings error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin blacklists a visitor.
 * POST /api/visitors/blacklist
 */
const blacklistVisitor = async (req, res) => {
  try {
    const { communityId, error } = await deriveCommunityFromAdminHeaders(req);
    if (error) {
      return res.status(403).json({ success: false, message: error });
    }

    const { identifier, type, reason } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'identifier is required' });
    }

    const settings = await VisitorSettings.findOneAndUpdate(
      { communityId },
      {
        $push: {
          blacklistedVisitors: {
            identifier,
            type: type || 'phone',
            reason: reason || '',
            addedBy: req.headers['x-admin-id'] || null,
            addedAt: new Date(),
          },
        },
      },
      { new: true, upsert: true, lean: true }
    );

    return res.json({ success: true, settings });
  } catch (err) {
    console.error('blacklistVisitor error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin emergency override.
 * PUT /api/visitors/emergency-override
 */
const emergencyOverride = async (req, res) => {
  try {
    const { communityId, error } = await deriveCommunityFromAdminHeaders(req);
    if (error) {
      return res.status(403).json({ success: false, message: error });
    }

    const { enabled, reason } = req.body;
    const admin = await CommunityUser.findOne({ _id: req.headers['x-admin-id'], communityId }).lean();

    const settings = await VisitorSettings.findOneAndUpdate(
      { communityId },
      {
        $set: {
          'emergencyOverride.enabled': !!enabled,
          'emergencyOverride.activatedBy': admin?.fullName || 'Admin',
          'emergencyOverride.activatedAt': new Date(),
          'emergencyOverride.reason': reason || '',
        },
      },
      { new: true, upsert: true, lean: true }
    );

    await createNotif({
      title: enabled ? '🚨 Emergency Override Activated' : 'Emergency Override Deactivated',
      message: enabled
        ? `Emergency override activated by ${admin?.fullName || 'Admin'}. All visitor restrictions bypassed.`
        : `Emergency override deactivated by ${admin?.fullName || 'Admin'}.`,
      type: 'EMERGENCY_OVERRIDE',
      targetRole: 'admin',
      communityId,
      action: enabled ? 'emergency_activated' : 'emergency_deactivated',
      metadata: { reason: reason || '' },
    });

    return res.json({ success: true, settings });
  } catch (err) {
    console.error('emergencyOverride error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── QR Scanner Endpoint ─────────────────────────────────────────────────────

/**
 * Scan a visitor QR code and validate.
 * POST /api/visitors/scan
 *
 * Expected body: { visitorId, communityId, workerId }
 * Validates: visitor exists, community matches, status is scheduled, date is today, OTP/QR not expired.
 */
const scanVisitorQR = async (req, res) => {
  try {
    const { visitorId, communityId, workerId } = req.body;

    if (!visitorId || !communityId || !workerId) {
      return res.status(400).json({ success: false, message: 'visitorId, communityId, and workerId are required' });
    }

    // 1. Validate worker (security guard)
    const worker = await Worker.findOne({ _id: workerId, isActive: true }).lean();
    if (!worker) {
      return res.status(403).json({ success: false, message: 'Invalid or unauthorized worker' });
    }

    const workerRole = worker.role || require('../constants/workerRoles').professionToRole(worker.profession);
    if (workerRole !== 'security_guard') {
      return res.status(403).json({ success: false, message: 'Only security guards can scan visitor QR codes' });
    }

    const guardCommunityId = String(worker.communityId);

    // 2. Validate communityId from QR matches guard's community
    if (String(communityId) !== guardCommunityId) {
      return res.status(403).json({ success: false, message: 'QR code does not belong to this community' });
    }

    // 3. Find visitor by visitorId AND communityId
    const visitor = await Visitor.findOne({ visitorId, communityId: guardCommunityId }).lean();

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found in this community' });
    }

    // 4. Validate visitor status
    if (visitor.status === 'completed' || visitor.status === 'exited') {
      // Visitor already completed — allow exit marking
      return res.json({
        success: true,
        action: 'exit',
        visitor: {
          _id: visitor._id,
          visitorId: visitor.visitorId,
          visitorName: visitor.visitorName,
          phoneNumber: visitor.phoneNumber,
          visitorType: visitor.visitorType,
          purpose: visitor.purpose,
          vehicleNumber: visitor.vehicleNumber,
          block: visitor.block,
          flatNumber: visitor.flatNumber,
          residentName: visitor.residentName,
          expectedDate: visitor.expectedDate,
          expectedTime: visitor.expectedTime,
          notes: visitor.notes,
          status: visitor.status,
          enteredAt: visitor.enteredAt,
          exitedAt: visitor.exitedAt,
          otp: visitor.otp,
          securityVerifiedBy: visitor.securityVerifiedBy,
        },
        message: 'This visitor has already been processed. Previous entry recorded.',
      });
    }

    if (visitor.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'This visitor invitation has been cancelled by the resident' });
    }

    if (visitor.status === 'rejected') {
      return res.status(400).json({ success: false, message: 'This visitor was previously rejected' });
    }

    if (visitor.status === 'entered') {
      // Visitor is inside — allow exit marking
      return res.json({
        success: true,
        action: 'exit',
        visitor: {
          _id: visitor._id,
          visitorId: visitor.visitorId,
          visitorName: visitor.visitorName,
          phoneNumber: visitor.phoneNumber,
          visitorType: visitor.visitorType,
          purpose: visitor.purpose,
          vehicleNumber: visitor.vehicleNumber,
          block: visitor.block,
          flatNumber: visitor.flatNumber,
          residentName: visitor.residentName,
          expectedDate: visitor.expectedDate,
          expectedTime: visitor.expectedTime,
          notes: visitor.notes,
          status: visitor.status,
          enteredAt: visitor.enteredAt,
          otp: visitor.otp,
          securityVerifiedBy: visitor.securityVerifiedBy,
        },
        message: 'Visitor is currently inside. Mark exit?',
      });
    }

    // 5. Validate date is today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const visitorDate = new Date(visitor.expectedDate);
    visitorDate.setHours(0, 0, 0, 0);

    if (visitorDate < today) {
      return res.status(400).json({ success: false, message: 'This visitor pass has expired (expected date has passed)' });
    }

    if (visitorDate > today) {
      return res.status(400).json({ success: false, message: 'This visitor pass is not yet valid (expected date is in the future)' });
    }

    // 6. Validate OTP not expired
    if (visitor.otpExpiresAt && new Date(visitor.otpExpiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: 'Visitor OTP has expired. Please ask the resident to regenerate the pass.' });
    }

    // 7. Check if QR payload has expired (10 min from generation)
    if (visitor.qrPayload) {
      try {
        const parsed = JSON.parse(visitor.qrPayload);
        if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
          return res.status(400).json({ success: false, message: 'QR code has expired. Resident needs to regenerate the pass.' });
        }
      } catch (e) {
        // If parsing fails, continue (QR payload is just a string)
      }
    }

    // 8. Check blacklist
    const settings = await VisitorSettings.findOne({ communityId: guardCommunityId }).lean();
    if (settings?.blacklistedVisitors?.length > 0) {
      const isBlacklisted = settings.blacklistedVisitors.some(
        (b) => b.identifier === visitor.phoneNumber || b.identifier.toLowerCase() === visitor.visitorName.toLowerCase()
      );
      if (isBlacklisted) {
        return res.status(403).json({ success: false, message: 'This visitor has been blacklisted by the community' });
      }
    }

    // 9. Check emergency override
    if (settings?.emergencyOverride?.enabled) {
      // Emergency mode — allow entry directly
      const updated = await Visitor.findOneAndUpdate(
        { _id: visitor._id },
        {
          status: 'entered',
          enteredAt: new Date(),
          securityVerifiedBy: worker.name,
          securityVerifiedAt: new Date(),
        },
        { new: true, lean: true }
      );

      await logVisitorEvent({
        visitorId: visitor._id.toString(),
        communityId: guardCommunityId,
        event: 'emergency_entry',
        actor: worker.name,
        actorRole: 'security',
        notes: 'Emergency override — direct entry granted',
      });

      await createNotif({
        title: '🚨 Emergency Entry',
        message: `${visitor.visitorName} entered under emergency override by ${worker.name}`,
        type: 'VISITOR_EMERGENCY_ENTRY',
        targetRole: 'admin',
        communityId: guardCommunityId,
        entityId: visitor._id.toString(),
        residentName: visitor.residentName,
        flatNumber: visitor.flatNumber,
        action: 'emergency_entry',
      });

      return res.json({
        success: true,
        action: 'entered_emergency',
        visitor: updated,
        message: 'Emergency override active — visitor entry granted automatically',
      });
    }

    // All validations passed — return visitor details for confirmation
    return res.json({
      success: true,
      action: 'entry',
      visitor: {
        _id: visitor._id,
        visitorId: visitor.visitorId,
        visitorName: visitor.visitorName,
        phoneNumber: visitor.phoneNumber,
        visitorType: visitor.visitorType,
        purpose: visitor.purpose,
        vehicleNumber: visitor.vehicleNumber,
        block: visitor.block,
        flatNumber: visitor.flatNumber,
        residentName: visitor.residentName,
        expectedDate: visitor.expectedDate,
        expectedTime: visitor.expectedTime,
        duration: visitor.duration,
        notes: visitor.notes,
        status: visitor.status,
        otp: visitor.otp,
        otpExpiresAt: visitor.otpExpiresAt,
        approvalRequired: visitor.approvalRequired,
        approvalStatus: visitor.approvalStatus,
      },
      message: 'Visitor validated. Ready for entry.',
    });
  } catch (err) {
    console.error('scanVisitorQR error:', err);
    return res.status(500).json({ success: false, message: 'Server error during QR scan' });
  }
};

/**
 * Allow entry after QR scan confirmation.
 * PUT /api/visitors/:id/allow-entry
 */
const allowEntryAfterScan = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId, approvalMethod } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const worker = await Worker.findOne({ _id: workerId, isActive: true }).lean();
    if (!worker) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const communityId = String(worker.communityId);
    const method = approvalMethod || 'qr';

    const visitor = await Visitor.findOneAndUpdate(
      { _id: id, communityId, status: 'scheduled' },
      {
        status: 'arrived',
        arrivedAt: new Date(),
        securityVerifiedBy: worker.name,
        securityVerifiedAt: new Date(),
      },
      { new: true, lean: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found or already processed' });
    }

    // Log the scan
    await logVisitorEvent({
      visitorId: id,
      communityId,
      event: 'qr_scanned_entry',
      actor: worker.name,
      actorRole: 'security',
      notes: `Entry approved via ${method} scan`,
      metadata: { approvalMethod: method, guardId: workerId },
    });

    // Also mark as entered for seamless flow (since QR is already verified)
    await Visitor.findByIdAndUpdate(id, {
      status: 'entered',
      enteredAt: new Date(),
    });

    await logVisitorEvent({
      visitorId: id,
      communityId,
      event: 'entered',
      actor: worker.name,
      actorRole: 'security',
      notes: `Visitor entered via QR scan (${method})`,
    });

    // Notify resident
    await createNotif({
      title: 'Visitor Entered via QR',
      message: `${visitor.visitorName} has entered the community via QR scan.`,
      type: 'VISITOR_ENTERED',
      targetRole: 'resident',
      communityId,
      entityId: id,
      residentName: visitor.residentName,
      flatNumber: visitor.flatNumber,
      recipientId: visitor.residentId,
      action: 'visitor_entered',
      metadata: { method: 'qr_scan' },
    });

    // Notify admin
    await createNotif({
      title: 'Visitor Entered via QR',
      message: `${visitor.visitorName} entered at ${visitor.block || ''}-${visitor.flatNumber || ''} via QR scan`,
      type: 'VISITOR_ENTERED',
      targetRole: 'admin',
      communityId,
      entityId: id,
      residentName: visitor.residentName,
      flatNumber: visitor.flatNumber,
      action: 'visitor_entered',
    });

    return res.json({ success: true, visitor });
  } catch (err) {
    console.error('allowEntryAfterScan error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Mark exit after scanning QR for a visitor who is inside.
 * PUT /api/visitors/:id/mark-exit
 */
const markExitAfterScan = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const worker = await Worker.findOne({ _id: workerId, isActive: true }).lean();
    if (!worker) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const communityId = String(worker.communityId);

    const visitor = await Visitor.findOneAndUpdate(
      { _id: id, communityId, status: 'entered' },
      {
        status: 'exited',
        exitedAt: new Date(),
      },
      { new: true, lean: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found or not currently inside' });
    }

    await logVisitorEvent({
      visitorId: id,
      communityId,
      event: 'exited',
      actor: worker.name,
      actorRole: 'security',
      notes: 'Exited via QR scan',
      metadata: { guardId: workerId },
    });

    await createNotif({
      title: 'Visitor Exited via QR',
      message: `${visitor.visitorName} has exited the community.`,
      type: 'VISITOR_EXITED',
      targetRole: 'resident',
      communityId,
      entityId: id,
      residentName: visitor.residentName,
      flatNumber: visitor.flatNumber,
      recipientId: visitor.residentId,
      action: 'visitor_exited',
    });

    return res.json({ success: true, visitor });
  } catch (err) {
    console.error('markExitAfterScan error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Reject entry after QR scan.
 * PUT /api/visitors/:id/reject-entry
 */
const rejectEntryAfterScan = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId, reason } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const worker = await Worker.findOne({ _id: workerId, isActive: true }).lean();
    if (!worker) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const communityId = String(worker.communityId);

    const visitor = await Visitor.findOneAndUpdate(
      { _id: id, communityId, status: { $in: ['scheduled', 'arrived'] } },
      {
        status: 'rejected',
        cancelledAt: new Date(),
        cancelledBy: worker.name,
        cancelledReason: reason || 'Rejected after QR scan',
      },
      { new: true, lean: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found or already processed' });
    }

    await logVisitorEvent({
      visitorId: id,
      communityId,
      event: 'rejected',
      actor: worker.name,
      actorRole: 'security',
      notes: reason || 'Rejected after QR scan',
      metadata: { guardId: workerId },
    });

    await createNotif({
      title: 'Visitor Rejected',
      message: `${visitor.visitorName} was rejected by security at the gate.`,
      type: 'VISITOR_REJECTED',
      targetRole: 'resident',
      communityId,
      entityId: id,
      residentName: visitor.residentName,
      flatNumber: visitor.flatNumber,
      recipientId: visitor.residentId,
      action: 'visitor_rejected',
    });

    return res.json({ success: true, visitor });
  } catch (err) {
    console.error('rejectEntryAfterScan error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Worker Role Detection ────────────────────────────────────────────────────

/**
 * Get worker role info (used by frontend to determine dashboard).
 * GET /api/workers/:workerId/role
 */
const getWorkerRole = async (req, res) => {
  try {
    const { workerId } = req.params;
    const worker = await Worker.findOne({ _id: workerId }).lean();
    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    const role = worker.role || professionToRole(worker.profession);

    return res.json({
      success: true,
      role,
      roleLabel: require('../constants/workerRoles').WORKER_ROLE_MAP[role] || worker.profession,
      profession: worker.profession,
      name: worker.name,
    });
  } catch (err) {
    console.error('getWorkerRole error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  // Resident
  createVisitor,
  getMyVisitors,
  getUpcomingVisitors,
  cancelVisitor,
  getVisitorPass,
  approveVisitorArrival,
  // Security
  getTodayVisitors,
  searchVisitor,
  markArrived,
  markEntered,
  markExited,
  markRejected,
  getVisitorTimeline,
  // QR Scanner
  scanVisitorQR,
  allowEntryAfterScan,
  markExitAfterScan,
  rejectEntryAfterScan,
  // Admin
  getVisitorAnalytics,
  listAllVisitors,
  getVisitorSettings,
  updateVisitorSettings,
  blacklistVisitor,
  emergencyOverride,
  // Worker
  getWorkerRole,
  setIO,
};
