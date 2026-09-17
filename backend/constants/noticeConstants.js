/**
 * Notice constants — categories and priorities.
 * Mirrored in frontend/src/components/community/communityConstants.js
 */

const NOTICE_CATEGORIES = [
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

const NOTICE_CATEGORY_KEYS = NOTICE_CATEGORIES.map((c) => c.key);
const NOTICE_CATEGORY_MAP = NOTICE_CATEGORIES.reduce((acc, c) => { acc[c.key] = c.label; return acc; }, {});

const NOTICE_PRIORITIES = ['normal', 'important', 'emergency'];

module.exports = {
  NOTICE_CATEGORIES,
  NOTICE_CATEGORY_KEYS,
  NOTICE_CATEGORY_MAP,
  NOTICE_PRIORITIES,
};
