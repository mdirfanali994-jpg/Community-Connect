const mongoose = require('mongoose');

const workerStatusHistorySchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, index: true },
    workerId: { type: String, required: true, index: true },
    status: { type: String, required: true },
    timestamp: { type: Date, default: () => new Date() },
    updatedBy: { type: String, default: 'worker' }, // worker, admin, system
    remarks: { type: String, default: '' },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: false,
      index: true,
    },
  },
  { versionKey: false, timestamps: true }
);

module.exports = mongoose.model('WorkerStatusHistory', workerStatusHistorySchema);

