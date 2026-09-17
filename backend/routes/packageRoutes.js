const express = require('express');
const router = express.Router();

const packageController = require('../controllers/packageController');
const { requireAdminIdentity } = require('../middleware/adminIdentity');
const { upload } = require('../middleware/multer');

/* ─── Security Endpoints (identity derived from workerId) ─────────────────── */

// Search residents for package registration
router.get('/api/packages/residents/search', packageController.searchResidents);

// Register / receive a package (photo upload supported)
router.post('/api/packages/register', upload.single('photo'), packageController.registerPackage);

// Security package list (today / pending pickup / history / search)
router.get('/api/packages/security', packageController.getSecurityPackages);

// Security verifies OTP for pickup
router.put('/api/packages/:id/verify-otp', packageController.verifyPackageOtp);

// Security scans package QR
router.post('/api/packages/scan', packageController.scanPackageQr);

// Security confirms pickup after QR/manual
router.put('/api/packages/:id/confirm-pickup', packageController.confirmPickup);

// Security marks package returned
router.put('/api/packages/:id/return', packageController.markReturned);

// Package history / timeline (security/admin/resident)
router.get('/api/packages/:id/history', packageController.getPackageHistory);

/* ─── Resident Endpoints (identity derived from userId) ───────────────────── */

// My packages
router.get('/api/packages/my', packageController.getMyPackages);

// View a package (marks viewed)
router.get('/api/packages/:id', packageController.viewPackage);

// Resident confirms pickup via OTP
router.put('/api/packages/:id/pickup', packageController.confirmPickupByResident);

// Resident reports missing package
router.put('/api/packages/:id/report-missing', packageController.reportMissing);

/* ─── Admin Endpoints (require admin identity) ────────────────────────────── */

// Package analytics
router.get('/api/packages/analytics', requireAdminIdentity, packageController.getPackageAnalytics);

// List all packages with filters
router.get('/api/packages/all', requireAdminIdentity, packageController.listAllPackages);

// Export packages CSV
router.get('/api/packages/export', requireAdminIdentity, packageController.exportPackagesCsv);

// Admin cancels a package
router.put('/api/packages/:id/cancel', requireAdminIdentity, packageController.cancelPackage);

module.exports = router;
