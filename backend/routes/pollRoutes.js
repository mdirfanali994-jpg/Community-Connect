const express = require('express');
const router = express.Router();

const pollController = require('../controllers/pollController');
const { requireAdminIdentity } = require('../middleware/adminIdentity');

/* ─── Admin Endpoints (require admin identity) ────────────────────────────── */

// Create a poll
router.post('/api/polls', requireAdminIdentity, pollController.createPoll);

// List polls with results
router.get('/api/polls/admin', requireAdminIdentity, pollController.listAdminPolls);

// Update a poll
router.put('/api/polls/:id', requireAdminIdentity, pollController.updatePoll);

// Delete a poll
router.delete('/api/polls/:id', requireAdminIdentity, pollController.deletePoll);

// Close a poll
router.put('/api/polls/:id/close', requireAdminIdentity, pollController.closePoll);

// Poll analytics
router.get('/api/polls/analytics', requireAdminIdentity, pollController.getPollAnalytics);

/* ─── Resident Endpoints (identity derived from userId) ───────────────────── */

// List polls with my vote and results
router.get('/api/polls', pollController.getResidentPolls);

// Vote on a poll (one vote per resident)
router.post('/api/polls/:id/vote', pollController.votePoll);

module.exports = router;
