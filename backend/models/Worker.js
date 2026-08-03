const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema(
  {
    societyId: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },

    // Profession (backward compatible, required)
    profession: { type: String, required: true },

    // Worker role (for role-based dashboards, e.g. security_guard, cleaner, electrician)
    // Defaults to profession for backward compatibility.
    role: { type: String, default: null, index: true },

    // Enhanced worker profile fields
    skills: { type: [String], default: [] }, // Electrician, Plumber, Carpenter, etc.
    experience: { type: String, default: '' }, // Years of experience
    aadhaarNumber: { type: String, default: '' },
    profilePhoto: { type: String, default: null },
    address: { type: String, default: '' },

    // Status management
    status: { type: String, default: 'Pending', enum: ['Pending', 'Approved', 'Rejected', 'Suspended'] },
    isActive: { type: Boolean, default: true },

    // Worker availability
    availability: { type: String, default: 'Available', enum: ['Available', 'Busy', 'Offline'] },

    // Rating system
    rating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },

    // Required by spec: array of assigned complaint IDs (optional)
    assignedComplaints: { type: [String], default: [] },

    // For UI/later tracking
    blockAssigned: { type: String, default: null },

    // Login uses existing /api/login in-memory model; until extended auth,
    // we keep password stored here for potential future usage.
    password: { type: String, required: true },

    // Multi-tenancy scope: required by spec
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: false, index: true },

    // Rejection reason
    rejectionReason: { type: String, default: '' },

    createdAt: { type: Date, default: () => new Date(), index: true }
  },
  { versionKey: false, timestamps: true }
);

module.exports = mongoose.model('Worker', workerSchema);

