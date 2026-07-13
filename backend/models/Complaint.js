const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: Number, required: true, index: true },
    userName: { type: String, required: true },
    flatNumber: { type: String, required: true },
    text: { type: String, default: '' },
    image: { type: String, default: null },
    voice: { type: String, default: null },
    location: {
      type: {
        lat: { type: Number, required: false },
        lng: { type: Number, required: false }
      },
      default: null
    },
    status: { type: String, required: true },
    assignedWorker: { type: String, default: null },
    expectedCompletionDate: { type: String, default: null },
    adminRemarks: { type: String, default: '' },

    // Optional society scoping (backward compatible)
    societyId: { type: String, default: null },

    // Optional assignment metadata (backward compatible)
    assignment: {
      workerId: { type: String, default: null, index: true },
      assignedBy: { type: String, default: null },
      assignedAt: { type: String, default: null },
      assignmentStatus: { type: String, default: null }
    },

    // Backward compatible field used by existing UI/workflows
    assignedWorker: { type: String, default: null },

    date: { type: String, required: true }
  },

  {
    versionKey: false
  }
);

module.exports = mongoose.model('Complaint', complaintSchema);

