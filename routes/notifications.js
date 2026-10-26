const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { ensureAuthenticated } = require('../middleware/auth');

// 1. Notification Center
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.investigator._id
    }).sort({ createdTimestamp: -1 });

    res.render('notifications/index', {
      title: 'Notification Center - Smart Investigation Workspace',
      notifications
    });
  } catch (error) {
    console.error('[Notifications List Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Notification Center Fault',
      message: error.message
    });
  }
});

// 2. Mark Single Notification as Read and redirect to actionLink
router.get('/:id/read', ensureAuthenticated, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.investigator._id
    });

    if (notification) {
      notification.isRead = true;
      notification.readTimestamp = new Date();
      await notification.save();

      if (notification.actionLink) {
        return res.redirect(notification.actionLink);
      }
    }
    res.redirect('/notifications');
  } catch (err) {
    res.redirect('/notifications');
  }
});

// 3. Mark All Notifications as Read
router.post('/mark-all-read', ensureAuthenticated, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.investigator._id, isRead: false },
      { isRead: true, readTimestamp: new Date() }
    );
    res.redirect('/notifications?success=All+notifications+marked+as+read.');
  } catch (err) {
    res.redirect('/notifications?error=Failed+to+update+notifications.');
  }
});

module.exports = router;
