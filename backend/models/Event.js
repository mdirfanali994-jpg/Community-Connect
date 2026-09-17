const mongoose = require('mongoose');

/**
 * Event
 *
 * Community event: society meetings, festivals, sports, blood donation,
 * maintenance meetings, cleaning drives, cultural programs, etc.
 *
 * Lifecycle: draft -> upcoming -> ongoing -> completed -> cancelled
 */
const eventSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    // event category
    category: {
      type: String,
      default: 'other',
      index: true,
    },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    // Banner image stored in uploads
    banner: { type: String, default: null },
    image: { type: String, default: null },

    // When & where
    date: { type: Date, required: true, index: true },
    time: { type: String, default: '' },
    venue: { type: String, default: '' },
    organizer: { type: String, default: '' },

    // Capacity (0/unspecified = unlimited)
    maxParticipants: { type: Number, default: 0 },

    // Status lifecycle
    status: {
      type: String,
      enum: ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
      index: true,
    },

    // Reminder sent flag
    reminderSent: { type: Boolean, default: false },

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
eventSchema.index({ communityId: 1, status: 1, date: 1 });
eventSchema.index({ communityId: 1, category: 1, date: 1 });

module.exports = mongoose.model('Event', eventSchema);
