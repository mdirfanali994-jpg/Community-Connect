import { CreditCard } from 'lucide-react';
import { formatMoney, formatDate, getMonthLabel, PAYMENT_METHOD_LABEL } from './financeCategories';

/**
 * PaymentHistory — list of payment records.
 */
const PaymentHistory = ({ payments = [], currency = '₹', loading = false }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800 tracking-wider">
          <tr>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Month</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Method</th>
            <th className="px-4 py-3 font-medium">Reference</th>
            <th className="px-4 py-3 font-medium">Receipt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {loading ? (
            <tr>
              <td colSpan="6" className="px-4 py-10 text-center text-gray-500">Loading payments...</td>
            </tr>
          ) : payments.length === 0 ? (
            <tr>
              <td colSpan="6" className="px-4 py-10 text-center text-gray-500">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-20" />
                No payments yet.
              </td>
            </tr>
          ) : (
            payments.map((p) => (
              <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 text-xs">{formatDate(p.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200">{getMonthLabel(p.month)}</td>
                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{formatMoney(p.amountPaid, currency)}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 capitalize">
                    {PAYMENT_METHOD_LABEL[p.paymentMethod] || p.paymentMethod}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-mono">{p.referenceNumber || '—'}</td>
                <td className="px-4 py-3 text-xs font-mono">{p.receiptNumber || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PaymentHistory;

