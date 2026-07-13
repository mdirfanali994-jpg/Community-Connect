const express = require('express');
const router = express.Router();

const onboardingController = require('../controllers/onboardingController');

router.post('/create-community', onboardingController.createCommunity);
router.post('/join-community', onboardingController.joinCommunity);

// Community search for UI dropdown/autocomplete
// GET /api/onboarding/communities?search=abc
router.get('/communities', async (req, res) => {
  try {
    const { search } = req.query;
    if (!search) return res.json({ success: true, communities: [] });

    const regex = new RegExp(String(search), 'i');
    const communities = await (await require('../models/Community')
      .find({ name: regex })
      .select({ name: 1 })
      .limit(10)
      .lean());

    return res.json({ success: true, communities });
  } catch (err) {
    console.error('community search error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
