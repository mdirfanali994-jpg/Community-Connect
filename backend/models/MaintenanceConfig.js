const mongoose = require('mongoose');

/**
 * MaintenanceConfig
 *
 * Per-community configuration for monthly maintenance generation.
 * - monthlyAmount: base amount charged per resident per month
 * - dueDay: day of month the bill becomes due (1-28)
 * - lateFee: optional flat fee applied when a bill is overdue
 * - lateFeeEnabled: whether late fees are applied
 */
const maintenanceConfigSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      unique: true,
      index: true,
    },

    monthlyAmount: { type: Number, required: true, default: 0, min: 0 },

    // Day of month bills are due (1-28 to avoid month-length edge cases)
    dueDay: { type: Number, required: true, default: 10, min: 1, max: 28 },

    lateFee: { type: Number, default: 0, min: 0 },
    lateFeeEnabled: { type: Boolean, default: false },

    // Currency label (informational)
    currency: { type: String, default: '₹' },

    // Optional description shown on receipts
    description: { type: String, default: 'Monthly Society Maintenance' },

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

module.exports = mongoose.model('MaintenanceConfig', maintenanceConfigSchema);

