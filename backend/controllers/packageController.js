const mongoose = require('mongoose');
const Package = require('../models/Package');
const PackageHistory = require('../models/PackageHistory');
const CommunityUser = require('../models/CommunityUser');
const {
  COURIER_COMPANY_KEYS,
  COURIER_COMPANY_MAP,
  PACKAGE_CATEGORY_KEYS,
  PACKAGE_STATUSES,
} = require('../constants/packageTypes');
const {
  setIO,
  emitTo,
  createAndEmitNotification,
  emitChannelEvent,
  writeAuditLog,
  extractRequestContext,
  deriveAdmin,
  deriveResident,
  deriveWorker,
  toCSV,
  isValidObjectId,
} = require('../services/communityService');

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function generatePackageId(communityId) {
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PK-${ts}${rand}`;
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateQrPayload(packageId, communityId) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
  return JSON.stringify({ packageId, communityId, expiresAt });
}

function getOTPExpiry() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
}

async function logPackageEvent({ packageDoc, event, actor, actorRole, actorUserId, notes, req, metadata }) {
  try {
    const ctx = extractRequestContext(req || {});
    await PackageHistory.create({
      communityId: packageDoc.communityId,
      packageId: packageDoc._id,
      packageNumber: packageDoc.packageId || '',
      event,
      actor: actor || '',
      actorRole: actorRole || 'system',
      actorUserId: actorUserId ? String(actorUserId) : null,
      ip: ctx.ip,
      device: ctx.device,
      userAgent: ctx.userAgent,
      notes: notes || '',
      metadata: metadata || {},
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('logPackageEvent error:', err);
  }
}

async function notifyResident(pkg, payload) {
  try {
    await createAndEmitNotification({
      title: payload.title,
      message: payload.message,
      type: payload.type,
      targetRole: 'resident',
      communityId: pkg.communityId,
      entityType: 'package',
      entityId: String(pkg._id),
      action: payload.action,
      metadata: {
        packageId: pkg.packageId,
        courier: pkg.courierCompany,
        trackingNumber: pkg.trackingNumber,
        status: pkg.status,
      },
      recipientId: pkg.residentId,
      recipientName: pkg.residentName,
      residentName: pkg.residentName,
      flatNumber: pkg.flatNumber,
    });
  } catch (err) {
    console.error('notifyResident error:', err);
  }
}

async function notifyAdmin(pkg, payload) {
  try {
    await createAndEmitNotification({
      title: payload.title,
      message: payload.message,
      type: payload.type,
      targetRole: 'admin',
      communityId: pkg.communityId,
      entityType: 'package',
      entityId: String(pkg._id),
      action: payload.action,
      metadata: {
        packageId: pkg.packageId,
        courier: pkg.courierCompany,
        residentName: pkg.residentName,
        flatNumber: pkg.flatNumber,
        status: pkg.status,
      },
    });
  } catch (err) {
    console.error('notifyAdmin error:', err);
  }
}

async function deriveSecurity(req) {
  const { communityId, worker, error } = await deriveWorker(req.body?.workerId || req.query?.workerId || req.headers?.['x-worker-id'], {
    requireRole: 'security_guard',
  });
  return { communityId, worker, error };
}

/* ─── Security Endpoints ──────────────────────────────────────────────────── */

/**
 * Security searches residents by name/flat for package registration.
 * GET /api/packages/residents/search?query=xxx&workerId=xxx
 */
const searchResidents = async (req, res) => {
  try {
    const { communityId, error } = await deriveSecurity(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { query } = req.query;
    if (!query || String(query).trim().length < 2) {
      return res.json({ success: true, residents: [] });
    }
    const regex = new RegExp(String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const residents = await CommunityUser.find({
      communityId,
      role: 'resident',
      status: 'approved',
      $or: [{ fullName: regex }, { flatNumber: regex }, { block: regex }],
    })
      .select({ fullName: 1, block: 1, flatNumber: 1 })
      .limit(20)
      .lean();

    return res.json({ success: true, residents });
  } catch (err) {
    console.error('searchResidents error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Security registers a package (pre-receipt draft or immediate receive).
 * POST /api/packages/register
 * Body: { workerId, residentId, courierCompany, trackingNumber, packageCategory, remarks, expectedPickupTime }
 * Optional multipart: photo
 */
const registerPackage = async (req, res) => {
  try {
    const { communityId, worker, error } = await deriveSecurity(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { residentId, courierCompany, trackingNumber, packageCategory, remarks, expectedPickupTime } = req.body;

    if (!residentId || !courierCompany) {
      return res.status(400).json({ success: false, message: 'residentId and courierCompany are required' });
    }
    if (!COURIER_COMPANY_KEYS.includes(courierCompany)) {
      return res.status(400).json({ success: false, message: 'Invalid courier company' });
    }
    if (packageCategory && !PACKAGE_CATEGORY_KEYS.includes(packageCategory)) {
      return res.status(400).json({ success: false, message: 'Invalid package category' });
    }

    const resident = await CommunityUser.findOne({
      _id: residentId,
      role: 'resident',
      communityId,
      status: 'approved',
    }).lean();
    if (!resident) {
      return res.status(403).json({ success: false, message: 'Forbidden: resident not found in this community' });
    }

    const photo = req.file ? req.file.filename : null;
    const packageId = generatePackageId(communityId);
    const otp = generateOTP();
    const otpExpiresAt = getOTPExpiry();
    const qrPayload = generateQrPayload(packageId, communityId);

    const pkg = await Package.create({
      communityId,
      residentId: resident._id,
      residentName: resident.fullName || '',
      block: resident.block || '',
      flatNumber: resident.flatNumber || '',
      courierCompany,
      trackingNumber: trackingNumber || '',
      packageCategory: packageCategory || 'other',
      photo,
      securityRemarks: remarks || '',
      packageId,
      barcodeData: packageId,
      otp,
      otpExpiresAt,
      otpUsed: false,
      qrPayload,
      status: 'ready',
      readyAt: new Date(),
      receivedAt: new Date(),
      expectedPickupTime: expectedPickupTime ? new Date(expectedPickupTime) : null,
      receivedBy: worker.name || 'Security',
      receivedByWorkerId: String(worker._id),
      createdBy: String(worker._id),
    });

    await logPackageEvent({
      packageDoc: pkg,
      event: 'received',
      actor: worker.name,
      actorRole: 'security',
      actorUserId: worker._id,
      notes: `Package from ${COURIER_COMPANY_MAP[courierCompany] || courierCompany}`,
      req,
      metadata: { trackingNumber: trackingNumber || '', category: packageCategory || 'other' },
    });

    // Notify resident + admin
    await notifyResident(pkg, {
      title: '📦 Package Received',
      message: `A package from ${COURIER_COMPANY_MAP[courierCompany] || courierCompany} has arrived for you. It is ready for pickup.`,
      type: 'PACKAGE_RECEIVED',
      action: 'package_received',
    });
    await notifyAdmin(pkg, {
      title: 'Package Received',
      message: `${pkg.residentName} (${pkg.block}-${pkg.flatNumber}) has a package from ${COURIER_COMPANY_MAP[courierCompany] || courierCompany}.`,
      type: 'PACKAGE_RECEIVED',
      action: 'package_received',
    });

    // Real-time channel update
    emitChannelEvent(`resident:${communityId}`, 'package:new', pkg.toObject ? pkg.toObject() : pkg);
    emitChannelEvent(`admin:${communityId}`, 'package:new', pkg.toObject ? pkg.toObject() : pkg);

    // Audit log
    await writeAuditLog({
      communityId,
      entityType: 'package',
      entityId: String(pkg._id),
      action: 'receive',
      actor: worker.name,
      actorUserId: worker._id,
      actorRole: 'security',
      ...extractRequestContext(req),
      metadata: { packageId: pkg.packageId, courier: courierCompany },
    });

    return res.status(201).json({ success: true, package: pkg.toObject() });
  } catch (err) {
    console.error('registerPackage error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Security gets today's packages / pending pickup / history.
 * GET /api/packages/security?workerId=xxx&status=ready&view=all|today
 */
const getSecurityPackages = async (req, res) => {
  try {
    const { communityId, worker, error } = await deriveSecurity(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { status, view, search } = req.query;
    const query = { communityId };

    if (status && PACKAGE_STATUSES.includes(status)) query.status = status;
    if (view === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      query.receivedAt = { $gte: start, $lte: end };
    }
    if (search) {
      const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { packageId: regex },
        { trackingNumber: regex },
        { residentName: regex },
        { flatNumber: regex },
        { courierCompany: regex },
      ];
    }

    const packages = await Package.find(query).sort({ receivedAt: -1, createdAt: -1 }).limit(100).lean();

    const stats = {
      total: packages.length,
      incoming: packages.filter((p) => p.status === 'incoming').length,
      ready: packages.filter((p) => p.status === 'ready').length,
      pickedUp: packages.filter((p) => p.status === 'picked_up').length,
      returned: packages.filter((p) => p.status === 'returned').length,
      pendingPickup: packages.filter((p) => p.status === 'ready').length,
    };

    return res.json({ success: true, packages, stats });
  } catch (err) {
    console.error('getSecurityPackages error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Security verifies OTP for package pickup.
 * PUT /api/packages/:id/verify-otp
 * Body: { workerId, otp }
 */
const verifyPackageOtp = async (req, res) => {
  try {
    const { communityId, worker, error } = await deriveSecurity(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });

    const pkg = await Package.findOne({
      _id: id,
      communityId,
      status: { $in: ['ready', 'incoming'] },
      otp,
      otpUsed: false,
      otpExpiresAt: { $gte: new Date() },
    }).lean();

    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Invalid OTP, package already picked up, or OTP expired' });
    }

    const updated = await Package.findOneAndUpdate(
      { _id: pkg._id },
      {
        status: 'picked_up',
        pickedUpAt: new Date(),
        pickedUpBy: worker.name,
        verificationMethod: 'otp',
        otpUsed: true,
        updatedBy: String(worker._id),
      },
      { new: true, lean: true }
    );

    await logPackageEvent({
      packageDoc: updated,
      event: 'picked_up',
      actor: worker.name,
      actorRole: 'security',
      actorUserId: worker._id,
      notes: 'Package picked up after OTP verification',
      req,
      metadata: { verificationMethod: 'otp' },
    });

    await notifyResident(updated, {
      title: '📦 Package Picked Up',
      message: `Your package from ${COURIER_COMPANY_MAP[updated.courierCompany] || updated.courierCompany} has been picked up.`,
      type: 'PACKAGE_PICKED_UP',
      action: 'package_picked_up',
    });
    await notifyAdmin(updated, {
      title: 'Package Picked Up',
      message: `${updated.residentName} (${updated.block}-${updated.flatNumber}) picked up their package (OTP verified).`,
      type: 'PACKAGE_PICKED_UP',
      action: 'package_picked_up',
    });

    emitChannelEvent(`resident:${communityId}`, 'package:status', updated);
    emitChannelEvent(`admin:${communityId}`, 'package:status', updated);

    await writeAuditLog({
      communityId,
      entityType: 'package',
      entityId: String(updated._id),
      action: 'pickup',
      actor: worker.name,
      actorUserId: worker._id,
      actorRole: 'security',
      ...extractRequestContext(req),
      metadata: { packageId: updated.packageId, verificationMethod: 'otp' },
    });

    return res.json({ success: true, package: updated });
  } catch (err) {
    console.error('verifyPackageOtp error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Security scans a package QR for pickup.
 * POST /api/packages/scan
 * Body: { workerId, packageId, communityId }
 */
const scanPackageQr = async (req, res) => {
  try {
    const { communityId, worker, error } = await deriveSecurity(req);
    if (error) return res.status(403).json({ success: false, message: error });

    let { packageId, communityId: qrCommunityId } = req.body;
    if (!packageId) return res.status(400).json({ success: false, message: 'packageId is required' });

    // If QR payload is JSON, parse it
    if (typeof packageId === 'string' && packageId.startsWith('{')) {
      try {
        const parsed = JSON.parse(packageId);
        packageId = parsed.packageId;
        qrCommunityId = parsed.communityId || qrCommunityId;
      } catch (e) {
        // ignore
      }
    }

    if (!packageId) return res.status(400).json({ success: false, message: 'Invalid package QR' });

    // Validate community match
    if (qrCommunityId && String(qrCommunityId) !== String(communityId)) {
      return res.status(403).json({ success: false, message: 'Package QR does not belong to this community' });
    }

    const pkg = await Package.findOne({ packageId, communityId }).lean();
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

    if (pkg.status === 'picked_up' || pkg.status === 'returned' || pkg.status === 'cancelled') {
      return res.json({
        success: true,
        action: 'info',
        package: pkg,
        message: 'This package has already been processed.',
      });
    }

    return res.json({
      success: true,
      action: 'pickup',
      package: {
        _id: pkg._id,
        packageId: pkg.packageId,
        courierCompany: pkg.courierCompany,
        trackingNumber: pkg.trackingNumber,
        packageCategory: pkg.packageCategory,
        residentName: pkg.residentName,
        block: pkg.block,
        flatNumber: pkg.flatNumber,
        status: pkg.status,
        securityRemarks: pkg.securityRemarks,
        photo: pkg.photo,
        receivedAt: pkg.receivedAt,
      },
      message: 'Package verified. Confirm pickup?',
    });
  } catch (err) {
    console.error('scanPackageQr error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Security confirms pickup after QR scan / manual.
 * PUT /api/packages/:id/confirm-pickup
 * Body: { workerId, method }
 */
const confirmPickup = async (req, res) => {
  try {
    const { communityId, worker, error } = await deriveSecurity(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    const { method } = req.body;
    const verificationMethod = ['qr', 'otp', 'manual'].includes(method) ? method : 'qr';

    const updated = await Package.findOneAndUpdate(
      { _id: id, communityId, status: { $in: ['ready', 'incoming'] } },
      {
        status: 'picked_up',
        pickedUpAt: new Date(),
        pickedUpBy: worker.name,
        verificationMethod,
        otpUsed: true,
        updatedBy: String(worker._id),
      },
      { new: true, lean: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Package not found or already processed' });
    }

    await logPackageEvent({
      packageDoc: updated,
      event: 'picked_up',
      actor: worker.name,
      actorRole: 'security',
      actorUserId: worker._id,
      notes: `Package picked up via ${verificationMethod}`,
      req,
      metadata: { verificationMethod },
    });

    await notifyResident(updated, {
      title: '📦 Package Picked Up',
      message: `Your package from ${COURIER_COMPANY_MAP[updated.courierCompany] || updated.courierCompany} has been picked up.`,
      type: 'PACKAGE_PICKED_UP',
      action: 'package_picked_up',
    });
    await notifyAdmin(updated, {
      title: 'Package Picked Up',
      message: `${updated.residentName} (${updated.block}-${updated.flatNumber}) picked up their package (${verificationMethod}).`,
      type: 'PACKAGE_PICKED_UP',
      action: 'package_picked_up',
    });

    emitChannelEvent(`resident:${communityId}`, 'package:status', updated);
    emitChannelEvent(`admin:${communityId}`, 'package:status', updated);

    await writeAuditLog({
      communityId,
      entityType: 'package',
      entityId: String(updated._id),
      action: 'pickup',
      actor: worker.name,
      actorUserId: worker._id,
      actorRole: 'security',
      ...extractRequestContext(req),
      metadata: { packageId: updated.packageId, verificationMethod },
    });

    return res.json({ success: true, package: updated });
  } catch (err) {
    console.error('confirmPickup error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Security marks a package returned.
 * PUT /api/packages/:id/return
 * Body: { workerId, reason }
 */
const markReturned = async (req, res) => {
  try {
    const { communityId, worker, error } = await deriveSecurity(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    const { reason } = req.body;

    const updated = await Package.findOneAndUpdate(
      { _id: id, communityId, status: { $in: ['ready', 'incoming'] } },
      {
        status: 'returned',
        returnedAt: new Date(),
        returnedBy: worker.name,
        returnedReason: reason || 'Returned to courier',
        updatedBy: String(worker._id),
      },
      { new: true, lean: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Package not found or already processed' });
    }

    await logPackageEvent({
      packageDoc: updated,
      event: 'returned',
      actor: worker.name,
      actorRole: 'security',
      actorUserId: worker._id,
      notes: reason || 'Returned to courier',
      req,
    });

    await notifyResident(updated, {
      title: '📦 Package Returned',
      message: `Your package from ${COURIER_COMPANY_MAP[updated.courierCompany] || updated.courierCompany} was returned to the courier.`,
      type: 'PACKAGE_RETURNED',
      action: 'package_returned',
    });
    await notifyAdmin(updated, {
      title: 'Package Returned',
      message: `${updated.residentName} (${updated.block}-${updated.flatNumber}) package was returned to courier.`,
      type: 'PACKAGE_RETURNED',
      action: 'package_returned',
    });

    emitChannelEvent(`resident:${communityId}`, 'package:status', updated);
    emitChannelEvent(`admin:${communityId}`, 'package:status', updated);

    await writeAuditLog({
      communityId,
      entityType: 'package',
      entityId: String(updated._id),
      action: 'return',
      actor: worker.name,
      actorUserId: worker._id,
      actorRole: 'security',
      ...extractRequestContext(req),
      metadata: { packageId: updated.packageId, reason: reason || '' },
    });

    return res.json({ success: true, package: updated });
  } catch (err) {
    console.error('markReturned error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Security gets package history/timeline.
 * GET /api/packages/:id/history
 */
const getPackageHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { query } = req;
    // Allow access via security or admin identity
    const { communityId: secCommunity, error: secErr } = await deriveSecurity(req);
    const { communityId: adminCommunity, error: adminErr } = await deriveAdmin(req);
    const resident = await deriveResident(req.query?.userId);

    let communityId = null;
    if (!secErr && secCommunity) communityId = secCommunity;
    else if (!adminErr && adminCommunity) communityId = adminCommunity;
    else if (resident) communityId = resident.communityId;

    if (!communityId) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const pkg = await Package.findOne({ _id: id, communityId }).lean();
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

    const history = await PackageHistory.find({ packageId: pkg._id, communityId })
      .sort({ timestamp: 1 })
      .lean();

    return res.json({ success: true, package: pkg, history });
  } catch (err) {
    console.error('getPackageHistory error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─── Resident Endpoints ──────────────────────────────────────────────────── */

/**
 * Resident lists their packages.
 * GET /api/packages/my?userId=xxx&status=all
 */
const getMyPackages = async (req, res) => {
  try {
    const resident = await deriveResident(req.query.userId);
    if (!resident) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const { status } = req.query;
    const query = { communityId: resident.communityId, residentId: resident.residentId };
    if (status && status !== 'all' && PACKAGE_STATUSES.includes(status)) query.status = status;

    const packages = await Package.find(query).sort({ receivedAt: -1, createdAt: -1 }).lean();

    const stats = {
      incoming: packages.filter((p) => p.status === 'incoming').length,
      ready: packages.filter((p) => p.status === 'ready').length,
      pickedUp: packages.filter((p) => p.status === 'picked_up').length,
      returned: packages.filter((p) => p.status === 'returned').length,
      total: packages.length,
      pendingPickup: packages.filter((p) => p.status === 'ready').length,
    };

    return res.json({ success: true, packages, stats });
  } catch (err) {
    console.error('getMyPackages error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident views a package (marks viewed).
 * GET /api/packages/:id?userId=xxx
 */
const viewPackage = async (req, res) => {
  try {
    const resident = await deriveResident(req.query.userId);
    if (!resident) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const { id } = req.params;
    const pkg = await Package.findOne({ _id: id, communityId: resident.communityId, residentId: resident.residentId }).lean();
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

    if (!pkg.viewedAt) {
      await Package.findByIdAndUpdate(id, { viewedAt: new Date() });
      await logPackageEvent({
        packageDoc: pkg,
        event: 'viewed',
        actor: resident.fullName,
        actorRole: 'resident',
        actorUserId: resident.residentId,
        notes: 'Resident viewed package',
        req,
      });
    }

    return res.json({ success: true, package: pkg });
  } catch (err) {
    console.error('viewPackage error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident confirms pickup via OTP (self-serve).
 * PUT /api/packages/:id/pickup
 * Body: { userId, otp }
 */
const confirmPickupByResident = async (req, res) => {
  try {
    const resident = await deriveResident(req.body.userId);
    if (!resident) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const { id } = req.params;
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });

    const pkg = await Package.findOne({
      _id: id,
      communityId: resident.communityId,
      residentId: resident.residentId,
      status: { $in: ['ready', 'incoming'] },
      otp,
      otpUsed: false,
      otpExpiresAt: { $gte: new Date() },
    }).lean();

    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Invalid OTP, package already picked up, or OTP expired' });
    }

    const updated = await Package.findOneAndUpdate(
      { _id: pkg._id },
      {
        status: 'picked_up',
        pickedUpAt: new Date(),
        pickedUpBy: resident.fullName,
        verificationMethod: 'otp',
        otpUsed: true,
        updatedBy: String(resident.residentId),
      },
      { new: true, lean: true }
    );

    await logPackageEvent({
      packageDoc: updated,
      event: 'picked_up',
      actor: resident.fullName,
      actorRole: 'resident',
      actorUserId: resident.residentId,
      notes: 'Package picked up by resident (OTP)',
      req,
      metadata: { verificationMethod: 'otp' },
    });

    await notifyAdmin(updated, {
      title: 'Package Picked Up',
      message: `${updated.residentName} (${updated.block}-${updated.flatNumber}) confirmed pickup via OTP.`,
      type: 'PACKAGE_PICKED_UP',
      action: 'package_picked_up',
    });

    emitChannelEvent(`admin:${resident.communityId}`, 'package:status', updated);
    emitChannelEvent(`resident:${resident.communityId}`, 'package:status', updated);

    await writeAuditLog({
      communityId: resident.communityId,
      entityType: 'package',
      entityId: String(updated._id),
      action: 'pickup',
      actor: resident.fullName,
      actorUserId: resident.residentId,
      actorRole: 'resident',
      ...extractRequestContext(req),
      metadata: { packageId: updated.packageId, verificationMethod: 'otp' },
    });

    return res.json({ success: true, package: updated });
  } catch (err) {
    console.error('confirmPickupByResident error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident reports a missing package.
 * PUT /api/packages/:id/report-missing
 * Body: { userId, notes }
 */
const reportMissing = async (req, res) => {
  try {
    const resident = await deriveResident(req.body.userId);
    if (!resident) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const { id } = req.params;
    const { notes } = req.body;

    const updated = await Package.findOneAndUpdate(
      { _id: id, communityId: resident.communityId, residentId: resident.residentId },
      {
        reportedMissing: true,
        missingReportedAt: new Date(),
        missingReportedBy: resident.fullName,
        missingNotes: notes || '',
        updatedBy: String(resident.residentId),
      },
      { new: true, lean: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: 'Package not found' });

    await logPackageEvent({
      packageDoc: updated,
      event: 'reported_missing',
      actor: resident.fullName,
      actorRole: 'resident',
      actorUserId: resident.residentId,
      notes: notes || 'Reported missing',
      req,
    });

    await notifyAdmin(updated, {
      title: '🚨 Package Reported Missing',
      message: `${updated.residentName} (${updated.block}-${updated.flatNumber}) reported package ${updated.packageId} as missing.`,
      type: 'PACKAGE_MISSING',
      action: 'package_missing',
    });

    emitChannelEvent(`admin:${resident.communityId}`, 'package:status', updated);

    await writeAuditLog({
      communityId: resident.communityId,
      entityType: 'package',
      entityId: String(updated._id),
      action: 'report_missing',
      actor: resident.fullName,
      actorUserId: resident.residentId,
      actorRole: 'resident',
      ...extractRequestContext(req),
      metadata: { packageId: updated.packageId, notes: notes || '' },
    });

    return res.json({ success: true, package: updated });
  } catch (err) {
    console.error('reportMissing error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─── Admin Endpoints ─────────────────────────────────────────────────────── */

/**
 * Admin gets package analytics.
 * GET /api/packages/analytics
 */
const getPackageAnalytics = async (req, res) => {
  try {
    const { communityId, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayCount, weekCount, monthCount, allPackages] = await Promise.all([
      Package.countDocuments({ communityId, receivedAt: { $gte: startOfDay } }),
      Package.countDocuments({ communityId, receivedAt: { $gte: startOfWeek } }),
      Package.countDocuments({ communityId, receivedAt: { $gte: startOfMonth } }),
      Package.find({ communityId }).lean(),
    ]);

    const courierStats = {};
    const categoryStats = {};
    let pendingPickup = 0;
    let pickedUp = 0;
    let returned = 0;
    let incoming = 0;
    let reportedMissing = 0;

    allPackages.forEach((p) => {
      courierStats[p.courierCompany] = (courierStats[p.courierCompany] || 0) + 1;
      categoryStats[p.packageCategory] = (categoryStats[p.packageCategory] || 0) + 1;
      if (p.status === 'pending' || p.status === 'incoming') incoming += 1;
      if (p.status === 'ready') pendingPickup += 1;
      if (p.status === 'picked_up') pickedUp += 1;
      if (p.status === 'returned') returned += 1;
      if (p.reportedMissing) reportedMissing += 1;
    });

    return res.json({
      success: true,
      analytics: {
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
        total: allPackages.length,
        incoming,
        pendingPickup,
        pickedUp,
        returned,
        reportedMissing,
        courierStats,
        categoryStats,
      },
    });
  } catch (err) {
    console.error('getPackageAnalytics error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin lists all packages with filters.
 * GET /api/packages/all?status=&courier=&residentId=&search=&dateFrom=&dateTo=
 */
const listAllPackages = async (req, res) => {
  try {
    const { communityId, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { status, courier, residentId, search, dateFrom, dateTo } = req.query;
    const query = { communityId };

    if (status && status !== 'all' && PACKAGE_STATUSES.includes(status)) query.status = status;
    if (courier && courier !== 'all') query.courierCompany = courier;
    if (residentId) query.residentId = residentId;
    if (search) {
      const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { packageId: regex },
        { trackingNumber: regex },
        { residentName: regex },
        { flatNumber: regex },
        { courierCompany: regex },
      ];
    }
    if (dateFrom || dateTo) {
      query.receivedAt = {};
      if (dateFrom) query.receivedAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const d = new Date(dateTo);
        d.setHours(23, 59, 59, 999);
        query.receivedAt.$lte = d;
      }
    }

    const packages = await Package.find(query).sort({ receivedAt: -1, createdAt: -1 }).limit(500).lean();
    return res.json({ success: true, packages });
  } catch (err) {
    console.error('listAllPackages error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin exports packages as CSV.
 * GET /api/packages/export
 */
const exportPackagesCsv = async (req, res) => {
  try {
    const { communityId, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { status, courier } = req.query;
    const query = { communityId };
    if (status && status !== 'all' && PACKAGE_STATUSES.includes(status)) query.status = status;
    if (courier && courier !== 'all') query.courierCompany = courier;

    const packages = await Package.find(query).sort({ receivedAt: -1 }).lean();

    const rows = packages.map((p) => ({
      packageId: p.packageId,
      courier: COURIER_COMPANY_MAP[p.courierCompany] || p.courierCompany,
      trackingNumber: p.trackingNumber,
      category: p.packageCategory,
      resident: p.residentName,
      flat: `${p.block}-${p.flatNumber}`,
      status: p.status,
      receivedAt: p.receivedAt ? new Date(p.receivedAt).toISOString() : '',
      pickedUpAt: p.pickedUpAt ? new Date(p.pickedUpAt).toISOString() : '',
      remarks: p.securityRemarks,
    }));

    const csv = toCSV(rows, [
      { key: 'packageId', label: 'Package ID' },
      { key: 'courier', label: 'Courier' },
      { key: 'trackingNumber', label: 'Tracking Number' },
      { key: 'category', label: 'Category' },
      { key: 'resident', label: 'Resident' },
      { key: 'flat', label: 'Flat' },
      { key: 'status', label: 'Status' },
      { key: 'receivedAt', label: 'Received At' },
      { key: 'pickedUpAt', label: 'Picked Up At' },
      { key: 'remarks', label: 'Remarks' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=packages.csv');
    return res.send(csv);
  } catch (err) {
    console.error('exportPackagesCsv error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin cancels a package.
 * PUT /api/packages/:id/cancel
 */
const cancelPackage = async (req, res) => {
  try {
    const { communityId, admin, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    const updated = await Package.findOneAndUpdate(
      { _id: id, communityId, status: { $in: ['ready', 'incoming'] } },
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedBy: String(admin._id),
      },
      { new: true, lean: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Package not found or already processed' });

    await logPackageEvent({
      packageDoc: updated,
      event: 'cancelled',
      actor: admin.fullName,
      actorRole: 'admin',
      actorUserId: admin._id,
      notes: 'Cancelled by admin',
      req,
    });

    await notifyResident(updated, {
      title: '📦 Package Cancelled',
      message: `Your package from ${COURIER_COMPANY_MAP[updated.courierCompany] || updated.courierCompany} was cancelled.`,
      type: 'PACKAGE_CANCELLED',
      action: 'package_cancelled',
    });

    emitChannelEvent(`resident:${communityId}`, 'package:status', updated);
    emitChannelEvent(`admin:${communityId}`, 'package:status', updated);

    await writeAuditLog({
      communityId,
      entityType: 'package',
      entityId: String(updated._id),
      action: 'delete',
      actor: admin.fullName,
      actorUserId: admin._id,
      actorRole: 'admin',
      ...extractRequestContext(req),
      metadata: { packageId: updated.packageId },
    });

    return res.json({ success: true, package: updated });
  } catch (err) {
    console.error('cancelPackage error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─── Aging ───────────────────────────────────────────────────────────────── */

/**
 * Auto-aging for pending pickup packages.
 * Updates status incoming -> ready after a configurable threshold.
 * This is meant to be called periodically (e.g. on each security fetch).
 */
async function applyPackageAging(communityId) {
  try {
    const now = new Date();
    // incoming that has been waiting > 12h -> ready (ready for pickup)
    const oldIncoming = await Package.find({
      communityId,
      status: 'incoming',
      receivedAt: { $lte: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
    }).lean();

    for (const pkg of oldIncoming) {
      await Package.findByIdAndUpdate(pkg._id, { status: 'ready', readyAt: new Date() });
      await logPackageEvent({
        packageDoc: pkg,
        event: 'ready',
        actor: 'system',
        actorRole: 'system',
        notes: 'Automatic status change: incoming -> ready (aging)',
      });
    }
  } catch (err) {
    console.error('applyPackageAging error:', err);
  }
}

module.exports = {
  setIO,
  // Security
  searchResidents,
  registerPackage,
  getSecurityPackages,
  verifyPackageOtp,
  scanPackageQr,
  confirmPickup,
  markReturned,
  getPackageHistory,
  // Resident
  getMyPackages,
  viewPackage,
  confirmPickupByResident,
  reportMissing,
  // Admin
  getPackageAnalytics,
  listAllPackages,
  exportPackagesCsv,
  cancelPackage,
  applyPackageAging,
  // exported for socket wiring
  emitTo,
};
