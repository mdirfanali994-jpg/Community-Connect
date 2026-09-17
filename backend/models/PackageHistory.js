const mongoose = require('mongoose');

/**
 * PackageHistory
 *
 * Full event log for a package: received, viewed, picked_up, returned, cancelled.
 * Each entry stores the action, actor, role, timestamp, IP and device.
 */
const packageHistorySchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    // Package reference
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Package',
      required: true,
      index: true,
    },
    packageNumber: { type: String, default: '' },

    // Event
    event: {
      type: String,
      required: true,
      enum: ['received', 'viewed', 'ready', 'picked_up', 'returned', 'cancelled', 'reported_missing'],
      index: true,
    },

    // Actor
    actor: { type: String, default: '' },
    actorRole: { type: String, default: 'system', index: true },
    actorUserId: { type: String, default: null },

    // Context
    ip: { type: String, default: '' },
    device: { type: String, default: '' },
    userAgent: { type: String, default: '' },

    notes: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    timestamp: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

packageHistorySchema.index({ communityId: 1, packageId: 1, timestamp: -1 });
packageHistorySchema.index({ event: 1, timestamp: 1 });

module.exports = mongoose.model('PackageHistory', packageHistorySchema);
