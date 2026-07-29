const express = require('express');
const router = express.Router();
const Community = require('../models/Community');

const onboardingController = require('../controllers/onboardingController');

router.post('/create-community', onboardingController.createCommunity);
router.post('/join-community', onboardingController.joinCommunity);

// Community search for UI dropdown/autocomplete
// GET /api/onboarding/communities?search=abc
router.get('/communities', async (req, res) => {
  try {
    const { search } = req.query;
    if (!search) return res.json({ success: true, communities: [] });

    const mongoose = require('mongoose');
    
    // If MongoDB is not connected, return empty array gracefully
    if (mongoose.connection.readyState !== 1) {
      console.warn('MongoDB not connected - returning empty communities');
      return res.json({ success: true, communities: [] });
    }

    const regex = new RegExp(String(search), 'i');
    const communities = await Community
      .find({ name: regex })
      .select({ name: 1 })
      .limit(10)
      .maxTimeMS(5000)
      .lean();

    return res.json({ success: true, communities });
  } catch (err) {
    console.error('community search error:', err);
    return res.json({ success: true, communities: [] });
  }
});

module.exports = router;
