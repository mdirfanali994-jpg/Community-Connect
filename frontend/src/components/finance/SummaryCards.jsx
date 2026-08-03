import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { formatMoney } from './financeCategories';

const Card = ({ icon: Icon, label, value, sub, accent = 'text-primary bg-primary/10 border-primary/20' }) => (
  <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-800 flex items-center relative overflow-hidden transition-colors">
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mr-5 border ${accent}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div className="min-w-0">
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1 truncate">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white truncate">{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  </div>
);

/**
 * Finance summary cards (community level).
 * Used on AdminFinance and ResidentFinance community overview.
 */
export const FinanceSummaryCards = ({ summary, currency = '₹', variant = 'admin' }) => {
  if (!summary) return null;

  const cards = [];

  if (variant === 'resident') {
    cards.push(
      {
        key: 'collected',
        icon: Wallet,
        iconClass: 'text-primary',
        accent: 'text-primary bg-primary/10 border-primary/20',
        label: 'Total Maintenance Collected',
        value: formatMoney(summary.totalCollected, currency),
      },
      {
        key: 'expenses',
        icon: TrendingDown,
        iconClass: 'text-red-500',
        accent: 'text-red-500 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
        label: 'Total Expenses',
        value: formatMoney(summary.totalExpenses, currency),
      },
      {
        key: 'balance',
        icon: Scale,
        iconClass: 'text-green-500',
        accent: 'text-green-500 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20',
        label: 'Remaining Balance',
        value: formatMoney(summary.remainingBalance, currency),
      },
      {
        key: 'myPaid',
        icon: TrendingUp,
        iconClass: 'text-emerald-500',
        accent: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
        label: 'My Total Paid',
        value: formatMoney(summary.myTotalPaid, currency),
        sub: `${summary.myBillCount || 0} bills generated for my flat`,
      }
    );
  } else {
    cards.push(
      {
        key: 'collected',
        icon: Wallet,
        iconClass: 'text-primary',
        accent: 'text-primary bg-primary/10 border-primary/20',
        label: 'Total Collected',
        value: formatMoney(summary.totalCollected, currency),
        sub: `${summary.paymentCount || 0} payments received`,
      },
      {
        key: 'expenses',
        icon: TrendingDown,
        iconClass: 'text-red-500',
        accent: 'text-red-500 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
        label: 'Total Expenses',
        value: formatMoney(summary.totalExpenses, currency),
        sub: `${summary.expenseCount || 0} expense entries`,
      },
      {
        key: 'balance',
        icon: Scale,
        iconClass: 'text-green-500',
        accent: 'text-green-500 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20',
        label: 'Remaining Balance',
        value: formatMoney(summary.remainingBalance, currency),
        sub: 'Collected − Expenses',
      },
      {
        key: 'bills',
        icon: FileText,
        iconClass: 'text-blue-500',
        accent: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
        label: 'Total Bills',
        value: summary.totalBills ?? 0,
        sub: `${summary.paidBills ?? 0} paid`,
      }
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.key} {...c} />
      ))}
    </div>
  );
};

/**
 * Bill status mini-cards (pending / overdue / paid counts).
 */
export const BillStatusCards = ({ summary }) => {
  if (!summary) return null;
  const items = [
    {
      label: 'Pending',
      value: summary.pendingBills ?? 0,
      icon: Clock,
      cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
    },
    {
      label: 'Overdue',
      value: summary.overdueBills ?? 0,
      icon: AlertTriangle,
      cls: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
    },
    {
      label: 'Paid',
      value: summary.paidBills ?? 0,
      icon: CheckCircle,
      cls: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20',
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.map((it) => (
        <Card key={it.label} icon={it.icon} label={it.label} value={it.value} accent={it.cls} />
      ))}
    </div>
  );
};

export default FinanceSummaryCards;

