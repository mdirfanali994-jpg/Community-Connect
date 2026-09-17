/**
 * Shared Smart Community constants for the frontend.
 * Mirrors backend/constants/packageTypes.js plus notice/event/poll constants.
 */

// ─── Packages ────────────────────────────────────────────────────────────────

export const COURIER_COMPANIES = [
  { key: 'amazon', label: 'Amazon' },
  { key: 'flipkart', label: 'Flipkart' },
  { key: 'myntra', label: 'Myntra' },
  { key: 'blinkit', label: 'Blinkit' },
  { key: 'zepto', label: 'Zepto' },
  { key: 'swiggy_instamart', label: 'Swiggy Instamart' },
  { key: 'bigbasket', label: 'BigBasket' },
  { key: 'blue_dart', label: 'Blue Dart' },
  { key: 'dtdc', label: 'DTDC' },
  { key: 'delhivery', label: 'Delhivery' },
  { key: 'india_post', label: 'India Post' },
  { key: 'fedex', label: 'FedEx' },
  { key: 'dhl', label: 'DHL' },
  { key: 'other', label: 'Other' },
];

export const COURIER_COMPANY_MAP = COURIER_COMPANIES.reduce((acc, c) => { acc[c.key] = c.label; return acc; }, {});

export const PACKAGE_CATEGORIES = [
  { key: 'small', label: 'Small' },
  { key: 'medium', label: 'Medium' },
  { key: 'large', label: 'Large' },
  { key: 'fragile', label: 'Fragile' },
  { key: 'documents', label: 'Documents' },
  { key: 'food', label: 'Food' },
  { key: 'medicine', label: 'Medicine' },
  { key: 'other', label: 'Other' },
];

export const PACKAGE_CATEGORY_MAP = PACKAGE_CATEGORIES.reduce((acc, c) => { acc[c.key] = c.label; return acc; }, {});

export const PACKAGE_STATUS_LABELS = {
  incoming: 'Incoming',
  ready: 'Ready for Pickup',
  picked_up: 'Picked Up',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

export const PACKAGE_STATUS_COLORS = {
  incoming: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  ready: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  picked_up: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
  returned: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  cancelled: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800',
};

// ─── Notices ─────────────────────────────────────────────────────────────────

export const NOTICE_CATEGORIES = [
  { key: 'general', label: 'General' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'electricity', label: 'Electricity' },
  { key: 'water', label: 'Water' },
  { key: 'security', label: 'Security' },
  { key: 'festival', label: 'Festival' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'event', label: 'Event' },
];

export const NOTICE_CATEGORY_MAP = NOTICE_CATEGORIES.reduce((acc, c) => { acc[c.key] = c.label; return acc; }, {});

export const NOTICE_PRIORITIES = [
  { key: 'normal', label: 'Normal', color: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800' },
  { key: 'important', label: 'Important', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  { key: 'emergency', label: 'Emergency', color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' },
];

export const NOTICE_PRIORITY_MAP = NOTICE_PRIORITIES.reduce((acc, p) => { acc[p.key] = p.label; return acc; }, {});

// ─── Events ──────────────────────────────────────────────────────────────────

export const EVENT_CATEGORIES = [
  { key: 'society_meeting', label: 'Society Meeting' },
  { key: 'festival', label: 'Festival' },
  { key: 'sports', label: 'Sports' },
  { key: 'blood_donation', label: 'Blood Donation' },
  { key: 'maintenance_meeting', label: 'Maintenance Meeting' },
  { key: 'cleaning_drive', label: 'Cleaning Drive' },
  { key: 'cultural', label: 'Cultural Program' },
  { key: 'other', label: 'Other' },
];

export const EVENT_CATEGORY_MAP = EVENT_CATEGORIES.reduce((acc, e) => { acc[e.key] = e.label; return acc; }, {});

export const RSVP_STATUSES = [
  { key: 'going', label: 'Going' },
  { key: 'maybe', label: 'Maybe' },
  { key: 'not_going', label: 'Not Going' },
];

// ─── Polls ───────────────────────────────────────────────────────────────────

export const POLL_CHOICE_LABELS = { single: 'Single Choice', multiple: 'Multiple Choice' };

// ─── Formatting helpers ──────────────────────────────────────────────────────

export const formatDate = (d) => {
  if (!d) return 'N/A';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
};

export const formatDateTime = (d) => {
  if (!d) return 'N/A';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
};
