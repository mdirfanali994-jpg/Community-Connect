const mongoose = require('mongoose');
const Notice = require('../models/Notice');
const NoticeRead = require('../models/NoticeRead');
const {
  NOTICE_CATEGORIES,
  NOTICE_CATEGORY_KEYS,
} = require('../constants/noticeConstants');
const {
  setIO,
  emitTo,
  createAndEmitNotification,
  emitChannelEvent,
  writeAuditLog,
  extractRequestContext,
  deriveAdmin,
  deriveResident,
  toCSV,
  isValidObjectId,
} = require('../services/communityService');

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * Compute effective status for a notice based on scheduling/expiry.
 */
function effectiveStatus(notice) {
  const now = new Date();
  if (notice.scheduledAt && new Date(notice.scheduledAt) > now) return 'scheduled';
  if (notice.expiresAt && new Date(notice.expiresAt) < now) return 'expired';
  return 'active';
}

/**
 * Persist effective status + publishedAt transitions.
 * Returns the notice object.
 */
async function refreshNoticeStatus(notice) {
  const status = effectiveStatus(notice);
  const update = { status };
  if (status === 'active' && !notice.publishedAt) update.publishedAt = new Date();
  const updated = await Notice.findByIdAndUpdate(notice._id, { $set: update }, { new: true, lean: true });
  return updated || notice;
}

/**
 * Apply status refresh to a list of notices.
 */
async function refreshMany(notices) {
  const results = [];
  for (const n of notices) {
    results.push(await refreshNoticeStatus(n));
  }
  return results;
}

/* ─── Admin Endpoints ─────────────────────────────────────────────────────── */

/**
 * Admin creates a notice.
 * POST /api/notices
 * Body: { title, description, category, priority, pinned, scheduledAt, expiresAt }
 * Optional multipart: attachments[] (multiple files)
 */
