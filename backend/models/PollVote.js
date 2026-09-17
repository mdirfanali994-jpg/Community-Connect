const mongoose = require('mongoose');

/**
 * PollVote
 *
 * Tracks one resident's vote on a poll.
 * Supports single and multiple choice via selectedOptionIndexes.
 *
 * One vote per resident per poll (unique combo).
 */
const pollVoteSchema = new mongoose.Schema(
  {
    // Multi-tenancy scope
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },

    pollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Poll',
      required: true,
      index: true,
    },

    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityUser',
      required: true,
      index: true,
    },

    // Snapshot
    residentName: { type: String, default: '' },
    block: { type: String, default: '' },
    flatNumber: { type: String, default: '' },

    // Selected option indexes (0-based)
    selectedIndexes: { type: [Number], default: [] },

    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

// One vote per resident per poll
pollVoteSchema.index({ communityId: 1, pollId: 1, residentId: 1 }, { unique: true });
pollVoteSchema.index({ communityId: 1, pollId: 1 });

module.exports = mongoose.model('PollVote', pollVoteSchema);
