const mongoose = require('mongoose');

const communityUserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: { type: String, required: true, trim: true },

    // bcrypt hashed password
    password: { type: String, required: true },

    role: {
      type: String,
      required: true,
      enum: ['admin', 'resident', 'worker'],
      index: true,
    },

    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    block: { type: String, default: null },
    flatNumber: { type: String, default: null },

    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },

    isActive: { type: Boolean, default: true },

    // Keep timestamps stored explicitly for UI compatibility if needed
    // (mongoose timestamps also handles createdAt/updatedAt)
  },
  { versionKey: false, timestamps: true }
);

module.exports = mongoose.model('CommunityUser', communityUserSchema);
