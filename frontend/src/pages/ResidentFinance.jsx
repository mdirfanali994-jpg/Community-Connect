import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Wallet, ArrowLeft, CreditCard, Receipt, PieChart, TrendingUp } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { FinanceSummaryCards } from '../components/finance/SummaryCards';
import { DonutChart, MonthlyBarChart, CategoryBreakdownList } from '../components/finance/FinanceCharts';
import { MyBillsTable } from '../components/finance/BillsTable';
import PaymentHistory from '../components/finance/PaymentHistory';
import ReceiptView from '../components/finance/ReceiptView';
import { getMonthLabel, getCategoryInfo, PAYMENT_METHODS } from '../components/finance/financeCategories';

const ResidentFinance = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  // Pay modal
  const [payModal, setPayModal] = useState({ open: false, bill: null, method: 'upi', referenceNumber: '', busy: false });

  // Receipt modal
  const [receipt, setReceipt] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const fetchBills = useCallback(async (userId) => {
    setBillsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/finance/my/bills?userId=${userId}`);
      if (res.data?.success) setBills(res.data.bills || []);
    } catch (e) {
      console.error('fetchBills error:', e);
      setError('Failed to load bills');
    } finally {
      setBillsLoading(false);
    }
  }, []);

  const fetchPayments = useCallback(async (userId) => {
    setPaymentsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/finance/my/payments?userId=${userId}`);
      if (res.data?.success) setPayments(res.data.payments || []);
    } catch (e) {
      console.error('fetchPayments error:', e);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async (userId) => {
    setSummaryLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/finance/my/summary?userId=${userId}`);
      if (res.data?.success) setSummary(res.data.summary);
    } catch (e) {
      console.error('fetchSummary error:', e);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw || JSON.parse(raw).role !== 'resident') {
      navigate('/login');
      return;
    }
    const parsed = JSON.parse(raw);
    const uid = parsed.id;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(parsed);
    const run = async () => {
      try {
        await Promise.all([
          fetchBills(uid),
          fetchPayments(uid),
          fetchSummary(uid),
        ]);
      } catch {
        // errors already logged in fetch functions
      }
    };
    run();
  }, [navigate, fetchBills, fetchPayments, fetchSummary]);

  const showFlash = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 4000);
  };

  const handlePayClick = (bill) => {
    setPayModal({ open: true, bill, method: 'upi', referenceNumber: '', busy: false });
  };

  const handlePayConfirm = async () => {
    const { bill, method, referenceNumber } = payModal;
    setPayModal((p) => ({ ...p, busy: true }));
    setError('');
    try {
      const res = await axios.post(`${API_BASE_URL}/finance/my/bills/${bill._id}/pay`, {
        userId: user.id,
        method,
        referenceNumber,
      });
      if (res.data?.success) {
        showFlash(`✅ Payment recorded. Receipt: ${res.data.bill?.receiptNumber || ''}`);
        setPayModal({ open: false, bill: null, method: 'upi', referenceNumber: '', busy: false });
        fetchBills(user.id);
        fetchPayments(user.id);
        fetchSummary(user.id);
      } else {
        setError(res.data?.message || 'Payment failed');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Payment failed');
    } finally {
      setPayModal((p) => ({ ...p, busy: false }));
    }
  };

  const handleReceipt = async (bill) => {
    setReceiptLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/finance/my/bills/${bill._id}/receipt?userId=${user.id}`);
      if (res.data?.success) {
        setReceipt(res.data.receipt);
        setReceiptOpen(true);
      } else {
        setError(res.data?.message || 'Receipt not found');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load receipt');
    } finally {
      setReceiptLoading(false);
    }
  };

  const currency = summary?.config?.currency || '₹';

  const categoryChartData = summary?.categoryBreakdown
    ? Object.entries(summary.categoryBreakdown).map(([key, val]) => ({
        key,
        value: typeof val === 'number' ? val : val?.total || 0,
      }))
    : [];

  const chartDataWithLabels = categoryChartData.map((d) => {
    const cat = getCategoryInfo(d.key);
    return { ...d, label: cat.label, color: cat.color };
  });

  const monthlyTrendData = (summary?.monthlyTrend || []).map((m) => ({
    label: getMonthLabel(m._id),
    value: m.collected,
  }));

  return (
    <div className="space-y-6 animate-fade-in transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 relative overflow-hidden group transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] group-hover:bg-primary/20 transition-all"></div>
        <div className="relative z-10 mb-4 sm:mb-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                My Maintenance
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm transition-colors">
                View your bills, pay online, and see exactly where maintenance money goes.
              </p>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={() => navigate('/user/dashboard')}
            className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
        </div>
      </div>

      {flash && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-2xl text-sm font-medium animate-fade-in">
          {flash}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-2xl text-sm font-medium animate-fade-in">
          {error}
        </div>
      )}

      {/* Community Summary Cards */}
      {summaryLoading ? (
        <div className="text-center py-10 text-gray-500 animate-pulse">Loading summary...</div>
      ) : (
        <FinanceSummaryCards summary={summary} currency={currency} variant="resident" />
      )}

      {/* My Bills */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center bg-gray-50/50 dark:bg-gray-900/40">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <CreditCard className="w-5 h-5 text-primary mr-2" />
            My Bills
          </h2>
        </div>
        <div className="p-6">
          <MyBillsTable bills={bills} currency={currency} loading={billsLoading} onPay={handlePayClick} onReceipt={handleReceipt} payBusy={null} />
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center bg-gray-50/50 dark:bg-gray-900/40">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Receipt className="w-5 h-5 text-primary mr-2" />
            Payment History
          </h2>
        </div>
        <div className="p-6">
          <PaymentHistory payments={payments} currency={currency} loading={paymentsLoading} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <PieChart className="w-5 h-5 text-primary mr-2" />
            Where Your Maintenance Goes
          </h2>
          <DonutChart data={chartDataWithLabels} currency={currency} />
        </div>
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 text-primary mr-2" />
            Community Collection Trend
          </h2>
          <MonthlyBarChart data={monthlyTrendData} currency={currency} />
        </div>
      </div>

      {/* Category Breakdown Rows */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 transition-colors">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <PieChart className="w-5 h-5 text-primary mr-2" />
          Expense Breakdown
        </h2>
        <CategoryBreakdownList breakdown={summary?.categoryBreakdown} currency={currency} total={summary?.totalExpenses} />
      </div>

      {/* Pay Modal */}
      {payModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-950/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Pay Maintenance — {getMonthLabel(payModal.bill?.month)}
              </h3>
              <button
                onClick={() => setPayModal({ open: false, bill: null, method: 'upi', referenceNumber: '', busy: false })}
                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-200 dark:bg-gray-800 px-2.5 py-1.5 rounded-lg text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center bg-gray-50 dark:bg-gray-950/50 rounded-2xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Amount Due</div>
                <div className="text-3xl font-extrabold text-primary mt-1">
                  {currency}{Number(payModal.bill?.totalDue ?? payModal.bill?.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</label>
                <select
                  value={payModal.method}
                  onChange={(e) => setPayModal({ ...payModal, method: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reference Number (optional)</label>
                <input
                  value={payModal.referenceNumber}
                  onChange={(e) => setPayModal({ ...payModal, referenceNumber: e.target.value })}
                  placeholder="e.g. UPI Ref or Bank Ref"
                  className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                ℹ️ This records your payment as <strong>{PAYMENT_METHODS.find((m) => m.value === payModal.method)?.label}</strong>.
                Payment gateway integration will be added in a future phase.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handlePayConfirm}
                  disabled={payModal.busy}
                  className="flex-1 flex justify-center items-center py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                >
                  {payModal.busy ? 'Processing...' : 'Confirm Payment'}
                </button>
                <button
                  onClick={() => setPayModal({ open: false, bill: null, method: 'upi', referenceNumber: '', busy: false })}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReceiptView open={receiptOpen} onClose={() => setReceiptOpen(false)} receipt={receipt} currency={currency} />

      {receiptLoading && (
        <div className="fixed inset-0 z-[99] flex items-center justify-center bg-gray-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-2xl text-sm text-gray-700 dark:text-gray-300 animate-pulse">
            Loading receipt...
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentFinance;

