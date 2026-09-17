const mongoose = require('mongoose');

/**
 * NoticeRead
 *
 * Tracks read receipts for notices per resident.
 * Used for unread badges and read-receipt analytics.
 */
const noticeReadSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    noticeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notice',
      required: true,
      index: true,
    },

    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityUser',
      required: true,
      index: true,
    },

    readAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);

// One read record per resident per notice
noticeReadSchema.index({ communityId: 1, noticeId: 1, residentId: 1 }, { unique: true });
noticeReadSchema.index({ communityId: 1, residentId: 1 });

module.exports = mongoose.model('NoticeRead', noticeReadSchema);
