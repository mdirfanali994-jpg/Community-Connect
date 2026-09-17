const express = require('express');
const router = express.Router();

const noticeController = require('../controllers/noticeController');
const { requireAdminIdentity } = require('../middleware/adminIdentity');
const { upload } = require('../middleware/multer');

/* ─── Admin Endpoints (require admin identity) ────────────────────────────── */

// Create a notice (with optional attachments)
router.post('/api/notices', requireAdminIdentity, upload.array('attachments', 5), noticeController.createNotice);

// List all notices with read stats
router.get('/api/notices/admin', requireAdminIdentity, noticeController.listAdminNotices);

// Update a notice
router.put('/api/notices/:id', requireAdminIdentity, upload.array('attachments', 5), noticeController.updateNotice);

// Delete a notice
router.delete('/api/notices/:id', requireAdminIdentity, noticeController.deleteNotice);

// Toggle pin
router.put('/api/notices/:id/pin', requireAdminIdentity, noticeController.togglePinNotice);

// Export CSV
router.get('/api/notices/export', requireAdminIdentity, noticeController.exportNoticesCsv);

/* ─── Resident Endpoints (identity derived from userId) ───────────────────── */

// List active notices with read status
router.get('/api/notices', noticeController.getResidentNotices);

// View a single notice (marks read)
router.get('/api/notices/:id', noticeController.getNotice);

module.exports = router;
