/**
 * Event constants — categories.
 * Mirrored in frontend/src/components/community/communityConstants.js
 */

const EVENT_CATEGORIES = [
  { key: 'society_meeting', label: 'Society Meeting' },
  { key: 'festival', label: 'Festival' },
  { key: 'sports', label: 'Sports' },
  { key: 'blood_donation', label: 'Blood Donation' },
  { key: 'maintenance_meeting', label: 'Maintenance Meeting' },
  { key: 'cleaning_drive', label: 'Cleaning Drive' },
  { key: 'cultural', label: 'Cultural Program' },
  { key: 'other', label: 'Other' },
];

const EVENT_CATEGORY_KEYS = EVENT_CATEGORIES.map((c) => c.key);
const EVENT_CATEGORY_MAP = EVENT_CATEGORIES.reduce((acc, c) => { acc[c.key] = c.label; return acc; }, {});

const EVENT_STATUSES = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'];

const RSVP_STATUSES = ['going', 'maybe', 'not_going'];

module.exports = {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_KEYS,
  EVENT_CATEGORY_MAP,
  EVENT_STATUSES,
  RSVP_STATUSES,
};
