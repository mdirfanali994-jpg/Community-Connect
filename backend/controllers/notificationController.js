const Notification = require('../models/Notification');

const getNotificationsForRole = async (req, res) => {
  try {
    const { targetRole } = req.query;
    if (!targetRole) {
      return res.status(400).json({ success: false, message: 'targetRole is required' });
    }

    const notifications = await Notification.find({ targetRole })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, notifications });
  } catch (err) {
    console.error('getNotificationsForRole error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Notification.findOneAndUpdate(
      { _id: id },
      { read: true, readAt: new Date() },
      { new: true, lean: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification: updated });
  } catch (err) {
    console.error('markNotificationRead error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const markAllReadForRole = async (req, res) => {
  try {
    const { targetRole } = req.query;
    if (!targetRole) {
      return res.status(400).json({ success: false, message: 'targetRole is required' });
    }

    await Notification.updateMany(
      { targetRole, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('markAllReadForRole error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getNotificationsForRole,
  markNotificationRead,
  markAllReadForRole
};

