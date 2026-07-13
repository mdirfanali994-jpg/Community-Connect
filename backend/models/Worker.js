const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema(
  {
    societyId: { type: String, default: null },
    name: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    profession: { type: String, required: true },

    // Required by spec; in this sprint we only store (no enforcement)
    status: { type: String, default: 'Pending' }, // Pending/Approved
    isActive: { type: Boolean, default: true },

    // Required by spec: array of assigned complaint IDs (optional)
    assignedComplaints: { type: [String], default: [] },

    // For UI/later tracking
    blockAssigned: { type: String, default: null },

    // Login uses existing /api/login in-memory model; until extended auth,
    // we keep password stored here for potential future usage.
    password: { type: String, required: true },

    createdAt: { type: Date, default: () => new Date(), index: true }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Worker', workerSchema);

