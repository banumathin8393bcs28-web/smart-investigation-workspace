const Notification = require('../models/Notification');

let ioInstance = null;

function setSocketIO(io) {
  ioInstance = io;
}

/**
 * Creates and persists a notification in MongoDB, then emits to active Socket.IO room if recipient is connected
 */
async function createNotification({
  recipientId,
  senderId = null,
  senderName = 'System',
  notificationType,
  title,
  text,
  caseId = null,
  caseNumber = '',
  relatedId = '',
  actionLink = ''
}) {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      senderName,
      notificationType,
      title,
      notificationText: text,
      relatedCaseId: caseId,
      caseNumber,
      relatedId,
      actionLink,
      isRead: false,
      createdTimestamp: new Date()
    });

    // Real-time delivery if user is connected
    if (ioInstance) {
      ioInstance.to(`user_${recipientId}`).emit('new_notification', {
        id: notification._id,
        type: notificationType,
        title,
        text,
        caseNumber,
        actionLink,
        createdAt: notification.createdTimestamp
      });
    }

    return notification;
  } catch (error) {
    console.error('[NotificationService] Error creating notification:', error.message);
    return null;
  }
}

/**
 * Gets unread notifications count for an investigator
 */
async function getUnreadCount(investigatorId) {
  return await Notification.countDocuments({
    recipient: investigatorId,
    isRead: false
  });
}

module.exports = {
  setSocketIO,
  createNotification,
  getUnreadCount
};
