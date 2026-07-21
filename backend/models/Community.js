const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pinCode: { type: String, required: true, trim: true },
    communityType: {
      type: String,
      required: true,
      enum: ['Apartment', 'Gated Community', 'Villa Community', 'Residential Colony'],
    },
    gatedCommunity: { type: Boolean, default: false },
    logoFilename: { type: String, default: null },
    // Per-society map image
    mapFilename: { type: String, default: null },
  },
  { versionKey: false, timestamps: true }
);

module.exports = mongoose.model('Community', communitySchema);
