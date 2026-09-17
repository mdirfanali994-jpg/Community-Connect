const mongoose = require('mongoose');

/**
 * Package
 *
 * Complete package management model supporting:
 *  - Courier company + tracking number (barcode support)
 *  - Package category (small/medium/large/fragile/documents/food/medicine/other)
 *  - Photo upload
 *  - Status lifecycle:
 *      incoming -> ready -> picked_up | returned
 *      incoming -> cancelled
 *  - OTP / QR pickup verification
 *  - Automatic aging (1 day / 3 days / 7 days)
 *  - Delivery timeline (quick access; full timeline in PackageHistory)
 */
const packageSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    // Resident this package belongs to
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityUser',
      required: true,
      index: true,
    },
    residentName: { type: String, default: '' },
    block: { type: String, default: '' },
    flatNumber: { type: String, default: '' },

    // Courier info
    courierCompany: { type: String, required: true, index: true },
    trackingNumber: { type: String, default: '', index: true },
    packageCategory: { type: String, default: 'other', index: true },

    // Photo / remarks
    photo: { type: String, default: null }, // uploaded filename
    securityRemarks: { type: String, default: '' },

    // Generated identifiers
    packageId: { type: String, required: true, unique: true, index: true }, // e.g. PK-XXXXXX
    barcodeData: { type: String, default: null }, // encoded packageId for scan

    // Pickup verification
    otp: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    otpUsed: { type: Boolean, default: false },
    qrPayload: { type: String, default: null }, // JSON { packageId, communityId, expiresAt }

    // Status lifecycle
    status: {
      type: String,
      required: true,
      enum: ['incoming', 'ready', 'picked_up', 'returned', 'cancelled'],
      default: 'incoming',
      index: true,
    },

    // Timeline timestamps
    receivedAt: { type: Date, default: null },
    viewedAt: { type: Date, default: null },
    readyAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    // Expected pickup time (optional)
    expectedPickupTime: { type: Date, default: null },

    // Who handled it
    receivedBy: { type: String, default: '' },
    receivedByWorkerId: { type: String, default: null },
    pickedUpBy: { type: String, default: '' },
    verificationMethod: { type: String, default: null }, // otp | qr | manual
    returnedBy: { type: String, default: '' },
    returnedReason: { type: String, default: '' },

    // Missing report
    reportedMissing: { type: Boolean, default: false },
    missingReportedAt: { type: Date, default: null },
    missingReportedBy: { type: String, default: '' },
    missingNotes: { type: String, default: '' },

    // Security / admin audit
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { versionKey: false, timestamps: true }
);

// Indexes for performance + community isolation
packageSchema.index({ communityId: 1, status: 1, createdAt: -1 });
packageSchema.index({ communityId: 1, residentId: 1, status: 1 });
packageSchema.index({ communityId: 1, courierCompany: 1, createdAt: -1 });
packageSchema.index({ communityId: 1, trackingNumber: 1 });
packageSchema.index({ otp: 1 }, { sparse: true });
packageSchema.index({ qrPayload: 1 }, { sparse: true });

module.exports = mongoose.model('Package', packageSchema);
