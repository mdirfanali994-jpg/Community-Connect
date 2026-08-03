const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  createWorker,
  registerWorker,
  listWorkersForAssignment,
  listAllWorkers,
  updateWorkerStatus,
  deleteWorker,
  getWorkerById,
  updateWorkerAvailability,
  getWorkerAnalytics
} = require('../controllers/workerController');

// Multer config for worker uploads
const workerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: workerStorage });

// IMPORTANT: Route order matters in Express 5.
// Static paths like /all, /analytics/summary must be defined BEFORE parameterized paths like /:workerId.

// Admin: worker analytics (must come before /:workerId)
router.get('/api/workers/analytics/summary', getWorkerAnalytics);

// Admin: list all workers with status filters
router.get('/api/workers/all', listAllWorkers);

// Admin: list workers for assignment (filtered: approved + active)
router.get('/api/workers', listWorkersForAssignment);

// Public: worker self-registration
router.post('/api/workers/register', upload.single('profilePhoto'), registerWorker);

// Admin: create worker
router.post('/api/workers', createWorker);

// Get single worker by ID (must come after static paths)
router.get('/api/workers/:workerId', getWorkerById);

// Get worker role info (for role-based dashboards)
const { getWorkerRole } = require('../controllers/visitorController');
router.get('/api/workers/:workerId/role', getWorkerRole);

// Admin: update worker status (approve/reject/suspend/activate)
router.put('/api/workers/:workerId/status', updateWorkerStatus);

// Worker: update availability
router.put('/api/workers/:workerId/availability', updateWorkerAvailability);

// Admin: delete worker
router.delete('/api/workers/:workerId', deleteWorker);

module.exports = router;

