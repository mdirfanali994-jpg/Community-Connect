const express = require('express');
const router = express.Router();

const eventController = require('../controllers/eventController');
const { requireAdminIdentity } = require('../middleware/adminIdentity');
const { upload } = require('../middleware/multer');

/* ─── Admin Endpoints (require admin identity) ────────────────────────────── */

// Create event (banner/image upload)
router.post('/api/events', requireAdminIdentity, upload.fields([{ name: 'banner', maxCount: 1 }, { name: 'image', maxCount: 1 }]), eventController.createEvent);

// List events with stats
router.get('/api/events/admin', requireAdminIdentity, eventController.listAdminEvents);

// Update event
router.put('/api/events/:id', requireAdminIdentity, upload.fields([{ name: 'banner', maxCount: 1 }, { name: 'image', maxCount: 1 }]), eventController.updateEvent);

// Delete event
router.delete('/api/events/:id', requireAdminIdentity, eventController.deleteEvent);

// List RSVP attendees for an event
router.get('/api/events/:id/rsvps', requireAdminIdentity, eventController.listEventRsvps);

// Event analytics
router.get('/api/events/analytics', requireAdminIdentity, eventController.getEventAnalytics);

/* ─── Resident Endpoints (identity derived from userId) ───────────────────── */

// List events (upcoming/past/all)
router.get('/api/events', eventController.getResidentEvents);

// RSVP to an event
router.put('/api/events/:id/rsvp', eventController.rsvpEvent);

// View a single event
router.get('/api/events/:id', eventController.getEvent);

// Get my QR check-in code
router.get('/api/events/:id/checkin', eventController.getEventCheckIn);

/* ─── Check-in ────────────────────────────────────────────────────────────── */

// Validate check-in code (admin/security)
router.post('/api/events/checkin', eventController.validateCheckIn);

module.exports = router;
