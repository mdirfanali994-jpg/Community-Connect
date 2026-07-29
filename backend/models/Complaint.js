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

    // Multi-tenancy scope
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: false, index: true },

    // Worker details for resident view
    workerDetails: {
      workerId: { type: String, default: null },
      name: { type: String, default: '' },
      photo: { type: String, default: '' },
      phone: { type: String, default: '' },
      skills: { type: [String], default: [] }
    },

    // Completion metadata
    completion: {
      photos: { type: [String], default: [] },
      video: { type: String, default: null },
      notes: { type: String, default: '' },
      completedAt: { type: String, default: null },
      completedBy: { type: String, default: null }
    },

    // Resident confirmation
    residentConfirmation: {
      status: { type: String, default: null, enum: [null, 'approved', 'rework'] },
      confirmedAt: { type: String, default: null },
      review: { type: String, default: '' }
    },

    // Tracking timeline (stages with timestamps)
    timeline: {
      submitted: { type: String, default: null },
      verified: { type: String, default: null },
      assigned: { type: String, default: null },
      accepted: { type: String, default: null },
      started: { type: String, default: null },
      inProgress: { type: String, default: null },
      completed: { type: String, default: null },
      approved: { type: String, default: null },
      reopened: { type: String, default: null }
    },

    // Category for complaint type
    category: { type: String, default: '' },
    priority: { type: String, default: 'Medium', enum: ['Low', 'Medium', 'High', 'Urgent'] },

    date: { type: String, required: true },

    // Required by security spec (keep optional for backward compatibility)
    createdAt: { type: Date, default: () => new Date(), index: true }
  },

  {
    versionKey: false
  }
);

module.exports = mongoose.model('Complaint', complaintSchema);

