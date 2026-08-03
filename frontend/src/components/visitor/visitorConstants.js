/**
 * Visitor type constants for the frontend.
 * Mirrors backend/constants/visitorTypes.js
 */
export const VISITOR_TYPES = [
  { key: 'guest', label: 'Guest', icon: 'User' },
  { key: 'relative', label: 'Relative', icon: 'Users' },
  { key: 'friend', label: 'Friend', icon: 'Heart' },
  { key: 'delivery_executive', label: 'Delivery Executive', icon: 'Package' },
  { key: 'amazon', label: 'Amazon', icon: 'Package' },
  { key: 'flipkart', label: 'Flipkart', icon: 'Package' },
  { key: 'swiggy', label: 'Swiggy', icon: 'Package' },
  { key: 'zomato', label: 'Zomato', icon: 'Package' },
  { key: 'blinkit', label: 'Blinkit', icon: 'Package' },
  { key: 'zepto', label: 'Zepto', icon: 'Package' },
  { key: 'porter', label: 'Porter', icon: 'Truck' },
  { key: 'maid', label: 'Maid', icon: 'UserCheck' },
  { key: 'cook', label: 'Cook', icon: 'ChefHat' },
  { key: 'driver', label: 'Driver', icon: 'Car' },
  { key: 'electrician', label: 'Electrician', icon: 'Zap' },
  { key: 'plumber', label: 'Plumber', icon: 'Wrench' },
  { key: 'carpenter', label: 'Carpenter', icon: 'Hammer' },
  { key: 'technician', label: 'Technician', icon: 'Tool' },
  { key: 'tutor', label: 'Tutor', icon: 'BookOpen' },
  { key: 'maintenance', label: 'Maintenance Worker', icon: 'Wrench' },
  { key: 'other', label: 'Other', icon: 'MoreHorizontal' },
];

export const VISITOR_TYPE_MAP = VISITOR_TYPES.reduce((acc, t) => { acc[t.key] = t.label; return acc; }, {});

export const DELIVERY_KEYS = ['delivery_executive', 'amazon', 'flipkart', 'swiggy', 'zomato', 'blinkit', 'zepto', 'porter'];

export const isDelivery = (key) => DELIVERY_KEYS.includes(key);

/**
 * Worker role constants for the frontend.
 * Mirrors backend/constants/workerRoles.js
 */
export const WORKER_ROLES = [
  { key: 'security_guard', label: 'Security Guard', icon: 'Shield' },
  { key: 'cleaner', label: 'Cleaner', icon: 'Brush' },
  { key: 'electrician', label: 'Electrician', icon: 'Zap' },
  { key: 'plumber', label: 'Plumber', icon: 'Wrench' },
  { key: 'gardener', label: 'Gardener', icon: 'Sprout' },
  { key: 'cook', label: 'Cook', icon: 'ChefHat' },
  { key: 'maid', label: 'Maid', icon: 'UserCheck' },
  { key: 'carpenter', label: 'Carpenter', icon: 'Hammer' },
  { key: 'technician', label: 'Technician', icon: 'Tool' },
  { key: 'other', label: 'Other', icon: 'MoreHorizontal' },
];

export const VISITOR_STATUS_COLORS = {
  scheduled: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  arrived: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  entered: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
  exited: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800',
  completed: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  cancelled: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
};

export const VISITOR_STATUS_LABELS = {
  scheduled: 'Scheduled',
  arrived: 'Arrived',
  entered: 'Entered',
  exited: 'Exited',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};
