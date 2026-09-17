const mongoose = require('mongoose');

/**
 * Poll
 *
 * Community poll with options, single/multiple choice, anonymous mode,
 * expiry, and optional hidden results until expiry.
 */
const pollSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    // Poll options
    options: {
      type: [
        {
          text: { type: String, required: true, trim: true },
        },
      ],
      default: [],
    },

    // Choice mode
    choiceMode: {
      type: String,
      enum: ['single', 'multiple'],
      default: 'single',
    },

    // Anonymous mode (hide voter identities)
    anonymous: { type: Boolean, default: false },

    // Hide results until poll ends
    hideResultsUntilEnd: { type: Boolean, default: false },

    // Expiry
    expiresAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },

    // Admin can manually close
    closed: { type: Boolean, default: false },

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

// Indexes
pollSchema.index({ communityId: 1, closed: 1, expiresAt: 1 });
pollSchema.index({ communityId: 1, createdAt: -1 });

module.exports = mongoose.model('Poll', pollSchema);
