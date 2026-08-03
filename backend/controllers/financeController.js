const mongoose = require('mongoose');

const CommunityUser = require('../models/CommunityUser');
const Community = require('../models/Community');
const FinanceCategory = require('../models/FinanceCategory');
const MaintenanceConfig = require('../models/MaintenanceConfig');
const MaintenanceBill = require('../models/MaintenanceBill');
const MaintenancePayment = require('../models/MaintenancePayment');
const MaintenanceExpense = require('../models/MaintenanceExpense');
const {
  FINANCE_CATEGORIES,
  FINANCE_CATEGORY_KEYS,
} = require('../constants/financeCategories');
const {
  createFinanceNotification,
  createAdminFinanceNotification,
} = require('../services/notificationService');

const isValidObjectId = (v) => mongoose.isValidObjectId(v);

const parseMonth = (month) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const monthIndex = parseInt(m[2], 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex, monthString: `${year}-${String(monthIndex + 1).padStart(2, '0')}` };
};

const buildDueDate = (year, monthIndex, dueDay) => {
  // Clamp dueDay to last day of month to avoid invalid dates
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(dueDay, lastDay);
  return new Date(year, monthIndex, day, 23, 59, 59, 999);
};

const formatMoney = (v) => Number(v || 0).toFixed(2);

const makeReceiptNumber = (bill) => {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const monthPart = String(bill.month || '').replace('-', '');
  return `RC-${monthPart}-${String(bill.flatNumber || 'X').toUpperCase().replace(/\s/g, '')}-${rand}`;
};

/**
 * Lazily mark overdue bills for a community.
 * If config.lateFeeEnabled, apply lateFee to overdue bills once.
 */
const markOverdueBills = async (communityId) => {
  try {
    const now = new Date();
    const config = await MaintenanceConfig.findOne({ communityId }).lean();

    const overdueBills = await MaintenanceBill.find({
      communityId,
      status: 'pending',
      dueDate: { $lt: now },
    }).lean();

    for (const bill of overdueBills) {
      const update = { status: 'overdue' };
      if (
        config?.lateFeeEnabled &&
        config.lateFee > 0 &&
        (!bill.lateFee || bill.lateFee === 0)
      ) {
        update.lateFee = config.lateFee;
        update.totalDue = Number(bill.amount || 0) + Number(config.lateFee || 0);
      }
      await MaintenanceBill.updateOne({ _id: bill._id }, { $set: update });
    }
  } catch (err) {
    console.error('markOverdueBills error:', err);
  }
};

const ensureFinanceCategories = async (communityId, createdBy) => {
  const existing = await FinanceCategory.countDocuments({ communityId });
  if (existing > 0) return;

  const docs = FINANCE_CATEGORIES.map((c) => ({
    communityId,
    key: c.key,
    label: c.label,
    icon: c.icon,
    createdBy: createdBy || null,
  }));

  try {
    await FinanceCategory.insertMany(docs, { ordered: false });
  } catch (err) {
    // Duplicate key race is fine
    if (err?.code !== 11000) console.error('ensureFinanceCategories error:', err);
  }
};

/* ============================================================
 * Config
 * ============================================================ */