const createNotice = async (req, res) => {
  try {
    const { communityId, admin, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { title, description, category, priority, pinned, scheduledAt, expiresAt } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (category && !NOTICE_CATEGORY_KEYS.includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid notice category' });
    }
    if (priority && !['normal', 'important', 'emergency'].includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid priority' });
    }

    const attachments = (req.files || []).map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      mimeType: f.mimetype,
      size: f.size,
    }));

    const notice = await Notice.create({
      communityId,
      title: String(title).trim(),
      description: description || '',
      category: category || 'general',
      priority: priority || 'normal',
      pinned: !!pinned,
      attachments,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      status: 'active',
      createdBy: admin._id,
      updatedBy: admin._id,
    });

    const refreshed = await refreshNoticeStatus(notice);

    // Notify residents in real-time (new notice)
    await createAndEmitNotification({
      title: refreshed.priority === 'emergency' ? '🚨 Emergency Notice' : '📢 New Notice',
      message: refreshed.title,
      type: 'NOTICE_NEW',
      targetRole: 'resident',
      communityId,
      entityType: 'notice',
      entityId: String(refreshed._id),
      action: 'notice_created',
      metadata: { category: refreshed.category, priority: refreshed.priority, pinned: refreshed.pinned },
    });

    emitChannelEvent(`resident:${communityId}`, 'notice:new', refreshed);
    emitChannelEvent(`admin:${communityId}`, 'notice:new', refreshed);

    await writeAuditLog({
      communityId,
      entityType: 'notice',
      entityId: String(refreshed._id),
      action: 'create',
      actor: admin.fullName || admin.email,
      actorUserId: admin._id,
      actorRole: 'admin',
      ...extractRequestContext(req),
      metadata: { title: refreshed.title, category: refreshed.category, priority: refreshed.priority },
    });

    return res.status(201).json({ success: true, notice: refreshed });
  } catch (err) {
    console.error('createNotice error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin lists notices (with read stats).
 * GET /api/notices/admin?status=&category=&search=
 */
const listAdminNotices = async (req, res) => {
  try {
    const { communityId, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { status, category, search } = req.query;
    const query = { communityId };

    if (status && ['active', 'scheduled', 'expired'].includes(status)) query.status = status;
    if (category && category !== 'all' && NOTICE_CATEGORY_KEYS.includes(category)) query.category = category;
    if (search) {
      const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: regex }, { description: regex }];
    }

    let notices = await Notice.find(query).sort({ pinned: -1, priority: 1, createdAt: -1 }).limit(500).lean();
    notices = await refreshMany(notices);

    // Batch fetch read counts
    const totalResidents = await mongoose.model('CommunityUser').countDocuments({
      communityId,
      role: 'resident',
      status: 'approved',
    });

    const noticeIds = notices.map((n) => n._id);
    const readAgg = await NoticeRead.aggregate([
      { $match: { communityId, noticeId: { $in: noticeIds } } },
      { $group: { _id: '$noticeId', count: { $sum: 1 } } },
    ]);
    const readMap = {};
    readAgg.forEach((r) => { readMap[String(r._id)] = r.count; });

    const enriched = notices.map((n) => ({
      ...n,
      readCount: readMap[String(n._id)] || 0,
      totalResidents,
      unreadCount: Math.max(0, totalResidents - (readMap[String(n._id)] || 0)),
    }));

    return res.json({ success: true, notices: enriched });
  } catch (err) {
    console.error('listAdminNotices error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin updates a notice.
 * PUT /api/notices/:id
 */
const updateNotice = async (req, res) => {
  try {
    const { communityId, admin, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid notice id' });

    const existing = await Notice.findOne({ _id: id, communityId }).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Notice not found' });

    const { title, description, category, priority, pinned, scheduledAt, expiresAt } = req.body;
    const update = { updatedBy: admin._id };

    if (title !== undefined) {
      if (!String(title).trim()) return res.status(400).json({ success: false, message: 'Title is required' });
      update.title = String(title).trim();
    }
    if (description !== undefined) update.description = description;
    if (category !== undefined) {
      if (!NOTICE_CATEGORY_KEYS.includes(category)) return res.status(400).json({ success: false, message: 'Invalid category' });
      update.category = category;
    }
    if (priority !== undefined) {
      if (!['normal', 'important', 'emergency'].includes(priority)) return res.status(400).json({ success: false, message: 'Invalid priority' });
      update.priority = priority;
    }
    if (pinned !== undefined) update.pinned = !!pinned;
    if (scheduledAt !== undefined) update.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (expiresAt !== undefined) update.expiresAt = expiresAt ? new Date(expiresAt) : null;

    // Append new attachments if provided
    if (req.files && req.files.length > 0) {
      const newAttachments = req.files.map((f) => ({
        filename: f.filename,
        originalName: f.originalname,
        mimeType: f.mimetype,
        size: f.size,
      }));
      update.$push = { attachments: { $each: newAttachments } };
    }

    const updated = await Notice.findOneAndUpdate(
      { _id: id, communityId },
      { $set: update },
      { new: true, lean: true }
    );

    const refreshed = await refreshNoticeStatus(updated);

    emitChannelEvent(`resident:${communityId}`, 'notice:updated', refreshed);
    emitChannelEvent(`admin:${communityId}`, 'notice:updated', refreshed);

    await writeAuditLog({
      communityId,
      entityType: 'notice',
      entityId: String(refreshed._id),
      action: 'update',
      actor: admin.fullName || admin.email,
      actorUserId: admin._id,
      actorRole: 'admin',
      ...extractRequestContext(req),
      metadata: { title: refreshed.title },
    });

    return res.json({ success: true, notice: refreshed });
  } catch (err) {
    console.error('updateNotice error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin deletes a notice.
 * DELETE /api/notices/:id
 */
const deleteNotice = async (req, res) => {
  try {
    const { communityId, admin, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid notice id' });

    const deleted = await Notice.findOneAndDelete({ _id: id, communityId }).lean();
    if (!deleted) return res.status(404).json({ success: false, message: 'Notice not found' });

    await NoticeRead.deleteMany({ noticeId: id, communityId });

    emitChannelEvent(`resident:${communityId}`, 'notice:deleted', { id });
    emitChannelEvent(`admin:${communityId}`, 'notice:deleted', { id });

    await writeAuditLog({
      communityId,
      entityType: 'notice',
      entityId: id,
      action: 'delete',
      actor: admin.fullName || admin.email,
      actorUserId: admin._id,
      actorRole: 'admin',
      ...extractRequestContext(req),
      metadata: { title: deleted.title },
    });

    return res.json({ success: true, message: 'Notice deleted' });
  } catch (err) {
    console.error('deleteNotice error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin toggles pin on a notice.
 * PUT /api/notices/:id/pin
 */
const togglePinNotice = async (req, res) => {
  try {
    const { communityId, admin, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    const { pinned } = req.body;

    const updated = await Notice.findOneAndUpdate(
      { _id: id, communityId },
      { $set: { pinned: !!pinned, updatedBy: admin._id } },
      { new: true, lean: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Notice not found' });

    emitChannelEvent(`resident:${communityId}`, 'notice:updated', updated);
    emitChannelEvent(`admin:${communityId}`, 'notice:updated', updated);

    await writeAuditLog({
      communityId,
      entityType: 'notice',
      entityId: id,
      action: pinned ? 'pin' : 'unpin',
      actor: admin.fullName || admin.email,
      actorUserId: admin._id,
      actorRole: 'admin',
      ...extractRequestContext(req),
      metadata: { title: updated.title },
    });

    return res.json({ success: true, notice: updated });
  } catch (err) {
    console.error('togglePinNotice error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin exports notices as CSV.
 * GET /api/notices/export
 */
const exportNoticesCsv = async (req, res) => {
  try {
    const { communityId, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    let notices = await Notice.find({ communityId }).sort({ createdAt: -1 }).lean();
    notices = await refreshMany(notices);

    const rows = notices.map((n) => ({
      title: n.title,
      category: n.category,
      priority: n.priority,
      status: n.status,
      pinned: n.pinned ? 'Yes' : 'No',
      created: n.createdAt ? new Date(n.createdAt).toISOString() : '',
      expires: n.expiresAt ? new Date(n.expiresAt).toISOString() : '',
    }));

    const csv = toCSV(rows, [
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category' },
      { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' },
      { key: 'pinned', label: 'Pinned' },
      { key: 'created', label: 'Created At' },
      { key: 'expires', label: 'Expires At' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=notices.csv');
    return res.send(csv);
  } catch (err) {
    console.error('exportNoticesCsv error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─── Resident Endpoints ──────────────────────────────────────────────────── */

/**
 * Resident lists active notices (with read status).
 * GET /api/notices?userId=xxx&category=&search=
 */
const getResidentNotices = async (req, res) => {
  try {
    const resident = await deriveResident(req.query.userId);
    if (!resident) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const { category, search } = req.query;
    const query = {
      communityId: resident.communityId,
      status: 'active',
    };

    if (category && category !== 'all' && NOTICE_CATEGORY_KEYS.includes(category)) query.category = category;
    if (search) {
      const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: regex }, { description: regex }];
    }

    let notices = await Notice.find(query).sort({ pinned: -1, priority: 1, createdAt: -1 }).lean();
    notices = await refreshMany(notices);

    // Filter out any that became expired after refresh
    const active = notices.filter((n) => n.status === 'active');

    // Read receipts
    const noticeIds = active.map((n) => n._id);
    const readDocs = await NoticeRead.find({
      communityId: resident.communityId,
      noticeId: { $in: noticeIds },
      residentId: resident.residentId,
    }).lean();
    const readSet = new Set(readDocs.map((r) => String(r.noticeId)));

    const enriched = active.map((n) => ({
      ...n,
      isRead: readSet.has(String(n._id)),
    }));

    const unreadCount = active.filter((n) => !readSet.has(String(n._id))).length;

    return res.json({ success: true, notices: enriched, unreadCount });
  } catch (err) {
    console.error('getResidentNotices error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident views a single notice (marks read).
 * GET /api/notices/:id?userId=xxx
 */
const getNotice = async (req, res) => {
  try {
    const resident = await deriveResident(req.query.userId);
    if (!resident) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid notice id' });

    const notice = await Notice.findOne({ _id: id, communityId: resident.communityId }).lean();
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });

    const refreshed = await refreshNoticeStatus(notice);

    // Mark read (idempotent)
    const existing = await NoticeRead.findOne({
      communityId: resident.communityId,
      noticeId: id,
      residentId: resident.residentId,
    }).lean();

    if (!existing) {
      await NoticeRead.create({
        communityId: resident.communityId,
        noticeId: id,
        residentId: resident.residentId,
        readAt: new Date(),
      });
      await writeAuditLog({
        communityId: resident.communityId,
        entityType: 'notice',
        entityId: id,
        action: 'read',
        actor: resident.fullName,
        actorUserId: resident.residentId,
        actorRole: 'resident',
        ...extractRequestContext(req),
        metadata: { title: refreshed.title },
      });
    }

    return res.json({
      success: true,
      notice: { ...refreshed, isRead: true, residentName: resident.fullName },
    });
  } catch (err) {
    console.error('getNotice error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  setIO,
  // Admin
  createNotice,
  listAdminNotices,
  updateNotice,
  deleteNotice,
  togglePinNotice,
  exportNoticesCsv,
  // Resident
  getResidentNotices,
  getNotice,
  // helpers
  refreshNoticeStatus,
  effectiveStatus,
  emitTo,
};
