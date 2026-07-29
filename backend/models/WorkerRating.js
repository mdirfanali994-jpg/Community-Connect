const mongoose = require('mongoose');

const workerRatingSchema = new mongoose.Schema(
  {
    workerId: { type: String, required: true, index: true },
    complaintId: { type: String, required: true, index: true, unique: true },
    residentId: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, default: '' },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: false,
      index: true,
    },
  },
  { versionKey: false, timestamps: true }
);

module.exports = mongoose.model('WorkerRating', workerRatingSchema);

