const mongoose = require('mongoose');

/**
 * FinanceCategory
 *
 * Stores community-level finance categories (reusable by future modules).
 * Seeded automatically with defaults from constants/financeCategories.js
 * when a community's finance config is first created.
 */
const financeCategorySchema = new mongoose.Schema(
  {
    // Multi-tenancy scope: every category belongs to one community.
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    // Stable machine key (water, electricity, security, ...)
    key: { type: String, required: true, index: true },

    // Human readable label
    label: { type: String, required: true },

    // Suggested icon name (UI hint)
    icon: { type: String, default: 'MoreHorizontal' },

    // Audit trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityUser',
      default: null,
    },
  },
  { versionKey: false, timestamps: true }
);

// Prevent duplicate categories per community
financeCategorySchema.index({ communityId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('FinanceCategory', financeCategorySchema);

