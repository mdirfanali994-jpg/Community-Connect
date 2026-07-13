const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const Community = require('../models/Community');
const CommunityUser = require('../models/CommunityUser');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const createCommunity = async (req, res) => {
  try {
    const {
      communityName,
      communityAddress,
      city,
      state,
      pinCode,
      communityType,
      gatedCommunity,

      adminFullName,
      adminEmail,
      adminPhone,
      password,
      confirmPassword,
    } = req.body;

    if (!password || password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password confirmation does not match' });
    }

    const required = [
      communityName,
      communityAddress,
      city,
      state,
      pinCode,
      communityType,
      adminFullName,
      adminEmail,
      adminPhone,
    ];

    if (required.some((v) => !v)) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const normalizedEmail = String(adminEmail).toLowerCase().trim();
    const existing = await CommunityUser.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    // IMPORTANT: password MUST be hashed for Mongo onboarding users
    const passwordHash = await bcrypt.hash(password, 10);

    // Community schema enum doesn’t include legacy “Society”. Map it to a valid value.
    const normalizedCommunityType = communityType === 'Society' ? 'Apartment' : communityType;

    const community = await Community.create({
      name: communityName,
      address: communityAddress,
      city,
      state,
      pinCode,
      communityType: normalizedCommunityType,
      gatedCommunity: !!gatedCommunity,
      // Optional logo handled later in wizard sprint; keep backward compatible
      logoFilename: null,
    });


    await CommunityUser.create({
      fullName: adminFullName,
      email: normalizedEmail,
      phone: adminPhone,
      password: passwordHash,
      role: 'admin',
      communityId: community._id,
      status: 'approved',
      isActive: true,
      block: null,
      flatNumber: null,
    });

    return res.json({
      success: true,
      communityId: community._id.toString(),
    });
  } catch (err) {
    console.error('createCommunity error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const joinCommunity = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      communityId,
      block,
      flatNumber,
      password,
      confirmPassword,
    } = req.body;

    if (!password || password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password confirmation does not match' });
    }

    if (!communityId) {
      return res.status(400).json({ success: false, message: 'communityId is required' });
    }

    const required = [fullName, email, phone, block, flatNumber];
    if (required.some((v) => !v)) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await CommunityUser.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    const community = await Community.findById(communityId).lean();
    if (!community) {
      return res.status(404).json({ success: false, message: 'Community not found' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await CommunityUser.create({
      fullName,
      email: normalizedEmail,
      phone,
      password: passwordHash,
      role: 'resident',
      communityId: community._id,
      status: 'pending',
      isActive: true,
      block: String(block).trim(),
      flatNumber: String(flatNumber).trim(),
    });

    return res.json({ success: true, status: 'pending' });
  } catch (err) {
    console.error('joinCommunity error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createCommunity,
  joinCommunity,
};
