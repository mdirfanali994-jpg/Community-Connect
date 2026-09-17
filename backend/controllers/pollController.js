const Poll = require('../models/Poll');
const PollVote = require('../models/PollVote');
const { CHOICE_MODES } = require('../constants/pollConstants');
const {
  setIO,
  emitTo,
  createAndEmitNotification,
  emitChannelEvent,
  writeAuditLog,
  extractRequestContext,
  deriveAdmin,
  deriveResident,
  isValidObjectId,
} = require('../services/communityService');

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function isPollClosed(poll) {
  if (poll.closed) return true;
  if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) return true;
  return false;
}

/**
 * Compute live percentages and close status for a poll.
 */
async function buildPollResult(poll, residentId = null) {
  const votes = await PollVote.find({ pollId: poll._id }).lean();
  const totalVotes = votes.length;

  const counts = poll.options.map((_, i) => votes.filter((v) => v.selectedIndexes.includes(i)).length);
  const totalSelections = counts.reduce((a, b) => a + b, 0) || 1;

  const results = poll.options.map((opt, i) => ({
    text: opt.text,
    count: counts[i],
    percentage: Math.round((counts[i] / totalSelections) * 100),
  }));

  const closed = isPollClosed(poll);

  let myVote = null;
  if (residentId) {
    const v = await PollVote.findOne({ pollId: poll._id, residentId }).lean();
    if (v) myVote = v.selectedIndexes;
  }

  return {
    ...poll,
    closed,
    totalVotes,
    results,
    myVote,
  };
}

/* ─── Admin Endpoints ─────────────────────────────────────────────────────── */

/**
 * Admin creates a poll.
 * POST /api/polls
 * Body: { title, description, options: string[], choiceMode, anonymous, hideResultsUntilEnd, expiresAt }
 */
