/**
 * Reusable Visitor Types
 *
 * Delivery executives are also visitor types (Amazon, Flipkart, Swiggy, etc.)
 * so the same Visitor model handles both guest and delivery flows.
 * Future modules (Vehicle, Parking, Facial Recognition) can extend without changes.
 */

const VISITOR_TYPES = [
  { key: 'guest', label: 'Guest' },
  { key: 'relative', label: 'Relative' },
  { key: 'friend', label: 'Friend' },
  { key: 'delivery_executive', label: 'Delivery Executive' },
  { key: 'amazon', label: 'Amazon' },
  { key: 'flipkart', label: 'Flipkart' },
  { key: 'swiggy', label: 'Swiggy' },
  { key: 'zomato', label: 'Zomato' },
  { key: 'blinkit', label: 'Blinkit' },
  { key: 'zepto', label: 'Zepto' },
  { key: 'porter', label: 'Porter' },
  { key: 'maid', label: 'Maid' },
  { key: 'cook', label: 'Cook' },
  { key: 'driver', label: 'Driver' },
  { key: 'electrician', label: 'Electrician' },
  { key: 'plumber', label: 'Plumber' },
  { key: 'carpenter', label: 'Carpenter' },
  { key: 'technician', label: 'Technician' },
  { key: 'tutor', label: 'Tutor' },
  { key: 'maintenance', label: 'Maintenance Worker' },
  { key: 'other', label: 'Other' },
];

const VISITOR_TYPE_KEYS = VISITOR_TYPES.map((t) => t.key);
const VISITOR_TYPE_MAP = VISITOR_TYPES.reduce((acc, t) => { acc[t.key] = t.label; return acc; }, {});

const DELIVERY_TYPES = ['delivery_executive', 'amazon', 'flipkart', 'swiggy', 'zomato', 'blinkit', 'zepto', 'porter'];

const isDeliveryType = (key) => DELIVERY_TYPES.includes(key);

module.exports = {
  VISITOR_TYPES,
  VISITOR_TYPE_KEYS,
  VISITOR_TYPE_MAP,
  DELIVERY_TYPES,
  isDeliveryType,
};
