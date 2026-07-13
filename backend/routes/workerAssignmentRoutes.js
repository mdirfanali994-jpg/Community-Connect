const express = require('express');
const router = express.Router();

const {
  assignWorkerToComplaint,
  listWorkersAssignedComplaints
} = require('../controllers/workerAssignmentController');

// Admin assigns worker to a complaint
router.put('/api/complaints/:id/assign', assignWorkerToComplaint);

// Worker fetch assigned complaints (society-scoped)
router.get('/api/workers/:workerId/complaints', listWorkersAssignedComplaints);

module.exports = router;
