/**
 * Reusable Finance Categories
 *
 * Centralized so future modules (expenses, budgets, reports) can reuse
 * the same category definitions without hardcoding strings in controllers.
 *
 * Each category:
 * - key:   stable machine key (used as default category on expenses)
 * - label: human readable label for UI
 * - icon:  suggested lucide icon name (optional, UI hint)
 */

const FINANCE_CATEGORIES = [
  { key: 'water', label: 'Water Bill', icon: 'Droplets' },
  { key: 'electricity', label: 'Electricity Bill', icon: 'Zap' },
  { key: 'security', label: 'Security Salary', icon: 'Shield' },
  { key: 'housekeeping', label: 'Housekeeping', icon: 'Brush' },
  { key: 'lift', label: 'Lift Maintenance', icon: 'ArrowUpDown' },
  { key: 'garden', label: 'Garden', icon: 'Sprout' },
  { key: 'repairs', label: 'Repairs', icon: 'Wrench' },
  { key: 'cleaning', label: 'Cleaning', icon: 'Sparkles' },
  { key: 'other', label: 'Other', icon: 'MoreHorizontal' },
];

const FINANCE_CATEGORY_KEYS = FINANCE_CATEGORIES.map((c) => c.key);

const FINANCE_CATEGORY_MAP = FINANCE_CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c.label;
  return acc;
}, {});

module.exports = {
  FINANCE_CATEGORIES,
  FINANCE_CATEGORY_KEYS,
  FINANCE_CATEGORY_MAP,
};

