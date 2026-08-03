const mongoose = require('mongoose');

/**
 * MaintenanceBill
 *
 * One bill per resident per month.
 * Status lifecycle: pending -> paid | overdue
 * Overdue is derived when dueDate < today and not paid.
 */
const maintenanceBillSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    // Resident (CommunityUser) this bill belongs to
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityUser',
      required: true,
      index: true,
    },

    // Snapshot of resident identity (immutable at bill creation)
    residentName: { type: String, default: '' },
    block: { type: String, default: '' },
    flatNumber: { type: String, default: '' },

    // Billing period (e.g. '2025-06')
    month: { type: String, required: true, index: true },

    amount: { type: Number, required: true, min: 0 },

    // Optional fee applied when overdue
    lateFee: { type: Number, default: 0, min: 0 },
    totalDue: { type: Number, required: true, min: 0 },

    dueDate: { type: Date, required: true, index: true },

    status: {
      type: String,
      required: true,
      enum: ['pending', 'paid', 'overdue'],
      default: 'pending',
      index: true,
    },

    // Unique receipt number (set on payment)
    receiptNumber: { type: String, default: null, index: true },

    // Reference to payment once settled
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenancePayment',
      default: null,
    },

    paidAt: { type: Date, default: null },
    paymentMethod: { type: String, default: null },
    paymentRef: { type: String, default: null },

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

// Idempotency + scoping indexes
maintenanceBillSchema.index({ communityId: 1, residentId: 1, month: 1 }, { unique: true });
maintenanceBillSchema.index({ communityId: 1, month: 1, status: 1 });
maintenanceBillSchema.index({ communityId: 1, residentId: 1, status: 1 });

module.exports = mongoose.model('MaintenanceBill', maintenanceBillSchema);

