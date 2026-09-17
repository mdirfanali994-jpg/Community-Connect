const mongoose = require('mongoose');

/**
 * AuditLog
 *
 * Unified audit trail for every action across all Smart Community modules:
 * create, update, delete, approve, pickup, vote, read notice, RSVP, etc.
 *
 * Every log is scoped to a communityId and stores the acting user, role,
 * timestamp, IP address and device.
 */
const auditLogSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    // Module/entity this action belongs to
    entityType: { type: String, required: true, index: true }, // package, notice, event, poll, etc.
    entityId: { type: String, default: null, index: true },

    // Action performed
    action: { type: String, required: true, index: true }, // received, viewed, picked_up, voted, read, rsvp, create, update, delete...

    // Actor
    actor: { type: String, default: '' }, // display name
    actorUserId: { type: String, default: null },
    actorRole: { type: String, default: 'system', index: true }, // admin, resident, security, system

    // Context
    ip: { type: String, default: '' },
    device: { type: String, default: '' },
    userAgent: { type: String, default: '' },

    // Flexible payload
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

// Indexes for performance
auditLogSchema.index({ communityId: 1, entityType: 1, createdAt: -1 });
auditLogSchema.index({ communityId: 1, actorRole: 1, createdAt: -1 });
auditLogSchema.index({ communityId: 1, entityId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
