const mongoose = require('mongoose');

/**
 * VisitorLog
 *
 * Complete timeline of every event in a visitor's lifecycle.
 * Every action (scheduled, arrived, approved, entered, exited, cancelled, rejected)
 * is recorded here with timestamp and actor information.
 *
 * Future: Vehicle entry/exit, package scans, facial recognition events
 * can all be appended as new log entries without schema changes.
 */
const visitorLogSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    // Reference to the visitor
    visitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Visitor',
      required: true,
      index: true,
    },

    // Event type
    event: {
      type: String,
      required: true,
      enum: [
        'scheduled',
        'arrived',
        'resident_approved',
        'resident_rejected',
        'entered',
        'exited',
        'completed',
        'cancelled',
        'rejected',
        'delivery_arrived',
        'delivery_completed',
        'otp_verified',
        'qr_scanned',
        'emergency_override',
      ],
      index: true,
    },

    // Timestamp of the event
    timestamp: { type: Date, default: () => new Date(), index: true },

    // Who performed the action
    actor: { type: String, default: '' }, // name of the person
    actorRole: { type: String, default: '' }, // resident, security, admin, system

    // Optional notes
    notes: { type: String, default: '' },

    // Optional metadata for future extensibility
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { versionKey: false, timestamps: true }
);

visitorLogSchema.index({ communityId: 1, timestamp: -1 });
visitorLogSchema.index({ visitorId: 1, timestamp: 1 });

module.exports = mongoose.model('VisitorLog', visitorLogSchema);
