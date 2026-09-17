/**
 * Reusable Package Types
 *
 * Courier companies, package categories, and status lifecycle
 * shared across backend controllers and frontend.
 */

const COURIER_COMPANIES = [
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

const COURIER_COMPANY_KEYS = COURIER_COMPANIES.map((c) => c.key);
const COURIER_COMPANY_MAP = COURIER_COMPANIES.reduce((acc, c) => { acc[c.key] = c.label; return acc; }, {});

const PACKAGE_CATEGORIES = [
  { key: 'small', label: 'Small' },
  { key: 'medium', label: 'Medium' },
  { key: 'large', label: 'Large' },
  { key: 'fragile', label: 'Fragile' },
  { key: 'documents', label: 'Documents' },
  { key: 'food', label: 'Food' },
  { key: 'medicine', label: 'Medicine' },
  { key: 'other', label: 'Other' },
];

const PACKAGE_CATEGORY_KEYS = PACKAGE_CATEGORIES.map((c) => c.key);
const PACKAGE_CATEGORY_MAP = PACKAGE_CATEGORIES.reduce((acc, c) => { acc[c.key] = c.label; return acc; }, {});

// Status lifecycle:
//   incoming -> ready -> picked_up | returned
//   incoming -> cancelled
const PACKAGE_STATUSES = ['incoming', 'ready', 'picked_up', 'returned', 'cancelled'];

const PACKAGE_STATUS_LABELS = {
  incoming: 'Incoming',
  ready: 'Ready for Pickup',
  picked_up: 'Picked Up',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

module.exports = {
  COURIER_COMPANIES,
  COURIER_COMPANY_KEYS,
  COURIER_COMPANY_MAP,
  PACKAGE_CATEGORIES,
  PACKAGE_CATEGORY_KEYS,
  PACKAGE_CATEGORY_MAP,
  PACKAGE_STATUSES,
  PACKAGE_STATUS_LABELS,
};
