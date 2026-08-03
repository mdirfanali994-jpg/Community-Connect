/**
 * Reusable Worker Roles
 *
 * Used by Worker model's `role` field.
 * These determine which dashboard is rendered for each worker.
 * Backward compatible: existing workers without a role fall back to their profession.
 */

const WORKER_ROLES = [
  { key: 'security_guard', label: 'Security Guard' },
  { key: 'cleaner', label: 'Cleaner' },
  { key: 'electrician', label: 'Electrician' },
  { key: 'plumber', label: 'Plumber' },
  { key: 'gardener', label: 'Gardener' },
  { key: 'cook', label: 'Cook' },
  { key: 'maid', label: 'Maid' },
  { key: 'carpenter', label: 'Carpenter' },
  { key: 'technician', label: 'Technician' },
  { key: 'other', label: 'Other' },
];

const WORKER_ROLE_KEYS = WORKER_ROLES.map((r) => r.key);
const WORKER_ROLE_MAP = WORKER_ROLES.reduce((acc, r) => { acc[r.key] = r.label; return acc; }, {});

/**
 * Map a profession string to a role key.
 * Backward compatible: if profession doesn't match any role, return 'other'.
 */
const professionToRole = (profession) => {
  if (!profession) return 'other';
  const key = profession.toLowerCase().replace(/\s+/g, '_');
  if (WORKER_ROLE_KEYS.includes(key)) return key;
  // Fuzzy match
  for (const role of WORKER_ROLES) {
    if (role.label.toLowerCase() === profession.toLowerCase()) return role.key;
    if (role.label.toLowerCase().includes(profession.toLowerCase())) return role.key;
  }
  return 'other';
};

module.exports = {
  WORKER_ROLES,
  WORKER_ROLE_KEYS,
  WORKER_ROLE_MAP,
  professionToRole,
};
