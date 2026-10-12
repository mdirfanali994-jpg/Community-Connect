const express = require('express');
const router = express.Router();
const { requireAdminIdentity } = require('../middleware/adminIdentity');
const {
  getBoundary,
  saveBoundary,
  toggleBoundary,
  deleteBoundary,
} = require('../controllers/boundaryController');

// Scoped boundary read (Admin, Security Worker, Resident)
router.get('/api/boundary', getBoundary);

// Boundary configuration and management (Strictly Admin only)
router.post('/api/boundary', requireAdminIdentity, saveBoundary);
router.put('/api/boundary', requireAdminIdentity, saveBoundary);
router.patch('/api/boundary/toggle', requireAdminIdentity, toggleBoundary);
router.delete('/api/boundary', requireAdminIdentity, deleteBoundary);

module.exports = router;
