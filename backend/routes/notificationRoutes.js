const express = require('express');
const router = express.Router();

const {
  getNotificationsForRole,
  markNotificationRead,
  markAllReadForRole
} = require('../controllers/notificationController');

router.get('/api/notifications', getNotificationsForRole);
router.put('/api/notifications/:id/read', markNotificationRead);
router.put('/api/notifications/read-all', markAllReadForRole);

module.exports = router;

