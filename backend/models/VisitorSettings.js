const mongoose = require('mongoose');

/**
 * VisitorSettings
 *
 * Per-community visitor policy configuration.
 * - defaultApprovalRequired: whether new visitors need resident approval before entering
 * - maxVisitorsPerDay: optional cap on daily visitors per resident
 * - blacklistedVisitors: phone numbers or names blocked from visiting
 * - emergencyOverride: toggle to bypass all visitor restrictions
 */
const visitorSettingsSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      unique: true,
      index: true,
    },

    defaultApprovalRequired: { type: Boolean, default: true },

    // 0 = unlimited
    maxVisitorsPerDay: { type: Number, default: 0, min: 0 },

    // Blacklisted visitor phone numbers or names
    blacklistedVisitors: [
      {
        identifier: { type: String, required: true }, // phone number or name
        type: { type: String, enum: ['phone', 'name'], default: 'phone' },
        reason: { type: String, default: '' },
        addedBy: { type: String, default: null },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    // Emergency override — when enabled, bypasses all restrictions
    emergencyOverride: {
      enabled: { type: Boolean, default: false },
      activatedBy: { type: String, default: null },
      activatedAt: { type: Date, default: null },
      reason: { type: String, default: '' },
    },

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

module.exports = mongoose.model('VisitorSettings', visitorSettingsSchema);
