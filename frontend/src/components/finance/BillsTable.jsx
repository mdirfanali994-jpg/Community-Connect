import { FileText, Download } from 'lucide-react';
import { formatMoney, formatDate, getMonthLabel } from './financeCategories';

const STATUS_STYLES = {
  paid: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
  pending: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  overdue: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
};

/**
 * BillsTable — admin view with status management.
 */
export const BillsTable = ({ bills = [], currency = '₹', onStatusChange, loading = false, actionBusy = null }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800 tracking-wider">
          <tr>
            <th className="px-4 py-3 font-medium">Month</th>
            <th className="px-4 py-3 font-medium">Resident</th>
            <th className="px-4 py-3 font-medium">Flat</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Due Date</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {loading ? (
            <tr>
              <td colSpan="7" className="px-4 py-10 text-center text-gray-500">Loading bills...</td>
            </tr>
          ) : bills.length === 0 ? (
            <tr>
              <td colSpan="7" className="px-4 py-10 text-center text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                No bills generated yet. Use "Generate Monthly Bills".
              </td>
            </tr>
          ) : (
            bills.map((b) => (
              <tr key={b._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200">{getMonthLabel(b.month)}</td>
                <td className="px-4 py-3">{b.residentName}</td>
                <td className="px-4 py-3 text-xs">
                  {b.block && `Block ${b.block} · `}
                  {b.flatNumber}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{formatMoney(b.totalDue ?? b.amount, currency)}</td>
                <td className="px-4 py-3 text-xs">{formatDate(b.dueDate)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[b.status] || ''}`}>
                    {b.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {b.status !== 'paid' && (
                    <button
                      onClick={() => onStatusChange?.(b)}
                      disabled={actionBusy === b._id}
                      className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
                    >
                      {actionBusy === b._id ? 'Marking...' : 'Mark Paid'}
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

/**
 * MyBillsTable — resident view with pay/download receipt actions.
 */
export const MyBillsTable = ({ bills = [], currency = '₹', onPay, onReceipt, loading = false, payBusy = null }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800 tracking-wider">
          <tr>
            <th className="px-4 py-3 font-medium">Month</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Due Date</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Receipt No.</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {loading ? (
            <tr>
              <td colSpan="6" className="px-4 py-10 text-center text-gray-500">Loading bills...</td>
            </tr>
          ) : bills.length === 0 ? (
            <tr>
              <td colSpan="6" className="px-4 py-10 text-center text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                No maintenance bills yet.
              </td>
            </tr>
          ) : (
            bills.map((b) => (
              <tr key={b._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200">{getMonthLabel(b.month)}</td>
                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{formatMoney(b.totalDue ?? b.amount, currency)}</td>
                <td className="px-4 py-3 text-xs">{formatDate(b.dueDate)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[b.status] || ''}`}>
                    {b.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-mono">{b.receiptNumber || '—'}</td>
                <td className="px-4 py-3">
                  {b.status === 'paid' ? (
                    <button
                      onClick={() => onReceipt?.(b)}
                      className="inline-flex items-center px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-semibold hover:bg-primary/20 transition-all"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Receipt
                    </button>
                  ) : (
                    <button
                      onClick={() => onPay?.(b)}
                      disabled={payBusy === b._id}
                      className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      {payBusy === b._id ? 'Paying...' : 'Pay Now'}
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default BillsTable;