const getConfig = async (req, res) => {
  try {
    const communityId = req.adminIdentity?.communityId;
    const config = await MaintenanceConfig.findOne({ communityId }).lean();
    return res.json({
      success: true,
      config: config || null,
    });
  } catch (err) {
    console.error('getConfig error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const saveConfig = async (req, res) => {
  try {
    const communityId = req.adminIdentity?.communityId;
    const adminId = req.adminIdentity?.adminUserId;
    const { monthlyAmount, dueDay, lateFee, lateFeeEnabled, currency, description } = req.body;

    if (monthlyAmount === undefined || monthlyAmount === null || Number(monthlyAmount) < 0) {
      return res.status(400).json({ success: false, message: 'Monthly amount is required' });
    }

    const payload = {
      monthlyAmount: Number(monthlyAmount),
      dueDay: dueDay === undefined ? 10 : Math.min(Math.max(parseInt(dueDay, 10) || 10, 1), 28),
      lateFee: lateFee === undefined ? 0 : Number(lateFee),
      lateFeeEnabled: !!lateFeeEnabled,
      currency: currency || '₹',
      description: description || 'Monthly Society Maintenance',
    };

    const existing = await MaintenanceConfig.findOne({ communityId }).lean();
    if (existing) {
      const updated = await MaintenanceConfig.findOneAndUpdate(
        { communityId },
        { $set: { ...payload, updatedBy: adminId } },
        { new: true, lean: true }
      );
      return res.json({ success: true, config: updated });
    }

    await ensureFinanceCategories(communityId, adminId);

    const created = await MaintenanceConfig.create({
      communityId,
      ...payload,
      createdBy: adminId,
    });

    return res.json({ success: true, config: created.toObject() });
  } catch (err) {
    console.error('saveConfig error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ============================================================
 * Bills (Admin)
 * ============================================================ */

const generateBills = async (req, res) => {
  try {
    const communityId = req.adminIdentity?.communityId;
    const adminId = req.adminIdentity?.adminUserId;
    const { month } = req.body;

    const parsed = parseMonth(month);
    if (!parsed) {
      return res.status(400).json({ success: false, message: 'month is required as YYYY-MM' });
    }

    const config = await MaintenanceConfig.findOne({ communityId }).lean();
    if (!config) {
      return res.status(400).json({ success: false, message: 'Set maintenance config first' });
    }

    // Bills are generated ONLY for approved, active residents.
    const residents = await CommunityUser.find({
      communityId,
      role: 'resident',
      status: 'approved',
      isActive: true,
    })
      .select({ fullName: 1, block: 1, flatNumber: 1 })
      .lean();

    if (residents.length === 0) {
      return res.json({ success: true, generated: 0, skipped: 0, bills: [], message: 'No approved residents found' });
    }

    const dueDate = buildDueDate(parsed.year, parsed.monthIndex, config.dueDay || 10);

    // Idempotent: use upsert so existing resident+month bills are never duplicated.
    const operations = residents.map((resident) => ({
      updateOne: {
        filter: {
          communityId,
          residentId: resident._id,
          month: parsed.monthString,
        },
        update: {
          $setOnInsert: {
            communityId,
            residentId: resident._id,
            residentName: resident.fullName,
            block: resident.block || '',
            flatNumber: resident.flatNumber || '',
            month: parsed.monthString,
            amount: Number(config.monthlyAmount || 0),
            lateFee: 0,
            totalDue: Number(config.monthlyAmount || 0),
            dueDate,
            status: 'pending',
            receiptNumber: null,
            paymentId: null,
            paidAt: null,
            paymentMethod: null,
            paymentRef: null,
            createdBy: adminId,
          },
        },
        upsert: true,
      },
    }));

    const result = await MaintenanceBill.bulkWrite(operations, { ordered: false });
    const generated = result.upsertedCount || 0;
    const skipped = result.matchedCount || 0;

    const bills = await MaintenanceBill.find({ communityId, month: parsed.monthString })
      .sort({ flatNumber: 1 })
      .lean();

    // Notify residents about newly generated bills (only the new ones).
    if (generated > 0) {
      for (const bill of bills) {
        const isNew = bill.createdAt && Date.now() - new Date(bill.createdAt).getTime() < 10000;
        if (!isNew) continue;
        try {
          await createFinanceNotification({
            title: 'Maintenance bill generated',
            message: `Your maintenance bill of ${config.currency}${formatMoney(bill.totalDue)} for ${bill.month} is now available.`,
            communityId,
            residentId: bill.residentId,
            residentName: bill.residentName,
            flatNumber: bill.flatNumber,
            entityType: 'maintenance_bill',
            entityId: String(bill._id),
            action: 'bill_generated',
            metadata: { month: bill.month, amount: bill.totalDue },
          });
        } catch (notifyErr) {
          console.error('bill notification error:', notifyErr);
        }
      }
    }

    return res.json({
      success: true,
      generated,
      skipped,
      bills,
      message: `Generated ${generated} new bills, skipped ${skipped} existing.`,
    });
  } catch (err) {
    console.error('generateBills error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const listBills = async (req, res) => {
  try {
    const communityId = req.adminIdentity?.communityId;
    const { month, status } = req.query;

    await markOverdueBills(communityId);

    const query = { communityId };
    if (month) {
      const parsed = parseMonth(month);
      if (!parsed) return res.status(400).json({ success: false, message: 'Invalid month' });
      query.month = parsed.monthString;
    }
    if (status && ['pending', 'paid', 'overdue'].includes(status)) {
      query.status = status;
    }

    const bills = await MaintenanceBill.find(query).sort({ flatNumber: 1, month: -1 }).lean();

    return res.json({ success: true, bills });
  } catch (err) {
    console.error('listBills error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin manually updates a bill status (e.g. mark paid for cash collection).
 * If marking paid, a MaintenancePayment record is created.
 */
const updateBillStatus = async (req, res) => {
  try {
    const communityId = req.adminIdentity?.communityId;
    const adminId = req.adminIdentity?.adminUserId;
    const { id } = req.params;
    const { status, paymentMethod, referenceNumber } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid bill id' });
    }

    const bill = await MaintenanceBill.findOne({ _id: id, communityId }).lean();
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    const validStatuses = ['pending', 'paid'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be pending or paid' });
    }

    if (status === 'paid') {
      if (bill.status === 'paid') {
        return res.json({ success: true, bill, message: 'Bill is already paid' });
      }
      const method = paymentMethod || 'manual';
      const allowedMethods = ['cash', 'upi', 'bank_transfer', 'manual'];
      const normalizedMethod = allowedMethods.includes(method) ? method : 'manual';

      const receiptNumber = makeReceiptNumber(bill);
      const payment = await MaintenancePayment.create({
        communityId,
        residentId: bill.residentId,
        residentName: bill.residentName,
        flatNumber: bill.flatNumber,
        billId: bill._id,
        month: bill.month,
        amountPaid: bill.totalDue,
        paymentMethod: normalizedMethod,
        referenceNumber: referenceNumber || '',
        receiptNumber,
        createdBy: adminId,
        paidByRole: 'admin',
      });

      const updated = await MaintenanceBill.findOneAndUpdate(
        { _id: bill._id, communityId },
        {
          $set: {
            status: 'paid',
            receiptNumber,
            paymentId: payment._id,
            paidAt: new Date(),
            paymentMethod: normalizedMethod,
            paymentRef: referenceNumber || '',
            updatedBy: adminId,
          },
        },
        { new: true, lean: true }
      );

      try {
        await createFinanceNotification({
          title: 'Maintenance bill marked paid',
          message: `Your maintenance payment for ${bill.month} (${bill.flatNumber}) has been recorded by the admin.`,
          communityId,
          residentId: bill.residentId,
          residentName: bill.residentName,
          flatNumber: bill.flatNumber,
          entityType: 'maintenance_bill',
          entityId: String(bill._id),
          action: 'payment_recorded',
          metadata: { month: bill.month, amount: bill.totalDue, method: normalizedMethod },
        });
      } catch (notifyErr) {
        console.error('bill paid notification error:', notifyErr);
      }

      return res.json({ success: true, bill: updated, payment: payment.toObject() });
    }

    // status === 'pending'
    const updated = await MaintenanceBill.findOneAndUpdate(
      { _id: bill._id, communityId },
      {
        $set: {
          status: 'pending',
          receiptNumber: null,
          paymentId: null,
          paidAt: null,
          paymentMethod: null,
          paymentRef: null,
          updatedBy: adminId,
        },
      },
      { new: true, lean: true }
    );

    return res.json({ success: true, bill: updated });
  } catch (err) {
    console.error('updateBillStatus error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ============================================================
 * Expenses (Admin)
 * ============================================================ */

const listExpenses = async (req, res) => {
  try {
    const communityId = req.adminIdentity?.communityId;
    const { category, limit } = req.query;

    const query = { communityId };
    if (category && FINANCE_CATEGORY_KEYS.includes(category)) {
      query.category = category;
    }

    const expenses = await MaintenanceExpense.find(query)
      .sort({ expenseDate: -1, createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 200, 500))
      .lean();

    return res.json({ success: true, expenses });
  } catch (err) {
    console.error('listExpenses error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createExpense = async (req, res) => {
  try {
    const communityId = req.adminIdentity?.communityId;
    const adminId = req.adminIdentity?.adminUserId;
    const { title, category, amount, expenseDate, description, vendor } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!category || !FINANCE_CATEGORY_KEYS.includes(category)) {
      return res.status(400).json({ success: false, message: `category must be one of: ${FINANCE_CATEGORY_KEYS.join(', ')}` });
    }
    if (amount === undefined || amount === null || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const expense = await MaintenanceExpense.create({
      communityId,
      title: String(title).trim(),
      category,
      amount: Number(amount),
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      description: description || '',
      vendor: vendor || '',
      createdBy: adminId,
    });

    // Notify admins so finance activity is tracked in real-time.
    try {
      const config = await MaintenanceConfig.findOne({ communityId }).lean();
      const currency = config?.currency || '₹';
      await createAdminFinanceNotification({
        title: 'New expense added',
        message: `${String(title).trim()} of ${currency}${formatMoney(Number(amount))} recorded under ${category}.`,
        communityId,
        entityType: 'maintenance_expense',
        entityId: String(expense._id),
        action: 'expense_added',
        metadata: { title: String(title).trim(), amount: Number(amount), category },
      });
    } catch (notifyErr) {
      console.error('expense notification error:', notifyErr);
    }

    return res.status(201).json({ success: true, expense: expense.toObject() });
  } catch (err) {
    console.error('createExpense error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const communityId = req.adminIdentity?.communityId;
    const adminId = req.adminIdentity?.adminUserId;
    const { id } = req.params;
    const { title, category, amount, expenseDate, description, vendor } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid expense id' });
    }

    const existing = await MaintenanceExpense.findOne({ _id: id, communityId }).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    const update = { updatedBy: adminId };
    if (title !== undefined && String(title).trim()) update.title = String(title).trim();
    if (category !== undefined) {
      if (!FINANCE_CATEGORY_KEYS.includes(category)) {
        return res.status(400).json({ success: false, message: `category must be one of: ${FINANCE_CATEGORY_KEYS.join(', ')}` });
      }
      update.category = category;
    }
    if (amount !== undefined) {
      if (Number(amount) < 0) return res.status(400).json({ success: false, message: 'Valid amount is required' });
      update.amount = Number(amount);
    }
    if (expenseDate !== undefined) update.expenseDate = expenseDate ? new Date(expenseDate) : existing.expenseDate;
    if (description !== undefined) update.description = description || '';
    if (vendor !== undefined) update.vendor = vendor || '';

    const updated = await MaintenanceExpense.findOneAndUpdate(
      { _id: id, communityId },
      { $set: update },
      { new: true, lean: true }
    );

    return res.json({ success: true, expense: updated });
  } catch (err) {
    console.error('updateExpense error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const communityId = req.adminIdentity?.communityId;
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid expense id' });
    }

    const deleted = await MaintenanceExpense.findOneAndDelete({ _id: id, communityId }).lean();
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    return res.json({ success: true, message: 'Expense deleted' });
  } catch (err) {
    console.error('deleteExpense error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ============================================================
 * Summary
 * ============================================================ */

const buildCommunitySummary = async (communityId) => {
  await markOverdueBills(communityId);

  const [config, billAgg, expenseAgg, expenseByCategory, monthlyAgg, billCounts] = await Promise.all([
    MaintenanceConfig.findOne({ communityId }).lean(),
    MaintenancePayment.aggregate([
      { $match: { communityId } },
      { $group: { _id: null, totalCollected: { $sum: '$amountPaid' }, count: { $sum: 1 } } },
    ]),
    MaintenanceExpense.aggregate([
      { $match: { communityId } },
      { $group: { _id: null, totalExpenses: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    MaintenanceExpense.aggregate([
      { $match: { communityId } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]),
    MaintenancePayment.aggregate([
      { $match: { communityId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          collected: { $sum: '$amountPaid' },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 12 },
    ]),
    MaintenanceBill.aggregate([
      { $match: { communityId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const totalCollected = billAgg[0]?.totalCollected || 0;
  const totalExpenses = expenseAgg[0]?.totalExpenses || 0;
  const remainingBalance = totalCollected - totalExpenses;

  const counts = { pending: 0, paid: 0, overdue: 0 };
  billCounts.forEach((c) => {
    if (counts[c._id] !== undefined) counts[c._id] = c.count;
  });

  const categoryBreakdown = {};
  expenseByCategory.forEach((c) => {
    categoryBreakdown[c._id] = { total: c.total, count: 1 };
  });

  return {
    config,
    totalCollected,
    totalExpenses,
    remainingBalance,
    totalBills: counts.pending + counts.paid + counts.overdue,
    paidBills: counts.paid,
    pendingBills: counts.pending,
    overdueBills: counts.overdue,
    expenseCount: expenseAgg[0]?.count || 0,
    paymentCount: billAgg[0]?.count || 0,
    categoryBreakdown,
    monthlyTrend: monthlyAgg,
  };
};

const getSummary = async (req, res) => {
  try {
    const communityId = req.adminIdentity?.communityId;
    const summary = await buildCommunitySummary(communityId);
    return res.json({ success: true, summary });
  } catch (err) {
    console.error('getSummary error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ============================================================
 * Resident endpoints
 * ============================================================ */

/**
 * Derive resident identity + communityId strictly from backend lookup.
 * Never trusts a frontend-sent communityId.
 */
const deriveResident = async (userId) => {
  if (!userId || !isValidObjectId(userId)) return null;
  const userDoc = await CommunityUser.findOne({
    _id: userId,
    role: 'resident',
  }).lean();
  if (!userDoc) return null;
  return {
    residentId: userDoc._id,
    communityId: userDoc.communityId,
    fullName: userDoc.fullName,
    block: userDoc.block || '',
    flatNumber: userDoc.flatNumber || '',
  };
};

const getMyBills = async (req, res) => {
  try {
    const resident = await deriveResident(req.query.userId);
    if (!resident) {
      return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }

    await markOverdueBills(resident.communityId);

    const bills = await MaintenanceBill.find({
      communityId: resident.communityId,
      residentId: resident.residentId,
    })
      .sort({ month: -1 })
      .lean();

    return res.json({ success: true, bills });
  } catch (err) {
    console.error('getMyBills error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const payMyBill = async (req, res) => {
  try {
    const resident = await deriveResident(req.body.userId);
    if (!resident) {
      return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid bill id' });
    }

    const bill = await MaintenanceBill.findOne({
      _id: id,
      communityId: resident.communityId,
      residentId: resident.residentId,
    }).lean();

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    if (bill.status === 'paid') {
      return res.json({ success: true, bill, payment: null, message: 'Bill is already paid' });
    }

    const { method, referenceNumber } = req.body;
    const allowedMethods = ['cash', 'upi', 'bank_transfer', 'manual'];
    const normalizedMethod = allowedMethods.includes(method) ? method : 'manual';

    const receiptNumber = makeReceiptNumber(bill);

    const payment = await MaintenancePayment.create({
      communityId: resident.communityId,
      residentId: resident.residentId,
      residentName: resident.fullName,
      flatNumber: resident.flatNumber,
      billId: bill._id,
      month: bill.month,
      amountPaid: bill.totalDue,
      paymentMethod: normalizedMethod,
      referenceNumber: referenceNumber || '',
      receiptNumber,
      createdBy: resident.residentId,
      paidByRole: 'resident',
    });

    const updatedBill = await MaintenanceBill.findOneAndUpdate(
      { _id: bill._id, communityId: resident.communityId },
      {
        $set: {
          status: 'paid',
          receiptNumber,
          paymentId: payment._id,
          paidAt: new Date(),
          paymentMethod: normalizedMethod,
          paymentRef: referenceNumber || '',
          updatedBy: resident.residentId,
        },
      },
      { new: true, lean: true }
    );

    // Notify admin that a resident paid.
    try {
      await createAdminFinanceNotification({
        title: 'Maintenance payment received',
        message: `${resident.fullName} (${resident.flatNumber}) paid ${bill.month} maintenance of ${bill.totalDue}.`,
        communityId: resident.communityId,
        entityType: 'maintenance_payment',
        entityId: String(payment._id),
        action: 'payment_made',
        metadata: { month: bill.month, amount: bill.totalDue, flat: resident.flatNumber, method: normalizedMethod },
      });
    } catch (notifyErr) {
      console.error('payment notification error:', notifyErr);
    }

    return res.json({ success: true, bill: updatedBill, payment: payment.toObject() });
  } catch (err) {
    console.error('payMyBill error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getMyPayments = async (req, res) => {
  try {
    const resident = await deriveResident(req.query.userId);
    if (!resident) {
      return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }

    const payments = await MaintenancePayment.find({
      communityId: resident.communityId,
      residentId: resident.residentId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, payments });
  } catch (err) {
    console.error('getMyPayments error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getMySummary = async (req, res) => {
  try {
    const resident = await deriveResident(req.query.userId);
    if (!resident) {
      return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }

    await markOverdueBills(resident.communityId);

    const [communitySummary, myBills, myPayments] = await Promise.all([
      buildCommunitySummary(resident.communityId),
      MaintenanceBill.find({
        communityId: resident.communityId,
        residentId: resident.residentId,
      })
        .sort({ month: -1 })
        .lean(),
      MaintenancePayment.find({
        communityId: resident.communityId,
        residentId: resident.residentId,
      })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const myTotalPaid = myPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
    const myPending = myBills.filter((b) => b.status === 'pending').length;
    const myOverdue = myBills.filter((b) => b.status === 'overdue').length;

    return res.json({
      success: true,
      summary: {
        ...communitySummary,
        myTotalPaid,
        myPending,
        myOverdue,
        myBillCount: myBills.length,
      },
    });
  } catch (err) {
    console.error('getMySummary error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getReceipt = async (req, res) => {
  try {
    const resident = await deriveResident(req.query.userId);
    if (!resident) {
      return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid bill id' });
    }

    const bill = await MaintenanceBill.findOne({
      _id: id,
      communityId: resident.communityId,
      residentId: resident.residentId,
    }).lean();

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const payment = bill.paymentId
      ? await MaintenancePayment.findOne({ _id: bill.paymentId, communityId: resident.communityId }).lean()
      : null;

    const community = await Community.findById(resident.communityId)
      .select({ name: 1, address: 1, city: 1, state: 1 })
      .lean();

    return res.json({
      success: true,
      receipt: {
        bill,
        payment,
        community,
        resident: {
          name: resident.fullName,
          block: resident.block,
          flatNumber: resident.flatNumber,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('getReceipt error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getConfig,
  saveConfig,
  generateBills,
  listBills,
  updateBillStatus,
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getSummary,
  getMyBills,
  payMyBill,
  getMyPayments,
  getMySummary,
  getReceipt,
};

