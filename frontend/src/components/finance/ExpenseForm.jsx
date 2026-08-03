import { useState, useEffect } from 'react';
import { Plus, X, Save } from 'lucide-react';
import { FINANCE_CATEGORIES, getCategoryInfo, getCurrentMonth } from './financeCategories';

/**
 * ExpenseForm — create/edit expense in a modal.
 * Resets form fields via key remount each time the modal opens.
 */
const ExpenseForm = ({ open, onClose, onSubmit, initial = null, currency = '₹' }) => {
  const [mountKey, setMountKey] = useState(0);

  // Increment the mount key to force a fresh ExpenseFormInner instance each open.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open) setMountKey((k) => k + 1); }, [open]);

  if (!open) return null;

  return (
    <ExpenseFormInner
      key={mountKey}
      initial={initial}
      onClose={onClose}
      onSubmit={onSubmit}
      currency={currency}
    />
  );
};

const ExpenseFormInner = ({ initial, onClose, onSubmit, currency }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || 'water');
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
  const [expenseDate, setExpenseDate] = useState(
    initial?.expenseDate ? new Date(initial.expenseDate).toISOString().slice(0, 10) : getCurrentMonth() + '-01'
  );
  const [description, setDescription] = useState(initial?.description || '');
  const [vendor, setVendor] = useState(initial?.vendor || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return setError('Title is required');
    if (!amount || Number(amount) < 0) return setError('Valid amount is required');
    setError('');
    setSaving(true);
    onSubmit({
      title: title.trim(),
      category,
      amount: Number(amount),
      expenseDate,
      description: description.trim(),
      vendor: vendor.trim(),
    })
      .finally(() => setSaving(false));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-950/50">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
            <Plus className="w-5 h-5 mr-2 text-primary" />
            {initial ? 'Edit Expense' : 'Add Expense'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-200 dark:bg-gray-800 px-2.5 py-1.5 rounded-lg text-sm font-bold transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Water Bill"
              className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              >
                {FINANCE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount ({currency})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expense Date</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vendor / Payee</label>
              <input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Municipal Corp"
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              rows="2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes..."
              className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
            />
          </div>

          {initial && (
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: getCategoryInfo(initial.category).color }} />
              Current category: {getCategoryInfo(initial.category).label}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex justify-center items-center py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : initial ? 'Update Expense' : 'Add Expense'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseForm;
