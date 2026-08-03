const express = require('express');
const router = express.Router();

const financeController = require('../controllers/financeController');
const { requireAdminIdentity } = require('../middleware/adminIdentity');

/* ============================================================
 * Admin Finance APIs (require x-admin-id + x-community-id)
 * ============================================================ */

// Config
router.get('/api/finance/config', requireAdminIdentity, financeController.getConfig);
router.post('/api/finance/config', requireAdminIdentity, financeController.saveConfig);

// Bills
router.post('/api/finance/bills/generate', requireAdminIdentity, financeController.generateBills);
router.get('/api/finance/bills', requireAdminIdentity, financeController.listBills);
router.put('/api/finance/bills/:id/status', requireAdminIdentity, financeController.updateBillStatus);

// Expenses
router.get('/api/finance/expenses', requireAdminIdentity, financeController.listExpenses);
router.post('/api/finance/expenses', requireAdminIdentity, financeController.createExpense);
router.put('/api/finance/expenses/:id', requireAdminIdentity, financeController.updateExpense);
router.delete('/api/finance/expenses/:id', requireAdminIdentity, financeController.deleteExpense);

// Summary
router.get('/api/finance/summary', requireAdminIdentity, financeController.getSummary);

/* ============================================================
 * Resident Finance APIs (backend-derives communityId from userId)
 * ============================================================ */

// My bills / payments / summary / receipt
router.get('/api/finance/my/bills', financeController.getMyBills);
router.post('/api/finance/my/bills/:id/pay', financeController.payMyBill);
router.get('/api/finance/my/payments', financeController.getMyPayments);
router.get('/api/finance/my/summary', financeController.getMySummary);
router.get('/api/finance/my/bills/:id/receipt', financeController.getReceipt);

module.exports = router;

