const Notification = require('../models/Notification');

const createComplaintSubmittedNotification = async ({ complaint }) => {
  // Role-based notification approach: one notification document scoped to targetRole.
  // This avoids duplicating one doc per admin.
  const created = await Notification.create({
    title: 'New complaint submitted',
    message: complaint?.text ? complaint.text : 'Complaint submitted',
    type: 'COMPLAINT_SUBMITTED',
    targetRole: 'admin',

    complaintId: complaint?.id ?? null,

    residentName: complaint?.userName ?? '',
    flatNumber: complaint?.flatNumber ?? '',
    complaintText: complaint?.text ?? '',
    complaintStatus: complaint?.status ?? '',

    communityId: complaint?.communityId ?? null,

    read: false,
    createdAt: new Date()
  });

  return created.toObject();
};

/**
 * Generic role-based notification creator.
 * Used by finance and future modules.
 */
const createRoleNotification = async ({
  type,
  targetRole,
  title,
  message,
  communityId,
  entityType = null,
  entityId = null,
  action = null,
  metadata = {},
  recipientId = null,
  recipientName = '',
  residentName = '',
  flatNumber = '',
}) => {
  const created = await Notification.create({
    title,
    message,
    type,
    targetRole,
    communityId,
    entityType,
    entityId,
    action,
    metadata,
    recipientId,
    recipientName,
    residentName,
    flatNumber,
    read: false,
    createdAt: new Date(),
  });

  return created.toObject();
};

/**
 * Notify a single resident about their maintenance bill/payment.
 * targetRole = 'resident' with recipientId set for per-resident scoping.
 */
const createFinanceNotification = async ({
  title,
  message,
  communityId,
  residentId,
  residentName,
  flatNumber,
  entityType,
  entityId,
  action,
  metadata = {},
}) => {
  return createRoleNotification({
    type: 'FINANCE',
    targetRole: 'resident',
    title,
    message,
    communityId,
    entityType,
    entityId,
    action,
    metadata,
    recipientId: residentId,
    recipientName: residentName,
    residentName,
    flatNumber,
  });
};

/**
 * Notify admins of a community about finance events (new expense etc.)
 */
const createAdminFinanceNotification = async ({
  title,
  message,
  communityId,
  entityType,
  entityId,
  action,
  metadata = {},
}) => {
  return createRoleNotification({
    type: 'FINANCE',
    targetRole: 'admin',
    title,
    message,
    communityId,
    entityType,
    entityId,
    action,
    metadata,
  });
};

module.exports = {
  createComplaintSubmittedNotification,
  createRoleNotification,
  createFinanceNotification,
  createAdminFinanceNotification,
};

