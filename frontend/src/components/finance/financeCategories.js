/**
 * Frontend finance category definitions.
 * Mirrors backend/constants/financeCategories.js.
 */
export const FINANCE_CATEGORIES = [
  { key: 'water', label: 'Water Bill', icon: 'Droplets', color: '#38bdf8' },
  { key: 'electricity', label: 'Electricity Bill', icon: 'Zap', color: '#facc15' },
  { key: 'security', label: 'Security Salary', icon: 'Shield', color: '#a78bfa' },
  { key: 'housekeeping', label: 'Housekeeping', icon: 'Brush', color: '#fb923c' },
  { key: 'lift', label: 'Lift Maintenance', icon: 'ArrowUpDown', color: '#34d399' },
  { key: 'garden', label: 'Garden', icon: 'Sprout', color: '#4ade80' },
  { key: 'repairs', label: 'Repairs', icon: 'Wrench', color: '#f87171' },
  { key: 'cleaning', label: 'Cleaning', icon: 'Sparkles', color: '#60a5fa' },
  { key: 'other', label: 'Other', icon: 'MoreHorizontal', color: '#94a3b8' },
];

export const CATEGORY_MAP = FINANCE_CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c;
  return acc;
}, {});

export const getCategoryInfo = (key) => CATEGORY_MAP[key] || { key, label: key, color: '#94a3b8', icon: 'MoreHorizontal' };

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'manual', label: 'Manual Payment' },
];

export const PAYMENT_METHOD_LABEL = PAYMENT_METHODS.reduce((acc, m) => {
  acc[m.value] = m.label;
  return acc;
}, {});

export const formatMoney = (v, currency = '₹') =>
  `${currency}${Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

export const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const getMonthLabel = (month) => {
  if (!month) return '—';
  const [y, m] = month.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
};

