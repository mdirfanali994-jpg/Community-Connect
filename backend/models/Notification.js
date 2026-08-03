const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    message: { type: String, default: '' },

    // Reusable fields for future notification types/targets
    type: { type: String, default: 'COMPLAINT_SUBMITTED' },
    targetRole: { type: String, required: true, index: true }, // e.g. 'admin'

    complaintId: { type: String, default: null, index: true },

    // Generic entity linking (used by finance and future modules)
    entityType: { type: String, default: null, index: true }, // e.g. 'maintenance_bill', 'maintenance_expense'
    entityId: { type: String, default: null, index: true },
    action: { type: String, default: null }, // e.g. 'bill_generated', 'expense_added', 'payment_made'
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Recipient (optional) — when a notification is for a specific user
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityUser',
      default: null,
      index: true,
    },
    recipientName: { type: String, default: '' },

    // For UI rendering (keeps Notification model self-contained)
    residentName: { type: String, default: '' },
    flatNumber: { type: String, default: '' },
    complaintText: { type: String, default: '' },
    complaintStatus: { type: String, default: '' },
    createdAt: { type: Date, default: () => new Date(), index: true },

    read: { type: Boolean, default: false, index: true },

    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: false,
      index: true,
    },

    readAt: { type: Date, default: null }
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model('Notification', notificationSchema);

