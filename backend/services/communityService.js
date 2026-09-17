/**
 * communityService
 *
 * Shared backend service for Smart Community modules.
 * Provides unified helpers for:
 *  - Identity derivation (admin / resident / security) -> communityId
 *  - Notifications (create + emit via Socket.IO)
 *  - Audit logging
 *  - Socket emission
 *  - CSV export
 *
 * The socket.io reference is set at runtime from server.js.
 */

const mongoose = require('mongoose');
const CommunityUser = require('../models/CommunityUser');
const Worker = require('../models/Worker');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

let ioRef = null;

const setIO = (io) => { ioRef = io; };

const isValidObjectId = (v) => mongoose.isValidObjectId(v);

/**
 * Emit an event to a role-scoped (and community-scoped) room.
 */
function emitTo(room, event, data) {
  if (ioRef) {
    try {
      ioRef.to(room).emit(event, data);
      console.log(`📤 [socket] emitted ${event} to room ${room}`);
    } catch (err) {
      console.error('emitTo error:', err);
    }
  }
}

/**
 * Emit a notification to a role+community room and persist it.
 */
async function createAndEmitNotification({
  title,
  message,
  type,
  targetRole,
  communityId,
  entityType = null,
  entityId = null,
  action = null,
  metadata = {},
  recipientId = null,
  recipientName = '',
  residentName = '',
  flatNumber = '',
}) {
  try {
    const notif = await Notification.create({
      title: title || '',
      message: message || '',
      type: type || 'COMMUNITY_EVENT',
      targetRole: targetRole || 'resident',
      entityType,
      entityId: entityId ? String(entityId) : null,
      action,
      metadata,
      communityId: communityId || null,
      recipientId: recipientId || null,
      recipientName: recipientName || '',
      residentName: residentName || '',
      flatNumber: flatNumber || '',
      read: false,
      createdAt: new Date(),
    });

    const room = targetRole && communityId ? `${targetRole}:${communityId}` : targetRole || 'resident';
    emitTo(room, 'notification:new', notif.toObject ? notif.toObject() : notif);
    return notif;
  } catch (err) {
    console.error('createAndEmitNotification error:', err);
    return null;
  }
}

/**
 * Emit a generic real-time channel event (non-notification).
 */
async function emitChannelEvent(room, event, data) {
  emitTo(room, event, data);
}

/**
 * Write an audit log (best-effort, never throws).
 */
async function writeAuditLog({
  communityId,
  entityType,
  entityId = null,
  action,
  actor = '',
  actorUserId = null,
  actorRole = 'system',
  ip = '',
  device = '',
  userAgent = '',
  metadata = {},
}) {
  try {
    if (!communityId) return null;
    await AuditLog.create({
      communityId,
      entityType,
      entityId: entityId ? String(entityId) : null,
      action,
      actor: actor || '',
      actorUserId: actorUserId ? String(actorUserId) : null,
      actorRole: actorRole || 'system',
      ip: ip || '',
      device: device || '',
      userAgent: userAgent || '',
      metadata: metadata || {},
      createdAt: new Date(),
    });
    return null;
  } catch (err) {
    console.error('writeAuditLog error:', err);
    return null;
  }
}

function extractRequestContext(req) {
  const ua = req.headers?.['user-agent'] || '';
  let device = 'desktop';
  if (/mobile|android|iphone|ipad/i.test(ua)) device = 'mobile';
  else if (/tablet|ipad/i.test(ua)) device = 'tablet';
  const ip = req.ip || req.headers?.['x-forwarded-for'] || '';
  return { ip, device, userAgent: ua };
}

/**
 * Derive communityId from admin identity headers (validated already by middleware
 * or validated here for safety).
 * Returns { communityId, admin, error }.
 */
async function deriveAdmin(req) {
  const xAdminId = String(req.headers?.['x-admin-id'] || '').trim();
  const xCommunityId = String(req.headers?.['x-community-id'] || '').trim();
  if (!xAdminId || !xCommunityId || !isValidObjectId(xAdminId) || !isValidObjectId(xCommunityId)) {
    return { communityId: null, admin: null, error: 'Missing or invalid admin identity headers' };
  }
  const admin = await CommunityUser.findOne({ _id: xAdminId, role: 'admin', communityId: xCommunityId }).lean();
  if (!admin) {
    return { communityId: null, admin: null, error: 'Invalid admin identity for the provided community' };
  }
  return { communityId: String(admin.communityId), admin, error: null };
}

/**
 * Derive communityId + resident identity strictly from userId (backend lookup).
 */
async function deriveResident(userId) {
  if (!userId || !isValidObjectId(userId)) return null;
  const userDoc = await CommunityUser.findOne({ _id: userId, role: 'resident' }).lean();
  if (!userDoc) return null;
  return {
    residentId: userDoc._id,
    communityId: String(userDoc.communityId),
    fullName: userDoc.fullName || '',
    block: userDoc.block || '',
    flatNumber: userDoc.flatNumber || '',
  };
}

/**
 * Derive communityId + worker identity from workerId (backend lookup).
 * Optionally restrict to a specific role (e.g. security_guard).
 */
async function deriveWorker(workerId, { requireRole = null } = {}) {
  if (!workerId) return { communityId: null, worker: null, error: 'Missing workerId' };
  const worker = await Worker.findOne({ _id: workerId, isActive: true }).lean();
  if (!worker) {
    return { communityId: null, worker: null, error: 'Forbidden: worker not found' };
  }
  const { professionToRole } = require('../constants/workerRoles');
  const role = worker.role || professionToRole(worker.profession);
  if (requireRole && role !== requireRole) {
    return { communityId: null, worker: null, error: `Forbidden: only ${requireRole} can perform this action` };
  }
  return { communityId: String(worker.communityId), worker, error: null };
}

/**
 * Convert an array of objects to CSV string.
 */
function toCSV(rows, columns) {
  if (!rows || rows.length === 0) return '';
  const headers = columns.map((c) => c.label);
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((row) => columns.map((c) => escape(row[c.key])).join(','));
  return [headers.join(','), ...body].join('\n');
}

module.exports = {
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
};
