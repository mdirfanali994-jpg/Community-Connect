const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Complaint = require('../models/Complaint');
const CommunityUser = require('../models/CommunityUser');

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(MONGODB_URI, { autoIndex: true });
  console.log('MongoDB connected');

  // Find complaints missing communityId
  const missing = await Complaint.find({
    $or: [{ communityId: { $exists: false } }, { communityId: null }],
  }).limit(5000);

  console.log(`Found ${missing.length} complaints missing communityId`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const c of missing) {
    try {
      const userId = c.userId;

      // CommunityUser _id is an ObjectId; older complaints may store numeric userId.
      // Resolve by email-less numeric id compatibility is not possible reliably, so:
      // - if userId already is an ObjectId (string), use it
      // - if userId is numeric (prototype), skip instead of throwing.
      const userIdAsString = userId !== undefined && userId !== null ? String(userId) : null;

      // Numeric legacy userId cannot be mapped without a migration table.
      if (!userIdAsString || /^\d+$/.test(userIdAsString)) {
        skippedCount++;
        continue;
      }

      const userDoc = await CommunityUser.findOne({ _id: userIdAsString, role: 'resident' }).lean();

      if (!userDoc?.communityId) {
        skippedCount++;
        continue;
      }

      const patch = {
        communityId: userDoc.communityId,
      };

      // Ensure required fields exist for backward compatibility.
      if (!c.userName) patch.userName = userDoc.fullName;
      if (!c.status) patch.status = 'Submitted';
      if (!c.createdAt) patch.createdAt = new Date();

      await Complaint.updateOne({ _id: c._id }, { $set: patch });
      updatedCount++;
    } catch (e) {
      console.error('Backfill error for complaint', c.id, e);
    }
  }

  console.log(`Backfill complete. Updated: ${updatedCount}, Skipped: ${skippedCount}`);
  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

