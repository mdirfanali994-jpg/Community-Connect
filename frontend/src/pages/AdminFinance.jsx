import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Wallet,
  Settings,
  CalendarRange,
  Plus,
  RefreshCw,
  ArrowLeft,
  Receipt,
  PieChart,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { FinanceSummaryCards, BillStatusCards } from '../components/finance/SummaryCards';
import { DonutChart, MonthlyBarChart, CategoryBreakdownList } from '../components/finance/FinanceCharts';
import ExpenseTable from '../components/finance/ExpenseTable';
import ExpenseForm from '../components/finance/ExpenseForm';
import { BillsTable } from '../components/finance/BillsTable';
import { getCurrentMonth, getMonthLabel, getCategoryInfo } from '../components/finance/financeCategories';

const AdminFinance = () => {
  const navigate = useNavigate();

  const [config, setConfig] = useState(null);
  const [configForm, setConfigForm] = useState({ monthlyAmount: '', dueDay: 10, lateFee: '', lateFeeEnabled: false });

  const [month, setMonth] = useState(getCurrentMonth());
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusBusy, setStatusBusy] = useState(null);

  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  const getHeaders = () => {
    const raw = localStorage.getItem('user');
    const u = raw ? JSON.parse(raw) : null;
    return {
      'x-admin-id': String(u?.id),
      'x-community-id': String(u?.communityId),
    };
  };

  const fetchConfig = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/finance/config`, { headers: getHeaders() });
      if (res.data?.success && res.data.config) {
        setConfig(res.data.config);
        setConfigForm({
          monthlyAmount: String(res.data.config.monthlyAmount ?? ''),
          dueDay: res.data.config.dueDay ?? 10,
          lateFee: String(res.data.config.lateFee ?? ''),
          lateFeeEnabled: !!res.data.config.lateFeeEnabled,
        });
      }
    } catch (e) {
      console.error('fetchConfig error:', e);
    }
  }, []);

  const fetchBills = useCallback(async () => {
    setBillsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/finance/bills?month=${month}`, { headers: getHeaders() });
      if (res.data?.success) setBills(res.data.bills || []);
    } catch (e) {
      console.error('fetchBills error:', e);
    } finally {
      setBillsLoading(false);
    }
  }, [month]);

  const fetchExpenses = useCallback(async () => {
    setExpensesLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/finance/expenses`, { headers: getHeaders() });
      if (res.data?.success) setExpenses(res.data.expenses || []);
    } catch (e) {
      console.error('fetchExpenses error:', e);
    } finally {
      setExpensesLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/finance/summary`, { headers: getHeaders() });
      if (res.data?.success) setSummary(res.data.summary);
    } catch (e) {
      console.error('fetchSummary error:', e);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    Promise.all([fetchConfig(), fetchBills(), fetchExpenses(), fetchSummary()]).catch(() => {});
  }, [fetchConfig, fetchBills, fetchExpenses, fetchSummary]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw || JSON.parse(raw).role !== 'admin') {
      navigate('/login');
      return;
    }
    const run = async () => {
      try {
        await refreshAll();
      } catch {
        // errors already logged in fetch functions
      }
    };
    run();
  }, [navigate, refreshAll]);

  const showFlash = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 4000);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post(
        `${API_BASE_URL}/finance/config`,
        {
          monthlyAmount: Number(configForm.monthlyAmount),
          dueDay: Number(configForm.dueDay),
          lateFee: Number(configForm.lateFee || 0),
          lateFeeEnabled: configForm.lateFeeEnabled,
        },
        { headers: getHeaders() }
      );
      if (res.data?.success) {
        setConfig(res.data.config);
        showFlash('✅ Maintenance configuration saved.');
        fetchSummary();
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save config');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await axios.post(
        `${API_BASE_URL}/finance/bills/generate`,
        { month },
        { headers: getHeaders() }
      );
      if (res.data?.success) {
        showFlash(`✅ ${res.data.message}`);
        fetchBills();
        fetchSummary();
      } else {
        setError(res.data?.message || 'Failed to generate bills');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to generate bills');
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async (bill) => {
    setStatusBusy(bill._id);
    setError('');
    try {
      const res = await axios.put(
        `${API_BASE_URL}/finance/bills/${bill._id}/status`,
        { status: 'paid', paymentMethod: 'manual' },
        { headers: getHeaders() }
      );
      if (res.data?.success) {
        showFlash(`✅ Marked ${bill.residentName} (${bill.flatNumber}) as paid.`);
        fetchBills();
        fetchSummary();
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update bill');
    } finally {
      setStatusBusy(null);
    }
  };

  const handleExpenseSubmit = async (payload) => {
    try {
      if (editingExpense) {
        const res = await axios.put(
          `${API_BASE_URL}/finance/expenses/${editingExpense._id}`,
          payload,
          { headers: getHeaders() }
        );
        if (res.data?.success) showFlash('✅ Expense updated.');
      } else {
        const res = await axios.post(`${API_BASE_URL}/finance/expenses`, payload, { headers: getHeaders() });
        if (res.data?.success) showFlash('✅ Expense added.');
      }
      setExpenseFormOpen(false);
      setEditingExpense(null);
      fetchExpenses();
      fetchSummary();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save expense');
    }
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseFormOpen(true);
  };

  const handleDeleteExpense = async (expense) => {
    if (!window.confirm(`Delete expense "${expense.title}"? This cannot be undone.`)) return;
    try {
      const res = await axios.delete(`${API_BASE_URL}/finance/expenses/${expense._id}`, { headers: getHeaders() });
      if (res.data?.success) {
        showFlash('🗑️ Expense deleted.');
        fetchExpenses();
        fetchSummary();
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete expense');
    }
  };

  const currency = summary?.config?.currency || config?.currency || '₹';

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
                Finance & Maintenance
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm transition-colors">
                Manage maintenance bills, expenses, and society funds.
              </p>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/dashboard')}
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

      {/* Summary Cards */}
      {summaryLoading ? (
        <div className="text-center py-10 text-gray-500 animate-pulse">Loading summary...</div>
      ) : (
        <>
          <FinanceSummaryCards summary={summary} currency={currency} variant="admin" />
          <BillStatusCards summary={summary} />
        </>
      )}

      {/* Config + Generate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config */}
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Settings className="w-5 h-5 text-primary mr-2" />
            Maintenance Configuration
          </h2>
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={configForm.monthlyAmount}
                  onChange={(e) => setConfigForm({ ...configForm, monthlyAmount: e.target.value })}
                  placeholder="e.g. 2500"
                  className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Due Day (1-28)</label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={configForm.dueDay}
                  onChange={(e) => setConfigForm({ ...configForm, dueDay: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Late Fee</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={configForm.lateFee}
                  onChange={(e) => setConfigForm({ ...configForm, lateFee: e.target.value })}
                  placeholder="e.g. 100"
                  className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
              <div className="space-y-1 flex flex-col justify-end">
                <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configForm.lateFeeEnabled}
                    onChange={(e) => setConfigForm({ ...configForm, lateFeeEnabled: e.target.checked })}
                    className="h-4 w-4 text-primary focus:ring-primary/50"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">Enable Late Fee</span>
                </label>
              </div>
            </div>
            <button
              type="submit"
              className="w-full flex justify-center items-center py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold transition-all"
            >
              <Settings className="w-4 h-4 mr-2" />
              Save Configuration
            </button>
          </form>
        </div>

        {/* Generate Bills */}
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <CalendarRange className="w-5 h-5 text-primary mr-2" />
            Generate Monthly Bills
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Bills are generated only for <strong>approved, active residents</strong>.
            Generation is idempotent — running it again never duplicates existing bills.
          </p>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Billing Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !config}
              className="w-full flex justify-center items-center py-3 bg-gradient-to-r from-primary to-cyan-500 dark:from-primary dark:to-cyan-400 text-white dark:text-gray-950 rounded-xl font-bold shadow-md shadow-primary/20 transition-all disabled:opacity-50"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {generating ? 'Generating...' : 'Generate Monthly Bills'}
            </button>
            {!config && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Save the maintenance configuration first.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 dark:bg-gray-900/40">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-3 sm:mb-0">
            <Receipt className="w-5 h-5 text-primary mr-2" />
            Bills — {getMonthLabel(month)}
          </h2>
          <button
            onClick={fetchBills}
            className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </button>
        </div>
        <div className="p-6">
          <BillsTable bills={bills} currency={currency} loading={billsLoading} onStatusChange={handleMarkPaid} actionBusy={statusBusy} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <PieChart className="w-5 h-5 text-primary mr-2" />
            Expense Breakdown
          </h2>
          <DonutChart data={chartDataWithLabels} currency={currency} />
        </div>
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 text-primary mr-2" />
            Monthly Collection Trend
          </h2>
          <MonthlyBarChart data={monthlyTrendData} currency={currency} />
        </div>
      </div>

      {/* Category Breakdown Rows */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 transition-colors">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <TrendingDown className="w-5 h-5 text-primary mr-2" />
          Category Breakdown
        </h2>
        <CategoryBreakdownList breakdown={summary?.categoryBreakdown} currency={currency} total={summary?.totalExpenses} />
      </div>

      {/* Expenses */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 dark:bg-gray-900/40">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-3 sm:mb-0">
            <TrendingDown className="w-5 h-5 text-primary mr-2" />
            Expense Management
          </h2>
          <button
            onClick={() => {
              setEditingExpense(null);
              setExpenseFormOpen(true);
            }}
            className="flex items-center px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </button>
        </div>
        <div className="p-6">
          <ExpenseTable
            expenses={expenses}
            currency={currency}
            loading={expensesLoading}
            onEdit={handleEditExpense}
            onDelete={handleDeleteExpense}
          />
        </div>
      </div>

      <ExpenseForm
        open={expenseFormOpen}
        onClose={() => {
          setExpenseFormOpen(false);
          setEditingExpense(null);
        }}
        onSubmit={handleExpenseSubmit}
        initial={editingExpense}
        currency={currency}
      />
    </div>
  );
};

export default AdminFinance;

