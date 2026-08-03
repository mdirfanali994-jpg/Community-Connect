import { useState } from 'react';
import { Pencil, Trash2, Search } from 'lucide-react';
import { getCategoryInfo, formatMoney, formatDate } from './financeCategories';

/**
 * ExpenseTable — list expenses with category badges, edit/delete actions.
 */
const ExpenseTable = ({ expenses = [], currency = '₹', onEdit, onDelete, loading = false }) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const filtered = expenses.filter((e) => {
    const matchesCat = categoryFilter === 'All' || e.category === categoryFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      e.title?.toLowerCase().includes(q) ||
      e.vendor?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-sm rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary transition-all"
        >
          <option value="All">All Categories</option>
          {Array.from(new Set(expenses.map((e) => e.category))).map((c) => (
            <option key={c} value={c}>
              {getCategoryInfo(c).label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
          <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800 tracking-wider">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-4 py-10 text-center text-gray-500">
                  Loading expenses...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-10 text-center text-gray-500">
                  No expenses found.
                </td>
              </tr>
            ) : (
              filtered.map((e) => {
                const cat = getCategoryInfo(e.category);
                return (
                  <tr key={e._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-200">{e.title}</div>
                      {e.description && (
                        <div className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">{e.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium border"
                        style={{ color: cat.color, borderColor: `${cat.color}44`, background: `${cat.color}11` }}
                      >
                        {cat.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      {formatMoney(e.amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-xs">{formatDate(e.expenseDate || e.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{e.vendor || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => onEdit?.(e)}
                          className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete?.(e)}
                          className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpenseTable;

