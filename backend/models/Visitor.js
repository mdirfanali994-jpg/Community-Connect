const mongoose = require('mongoose');

/**
 * Visitor
 *
 * Unified model for both guest visitors and delivery executives.
 * All visitor types are stored in the same document using the `visitorType` field.
 * This means future features (package management, vehicle tracking, facial recognition)
 * can extend this model without architectural changes.
 *
 * Visitor Flow:
 *   scheduled → arrived → entered → exited → completed
 *   scheduled → cancelled
 *   scheduled → arrived → rejected
 *   scheduled → arrived → (resident approval) → entered → exited → completed
 */
const visitorSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    // Resident who invited / is expecting this visitor
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityUser',
      required: true,
      index: true,
    },
    residentName: { type: String, default: '' },
    block: { type: String, default: '' },
    flatNumber: { type: String, default: '' },

    // Visitor information
    visitorName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true, index: true },

    // Visitor type (guest, relative, amazon, flipkart, swiggy, etc.)
    visitorType: {
      type: String,
      required: true,
      index: true,
    },

    vehicleNumber: { type: String, default: '' },
    purpose: { type: String, default: '' },

    // Scheduled visit
    expectedDate: { type: Date, required: true, index: true },
    expectedTime: { type: String, default: '' },
    duration: { type: String, default: '' }, // e.g. "2 hours"
    notes: { type: String, default: '' },

    // Generated pass
    visitorId: { type: String, required: true, unique: true, index: true }, // e.g. V-202506-XXXX
    qrPayload: { type: String, default: null }, // JSON payload: { visitorId, communityId, expiresAt }
    otp: { type: String, default: null }, // 6-digit OTP
    otpExpiresAt: { type: Date, default: null }, // OTP expires after 10 minutes
    otpUsed: { type: Boolean, default: false },

    // Status lifecycle
    status: {
      type: String,
      required: true,
      enum: ['scheduled', 'arrived', 'entered', 'exited', 'completed', 'cancelled', 'rejected'],
      default: 'scheduled',
      index: true,
    },

    // Approval flow (if enabled)
    approvalRequired: { type: Boolean, default: true },
    approvalStatus: {
      type: String,
      enum: [null, 'pending', 'approved', 'rejected'],
      default: 'pending',
    },
    residentApprovedAt: { type: Date, default: null },
    residentApprovedBy: { type: String, default: null },

    // Timeline (for quick access — full timeline in VisitorLog)
    arrivedAt: { type: Date, default: null },
    enteredAt: { type: Date, default: null },
    exitedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: null },
    cancelledReason: { type: String, default: '' },

    // Security who handled this visitor
    securityVerifiedBy: { type: String, default: null },
    securityVerifiedAt: { type: Date, default: null },

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
visitorSchema.index({ communityId: 1, status: 1, expectedDate: 1 });
visitorSchema.index({ communityId: 1, residentId: 1, status: 1 });
visitorSchema.index({ communityId: 1, visitorType: 1, expectedDate: 1 });
visitorSchema.index({ otp: 1 }, { sparse: true });
visitorSchema.index({ qrPayload: 1 }, { sparse: true });

module.exports = mongoose.model('Visitor', visitorSchema);
