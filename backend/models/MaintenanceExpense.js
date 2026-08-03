const mongoose = require('mongoose');

/**
 * MaintenanceExpense
 *
 * Expense entries against the society maintenance fund.
 * Category key references constants/financeCategories.js (reusable).
 */
const maintenanceExpenseSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true },

    // Category key (water, electricity, security, housekeeping, lift, garden, repairs, cleaning, other)
    category: {
      type: String,
      required: true,
      index: true,
    },

    amount: { type: Number, required: true, min: 0 },

    // Optional expense date (defaults to createdAt)
    expenseDate: { type: Date, default: null, index: true },

    description: { type: String, default: '' },

    // Optional vendor/payee name
    vendor: { type: String, default: '' },

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

maintenanceExpenseSchema.index({ communityId: 1, createdAt: -1 });
maintenanceExpenseSchema.index({ communityId: 1, category: 1 });

module.exports = mongoose.model('MaintenanceExpense', maintenanceExpenseSchema);

