const express = require('express');
const router = express.Router();

const adminResidentRequestsController = require('../controllers/adminResidentRequestsController');
const { requireAdminIdentity } = require('../middleware/adminIdentity');

// Admin lists resident requests for their own community
router.get(
  '/admin/resident-requests',
  requireAdminIdentity,
  adminResidentRequestsController.listResidentRequests
);

// Approve/Reject by requestId
router.put(
  '/admin/resident-requests/:requestId/approve',
  requireAdminIdentity,
  adminResidentRequestsController.approveResidentRequest
);
router.put(
  '/admin/resident-requests/:requestId/reject',
  requireAdminIdentity,
  adminResidentRequestsController.rejectResidentRequest
);

module.exports = router;

