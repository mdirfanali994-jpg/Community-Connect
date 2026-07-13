const Worker = require('../models/Worker');

const createWorker = async (req, res) => {
  try {
    const {
      name,
      mobileNumber,
      email,
      profession,
      blockAssigned,
      password,
      societyId
    } = req.body;

    if (!name || !mobileNumber || !email || !profession || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const worker = await Worker.create({
      societyId: societyId || null,
      name,
      mobileNumber,
      email,
      profession,
      blockAssigned: blockAssigned || null,
      password,
      status: 'Approved',
      isActive: true,
      assignedComplaints: []
    });

    res.status(201).json({ success: true, worker });
  } catch (err) {
    console.error('createWorker error:', err);
    // Handle duplicate email gracefully
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const listWorkersForAssignment = async (req, res) => {
  try {
    const { societyId } = req.query;

    const filter = { isActive: true, status: 'Approved' };
    if (societyId) filter.societyId = societyId;

    const workers = await Worker.find(filter).sort({ createdAt: -1 }).lean();

    // Keep response minimal for assignment UI
    const sanitized = workers.map(w => ({
      id: w._id?.toString?.() || w.id,
      _id: w._id,
      societyId: w.societyId,
      name: w.name,
      profession: w.profession,
      blockAssigned: w.blockAssigned || null
    }));

    res.json({ success: true, workers: sanitized });
  } catch (err) {
    console.error('listWorkersForAssignment error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createWorker,
  listWorkersForAssignment
};

