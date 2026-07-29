const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    message: { type: String, default: '' },

    // Reusable fields for future notification types/targets
    type: { type: String, default: 'COMPLAINT_SUBMITTED' },
    targetRole: { type: String, required: true, index: true }, // e.g. 'admin'

    complaintId: { type: String, default: null, index: true },

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

