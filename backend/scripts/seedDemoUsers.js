/**
 * Seed Demo Users Script
 *
 * Creates one demo Community, one Admin, one Resident, and one Worker
 * so the login flow works end-to-end for project submission.
 *
 * Usage: node scripts/seedDemoUsers.js
 *
 * Prerequisites:
 * - MongoDB must be running and accessible via MONGODB_URI in .env
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env from backend root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Community = require('../models/Community');
const CommunityUser = require('../models/CommunityUser');
const Worker = require('../models/Worker');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env. Cannot seed database.');
  process.exit(1);
}

async function seed() {
  console.log('⏳ Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  console.log('✅ MongoDB connected.');

  // Check if demo users already exist
  const existingAdmin = await CommunityUser.findOne({ email: 'admin@test.com' }).lean();
  const existingResident = await CommunityUser.findOne({ email: 'resident@test.com' }).lean();
  const existingWorker = await Worker.findOne({ email: 'worker@test.com' }).lean();

  if (existingAdmin && existingResident && existingWorker) {
    console.log('✅ Demo users already exist. Skipping seed.');
    await mongoose.disconnect();
    return;
  }

  // Find or create a demo community
  let community = await Community.findOne({ name: 'Demo Society' }).lean();
  if (!community) {
    community = await Community.create({
      name: 'Demo Society',
      address: '123 Demo Street',
      city: 'Demo City',
      state: 'Demo State',
      pinCode: '123456',
      communityType: 'Apartment',
      gatedCommunity: true,
    });
    console.log('✅ Created demo community:', community.name);
  } else {
    console.log('✅ Found existing demo community:', community.name);
  }

  // Create admin if not exists
  if (!existingAdmin) {
    const adminHash = await bcrypt.hash('admin123', 10);
    await CommunityUser.create({
      fullName: 'Admin User',
      email: 'admin@test.com',
      phone: '9999999991',
      password: adminHash,
      role: 'admin',
      communityId: community._id,
      status: 'approved',
      isActive: true,
      block: null,
      flatNumber: null,
    });
    console.log('✅ Created demo Admin: admin@test.com / admin123');
  } else {
    console.log('✅ Demo Admin already exists.');
  }

  // Create resident if not exists
  if (!existingResident) {
    const residentHash = await bcrypt.hash('resident123', 10);
    await CommunityUser.create({
      fullName: 'John Doe',
      email: 'resident@test.com',
      phone: '9999999992',
      password: residentHash,
      role: 'resident',
      communityId: community._id,
      status: 'approved',
      isActive: true,
      block: 'A',
      flatNumber: '101',
    });
    console.log('✅ Created demo Resident: resident@test.com / resident123');
  } else {
    console.log('✅ Demo Resident already exists.');
  }

  // Create worker if not exists
  if (!existingWorker) {
    const workerHash = await bcrypt.hash('worker123', 10);
    await Worker.create({
      name: 'Bob Builder',
      email: 'worker@test.com',
      mobileNumber: '9999999993',
      password: workerHash,
      profession: 'Electrician',
      skills: ['Electrician', 'Plumber'],
      experience: '5 years',
      communityId: community._id,
      societyId: String(community._id),
      status: 'Approved',
      isActive: true,
      availability: 'Available',
      assignedComplaints: [],
    });
    console.log('✅ Created demo Worker: worker@test.com / worker123');
  } else {
    console.log('✅ Demo Worker already exists.');
  }

  console.log('\n✅ Seed complete!');
  console.log('📋 Demo Accounts:');
  console.log('   Admin:    admin@test.com / admin123');
  console.log('   Resident: resident@test.com / resident123');
  console.log('   Worker:   worker@test.com / worker123');

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