const createPoll = async (req, res) => {
  try {
    const { communityId, admin, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { title, description, options, choiceMode, anonymous, hideResultsUntilEnd, expiresAt } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 options are required' });
    }
    if (choiceMode && !CHOICE_MODES.includes(choiceMode)) {
      return res.status(400).json({ success: false, message: 'choiceMode must be single or multiple' });
    }

    const normalizedOptions = options.map((o) => ({ text: String(o).trim() })).filter((o) => o.text.length > 0);
    if (normalizedOptions.length < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 non-empty options are required' });
    }

    const poll = await Poll.create({
      communityId,
      title: String(title).trim(),
      description: description || '',
      options: normalizedOptions,
      choiceMode: choiceMode || 'single',
      anonymous: !!anonymous,
      hideResultsUntilEnd: !!hideResultsUntilEnd,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      closed: false,
      createdBy: admin._id,
      updatedBy: admin._id,
    });

    const result = await buildPollResult(poll);

    // Notify residents
    await createAndEmitNotification({
      title: '📊 New Poll',
      message: result.title,
      type: 'POLL_NEW',
      targetRole: 'resident',
      communityId,
      entityType: 'poll',
      entityId: String(result._id),
      action: 'poll_created',
      metadata: { title: result.title, choiceMode: result.choiceMode },
    });

    emitChannelEvent(`resident:${communityId}`, 'poll:new', result);
    emitChannelEvent(`admin:${communityId}`, 'poll:new', result);

    await writeAuditLog({
      communityId,
      entityType: 'poll',
      entityId: String(result._id),
      action: 'create',
      actor: admin.fullName || admin.email,
      actorUserId: admin._id,
      actorRole: 'admin',
      ...extractRequestContext(req),
      metadata: { title: result.title, choiceMode: result.choiceMode },
    });

    return res.status(201).json({ success: true, poll: result });
  } catch (err) {
    console.error('createPoll error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin lists polls.
 * GET /api/polls/admin?status=&search=
 */
const listAdminPolls = async (req, res) => {
  try {
    const { communityId, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { status, search } = req.query;
    const query = { communityId };
    if (search) {
      const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: regex }, { description: regex }];
    }

    let polls = await Poll.find(query).sort({ createdAt: -1 }).limit(500).lean();
    if (status === 'open') polls = polls.filter((p) => !isPollClosed(p));
    else if (status === 'closed') polls = polls.filter((p) => isPollClosed(p));

    const enriched = [];
    for (const p of polls) enriched.push(await buildPollResult(p));

    return res.json({ success: true, polls: enriched });
  } catch (err) {
    console.error('listAdminPolls error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin updates a poll.
 * PUT /api/polls/:id
 */
const updatePoll = async (req, res) => {
  try {
    const { communityId, admin, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid poll id' });

    const existing = await Poll.findOne({ _id: id, communityId }).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Poll not found' });

    const { title, description, options, choiceMode, anonymous, hideResultsUntilEnd, expiresAt } = req.body;
    const update = { updatedBy: admin._id };

    if (title !== undefined) {
      if (!String(title).trim()) return res.status(400).json({ success: false, message: 'Title is required' });
      update.title = String(title).trim();
    }
    if (description !== undefined) update.description = description;
    if (options !== undefined) {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ success: false, message: 'At least 2 options are required' });
      }
      const normalized = options.map((o) => ({ text: String(o).trim() })).filter((o) => o.text.length > 0);
      if (normalized.length < 2) return res.status(400).json({ success: false, message: 'At least 2 non-empty options are required' });
      update.options = normalized;
    }
    if (choiceMode !== undefined) {
      if (!CHOICE_MODES.includes(choiceMode)) return res.status(400).json({ success: false, message: 'Invalid choiceMode' });
      update.choiceMode = choiceMode;
    }
    if (anonymous !== undefined) update.anonymous = !!anonymous;
    if (hideResultsUntilEnd !== undefined) update.hideResultsUntilEnd = !!hideResultsUntilEnd;
    if (expiresAt !== undefined) update.expiresAt = expiresAt ? new Date(expiresAt) : null;

    const updated = await Poll.findOneAndUpdate(
      { _id: id, communityId },
      { $set: update },
      { new: true, lean: true }
    );

    const result = await buildPollResult(updated);

    emitChannelEvent(`resident:${communityId}`, 'poll:updated', result);
    emitChannelEvent(`admin:${communityId}`, 'poll:updated', result);

    await writeAuditLog({
      communityId,
      entityType: 'poll',
      entityId: String(result._id),
      action: 'update',
      actor: admin.fullName || admin.email,
      actorUserId: admin._id,
      actorRole: 'admin',
      ...extractRequestContext(req),
      metadata: { title: result.title },
    });

    return res.json({ success: true, poll: result });
  } catch (err) {
    console.error('updatePoll error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin deletes a poll.
 * DELETE /api/polls/:id
 */
const deletePoll = async (req, res) => {
  try {
    const { communityId, admin, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid poll id' });

    const deleted = await Poll.findOneAndDelete({ _id: id, communityId }).lean();
    if (!deleted) return res.status(404).json({ success: false, message: 'Poll not found' });

    await PollVote.deleteMany({ pollId: id, communityId });

    emitChannelEvent(`resident:${communityId}`, 'poll:deleted', { id });
    emitChannelEvent(`admin:${communityId}`, 'poll:deleted', { id });

    await writeAuditLog({
      communityId,
      entityType: 'poll',
      entityId: id,
      action: 'delete',
      actor: admin.fullName || admin.email,
      actorUserId: admin._id,
      actorRole: 'admin',
      ...extractRequestContext(req),
      metadata: { title: deleted.title },
    });

    return res.json({ success: true, message: 'Poll deleted' });
  } catch (err) {
    console.error('deletePoll error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin manually closes a poll.
 * PUT /api/polls/:id/close
 */
const closePoll = async (req, res) => {
  try {
    const { communityId, admin, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid poll id' });

    const updated = await Poll.findOneAndUpdate(
      { _id: id, communityId },
      { $set: { closed: true, closedAt: new Date(), updatedBy: admin._id } },
      { new: true, lean: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Poll not found' });

    const result = await buildPollResult(updated);

    emitChannelEvent(`resident:${communityId}`, 'poll:updated', result);
    emitChannelEvent(`admin:${communityId}`, 'poll:updated', result);

    await writeAuditLog({
      communityId,
      entityType: 'poll',
      entityId: id,
      action: 'close',
      actor: admin.fullName || admin.email,
      actorUserId: admin._id,
      actorRole: 'admin',
      ...extractRequestContext(req),
      metadata: { title: updated.title },
    });

    return res.json({ success: true, poll: result });
  } catch (err) {
    console.error('closePoll error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─── Resident Endpoints ──────────────────────────────────────────────────── */

/**
 * Resident lists polls.
 * GET /api/polls?userId=xxx&status=open|closed|all
 */
const getResidentPolls = async (req, res) => {
  try {
    const resident = await deriveResident(req.query.userId);
    if (!resident) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const { status } = req.query;
    const query = { communityId: resident.communityId };

    let polls = await Poll.find(query).sort({ createdAt: -1 }).limit(200).lean();
    if (status === 'open') polls = polls.filter((p) => !isPollClosed(p));
    else if (status === 'closed') polls = polls.filter((p) => isPollClosed(p));

    const enriched = [];
    for (const p of polls) {
      const result = await buildPollResult(p, resident.residentId);
      // Hide results if configured and not yet ended, unless user hasn't voted
      if (p.hideResultsUntilEnd && !result.closed && result.myVote === null) {
        result.results = result.results.map((r) => ({ ...r, count: 0, percentage: 0 }));
      }
      enriched.push(result);
    }

    return res.json({ success: true, polls: enriched });
  } catch (err) {
    console.error('getResidentPolls error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident votes on a poll.
 * POST /api/polls/:id/vote
 * Body: { userId, selectedIndexes: number[] }
 */
const votePoll = async (req, res) => {
  try {
    const resident = await deriveResident(req.body.userId);
    if (!resident) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const { id } = req.params;
    const { selectedIndexes } = req.body;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid poll id' });

    const poll = await Poll.findOne({ _id: id, communityId: resident.communityId }).lean();
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });

    if (isPollClosed(poll)) {
      return res.status(403).json({ success: false, message: 'Poll has ended' });
    }

    if (!Array.isArray(selectedIndexes) || selectedIndexes.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one option must be selected' });
    }

    // Validate indexes
    const valid = selectedIndexes.every((i) => Number.isInteger(i) && i >= 0 && i < poll.options.length);
    if (!valid) return res.status(400).json({ success: false, message: 'Invalid option selected' });

    // Single choice: only one selection allowed
    if (poll.choiceMode === 'single' && selectedIndexes.length > 1) {
      return res.status(400).json({ success: false, message: 'This is a single choice poll. Select only one option.' });
    }

    // Check existing vote (one vote per resident)
    const existing = await PollVote.findOne({ pollId: id, residentId: resident.residentId }).lean();
    if (existing) {
      return res.status(403).json({ success: false, message: 'You have already voted on this poll' });
    }

    const vote = await PollVote.create({
      communityId: resident.communityId,
      pollId: id,
      residentId: resident.residentId,
      residentName: resident.fullName,
      block: resident.block,
      flatNumber: resident.flatNumber,
      selectedIndexes,
    });

    emitChannelEvent(`resident:${resident.communityId}`, 'poll:vote', { pollId: id, totalVotes: await PollVote.countDocuments({ pollId: id }) });
    emitChannelEvent(`admin:${resident.communityId}`, 'poll:vote', { pollId: id, residentName: resident.fullName });

    await writeAuditLog({
      communityId: resident.communityId,
      entityType: 'poll',
      entityId: id,
      action: 'vote',
      actor: poll.anonymous ? 'Anonymous' : resident.fullName,
      actorUserId: resident.residentId,
      actorRole: 'resident',
      ...extractRequestContext(req),
      metadata: { title: poll.title, anonymous: poll.anonymous, selectedIndexes },
    });

    // Notify admin of new vote
    await createAndEmitNotification({
      title: 'New Poll Vote',
      message: `${poll.anonymous ? 'A resident' : resident.fullName} voted on ${poll.title}`,
      type: 'POLL_VOTE',
      targetRole: 'admin',
      communityId: resident.communityId,
      entityType: 'poll',
      entityId: id,
      action: 'poll_vote',
      metadata: { title: poll.title, anonymous: poll.anonymous },
    });

    const result = await buildPollResult(poll, resident.residentId);
    return res.status(201).json({ success: true, vote, poll: result });
  } catch (err) {
    console.error('votePoll error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin gets poll analytics.
 * GET /api/polls/analytics
 */
const getPollAnalytics = async (req, res) => {
  try {
    const { communityId, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const polls = await Poll.find({ communityId }).lean();
    const votes = await PollVote.find({ communityId }).lean();

    const totalPolls = polls.length;
    const open = polls.filter((p) => !isPollClosed(p)).length;
    const closed = polls.filter((p) => isPollClosed(p)).length;
    const totalVotes = votes.length;

    return res.json({
      success: true,
      analytics: {
        totalPolls,
        open,
        closed,
        totalVotes,
      },
    });
  } catch (err) {
    console.error('getPollAnalytics error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  setIO,
  // Admin
  createPoll,
  listAdminPolls,
  updatePoll,
  deletePoll,
  closePoll,
  getPollAnalytics,
  // Resident
  getResidentPolls,
  votePoll,
  // helpers
  isPollClosed,
  buildPollResult,
  emitTo,
};
