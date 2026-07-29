const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  assignWorkerToComplaint,
  listWorkersAssignedComplaints,
  acceptComplaint,
  startComplaint,
  markInProgress,
  completeComplaint,
  residentApproveCompletion,
  residentRequestRework,
  reassignWorker,
  getComplaintTimeline,
  rateWorker
} = require('../controllers/workerAssignmentController');

// Multer config for completion uploads
const completionStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const completionUpload = multer({ storage: completionStorage });

// Admin assigns worker to a complaint
router.put('/api/complaints/:id/assign', assignWorkerToComplaint);

// Worker fetch assigned complaints (society-scoped)
router.get('/api/workers/:workerId/complaints', listWorkersAssignedComplaints);

// Worker: accept assigned work
router.put('/api/complaints/:id/accept', acceptComplaint);

// Worker: start work
router.put('/api/complaints/:id/start', startComplaint);

// Worker: mark in progress
router.put('/api/complaints/:id/in-progress', markInProgress);

// Worker: complete work with proof
router.put(
  '/api/complaints/:id/complete',
  completionUpload.fields([
    { name: 'completionPhotos', maxCount: 5 },
    { name: 'completionVideo', maxCount: 1 }
  ]),
  completeComplaint
);

// Resident: approve completion
router.put('/api/complaints/:id/approve-completion', residentApproveCompletion);

// Resident: request rework
router.put('/api/complaints/:id/request-rework', residentRequestRework);

// Admin: reassign worker
router.put('/api/complaints/:id/reassign', reassignWorker);

// Get complaint timeline
router.get('/api/complaints/:id/timeline', getComplaintTimeline);

// Rate worker after completion
router.post('/api/workers/:workerId/rate', rateWorker);

module.exports = router;
