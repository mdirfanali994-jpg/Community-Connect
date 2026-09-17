const mongoose = require('mongoose');

/**
 * Notice
 *
 * Notice Board document for the community.
 * Lifecycle: scheduled -> active -> expired
 *   - scheduled: publish timestamp in the future (not yet visible)
 *   - active: visible to residents
 *   - expired: past expiresAt (auto-hidden)
 *
 * Emergency notices always sort to the top via priority.
 */
const noticeSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' }, // rich text / HTML

    // Category: general, emergency, maintenance, electricity, water, security, festival, meeting, event
    category: {
      type: String,
      default: 'general',
      index: true,
    },

    // Priority: normal, important, emergency
    priority: {
      type: String,
      enum: ['normal', 'important', 'emergency'],
      default: 'normal',
      index: true,
    },

    // Pinned notices stay at top
    pinned: { type: Boolean, default: false, index: true },

    // Attachments (images/PDF/DOCX) stored in uploads
    attachments: {
      type: [
        {
          filename: { type: String, default: '' }, // stored filename in uploads
          originalName: { type: String, default: '' },
          mimeType: { type: String, default: '' },
          size: { type: Number, default: 0 },
        },
      ],
      default: [],
    },

    // Scheduling & expiry
    scheduledAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },

    // Status lifecycle
    status: {
      type: String,
      enum: ['scheduled', 'active', 'expired'],
      default: 'active',
      index: true,
    },

    // Audit trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityUser',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityUser',
      default: null,
    },
  },
  { versionKey: false, timestamps: true }
);

// Indexes for performance
noticeSchema.index({ communityId: 1, status: 1, priority: 1, pinned: 1, createdAt: -1 });
noticeSchema.index({ communityId: 1, expiresAt: 1 });
noticeSchema.index({ communityId: 1, scheduledAt: 1 });

module.exports = mongoose.model('Notice', noticeSchema);
