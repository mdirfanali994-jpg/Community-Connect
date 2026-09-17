const mongoose = require('mongoose');

/**
 * EventRSVP
 *
 * Tracks one resident's RSVP for an event.
 * status: going | maybe | not_going
 *
 * One RSVP per resident per event (unique combo).
 */
const eventRSVPSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },

    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityUser',
      required: true,
      index: true,
    },

    // Snapshot of resident identity
    residentName: { type: String, default: '' },
    block: { type: String, default: '' },
    flatNumber: { type: String, default: '' },

    status: {
      type: String,
      enum: ['going', 'maybe', 'not_going'],
      required: true,
      index: true,
    },

    // QR check-in
    checkInCode: { type: String, default: null },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },

    createdAt: { type: Date, default: () => new Date(), index: true },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);

// One active RSVP per resident per event
eventRSVPSchema.index({ communityId: 1, eventId: 1, residentId: 1 }, { unique: true });
eventRSVPSchema.index({ communityId: 1, eventId: 1, status: 1 });

module.exports = mongoose.model('EventRSVP', eventRSVPSchema);
