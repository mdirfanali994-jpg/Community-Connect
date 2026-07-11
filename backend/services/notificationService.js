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

    read: false,
    createdAt: new Date()
  });

  return created.toObject();
};

module.exports = {
  createComplaintSubmittedNotification
};

