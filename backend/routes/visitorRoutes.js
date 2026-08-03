const express = require('express');
const router = express.Router();

const {
  // Resident
  createVisitor,
  getMyVisitors,
  getUpcomingVisitors,
  cancelVisitor,
  getVisitorPass,
  approveVisitorArrival,
  // Security
  getTodayVisitors,
  searchVisitor,
  markArrived,
  markEntered,
  markExited,
  markRejected,
  getVisitorTimeline,
  // QR Scanner
  scanVisitorQR,
  allowEntryAfterScan,
  markExitAfterScan,
  rejectEntryAfterScan,
  // Admin
  getVisitorAnalytics,
  listAllVisitors,
  getVisitorSettings,
  updateVisitorSettings,
  blacklistVisitor,
  emergencyOverride,
} = require('../controllers/visitorController');

const { requireAdminIdentity } = require('../middleware/adminIdentity');

// ─── Resident Endpoints ───────────────────────────────────────────────────────

// Create a visitor invitation
router.post('/api/visitors', createVisitor);

// Resident lists their visitors
router.get('/api/visitors/my', getMyVisitors);

// Resident gets upcoming visitors
router.get('/api/visitors/upcoming', getUpcomingVisitors);

// Resident gets visitor pass (QR/OTP)
router.get('/api/visitors/:id/pass', getVisitorPass);

// Resident cancels a visitor
router.put('/api/visitors/:id/cancel', cancelVisitor);

// Resident approves visitor arrival
router.put('/api/visitors/:id/approve', approveVisitorArrival);

// ─── Security Endpoints ───────────────────────────────────────────────────────

// Security gets today's visitors
router.get('/api/visitors/today', getTodayVisitors);

// Security searches visitors
router.get('/api/visitors/search', searchVisitor);

// Security marks visitor as arrived
router.put('/api/visitors/:id/arrived', markArrived);

// Security marks visitor as entered (with optional OTP verification)
router.put('/api/visitors/:id/enter', markEntered);

// Security marks visitor as exited
router.put('/api/visitors/:id/exit', markExited);

// Security rejects a visitor
router.put('/api/visitors/:id/reject', markRejected);

// Get visitor timeline
router.get('/api/visitors/:id/timeline', getVisitorTimeline);

// ─── QR Scanner Endpoints ─────────────────────────────────────────────────────

// Scan a visitor QR code (validate and return details)
router.post('/api/visitors/scan', scanVisitorQR);

// Allow entry after QR scan confirmation
router.put('/api/visitors/:id/allow-entry', allowEntryAfterScan);

// Mark exit after QR scan
router.put('/api/visitors/:id/mark-exit', markExitAfterScan);

// Reject entry after QR scan
router.put('/api/visitors/:id/reject-entry', rejectEntryAfterScan);

// ─── Admin Endpoints (require admin identity) ─────────────────────────────────

// Admin gets visitor analytics
router.get('/api/visitors/analytics', requireAdminIdentity, getVisitorAnalytics);

// Admin lists all visitors
router.get('/api/visitors/all', requireAdminIdentity, listAllVisitors);

// Admin gets/sets visitor settings
router.get('/api/visitors/settings', requireAdminIdentity, getVisitorSettings);
router.put('/api/visitors/settings', requireAdminIdentity, updateVisitorSettings);

// Admin blacklists a visitor
router.post('/api/visitors/blacklist', requireAdminIdentity, blacklistVisitor);

// Admin emergency override
router.put('/api/visitors/emergency-override', requireAdminIdentity, emergencyOverride);

module.exports = router;
