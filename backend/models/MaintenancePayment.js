const mongoose = require('mongoose');

/**
 * MaintenancePayment
 *
 * Payment records for settled maintenance bills.
 * Payment gateway integration is intentionally NOT included.
 * Supported methods (for now): Cash, UPI, Bank Transfer, Manual Payment.
 * Only a reference number provided by the resident/admin is stored.
 */
const maintenancePaymentSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    // Resident who owns the bill
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityUser',
      required: true,
      index: true,
    },

    residentName: { type: String, default: '' },
    flatNumber: { type: String, default: '' },

    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenanceBill',
      required: true,
      index: true,
    },
    month: { type: String, default: '', index: true },

    amountPaid: { type: Number, required: true, min: 0 },

    paymentMethod: {
      type: String,
      required: true,
      enum: ['cash', 'upi', 'bank_transfer', 'manual'],
    },

    // External reference only (no gateway credentials ever stored)
    referenceNumber: { type: String, default: '' },

    receiptNumber: { type: String, default: null, index: true },

    // Who recorded the payment (resident via self-pay or admin manual entry)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityUser',
      default: null,
    },
    paidByRole: {
      type: String,
      enum: ['resident', 'admin'],
      default: 'resident',
    },
  },
  { versionKey: false, timestamps: true }
);

maintenancePaymentSchema.index({ communityId: 1, residentId: 1, createdAt: -1 });

module.exports = mongoose.model('MaintenancePayment', maintenancePaymentSchema);

