const mongoose = require('mongoose');

/**
 * CommunityBoundary
 *
 * Persists the geographic boundary for each community.
 * Supported modes:
 * - 'polygon': An ordered list of lat/lng vertices forming a closed polygon.
 * - 'radius': A center lat/lng coordinate and a radius in metres.
 *
 * Scoped strictly by communityId with a unique index to prevent duplicate or conflicting records.
 */
const communityBoundarySchema = new mongoose.Schema(
  {
    // Multi-tenancy scope: Exactly one boundary per community
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      unique: true,
      index: true,
    },

    // Boundary mode
    mode: {
      type: String,
      enum: ['polygon', 'radius'],
      required: true,
      default: 'radius',
    },

    // Polygon coordinates: array of { lat, lng } vertices (at least 3 vertices)
    polygon: [
      {
        lat: { type: Number, required: true, min: -90, max: 90 },
        lng: { type: Number, required: true, min: -180, max: 180 },
        _id: false,
      },
    ],

    // Center-radius boundary
    center: {
      lat: { type: Number, min: -90, max: 90, default: null },
      lng: { type: Number, min: -180, max: 180, default: null },
    },
    radius: {
      type: Number, // in metres
      min: 1,
      default: null,
    },

    // Configurable GPS accuracy threshold in metres (default 100m)
    maxAccuracyMeters: {
      type: Number,
      default: 100,
      min: 5,
      max: 1000,
    },

    // Max allowed reading age in seconds (staleness threshold, default 120s)
    maxAgeSeconds: {
      type: Number,
      default: 120,
      min: 10,
      max: 600,
    },

    // Status toggle: whether geofencing enforcement is currently active
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Audit metadata
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
    updatedByName: {
      type: String,
      default: '',
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

// Indexes
communityBoundarySchema.index({ communityId: 1, enabled: 1 });

module.exports = mongoose.model('CommunityBoundary', communityBoundarySchema);
