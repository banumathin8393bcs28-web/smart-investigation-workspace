const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Investigator = require('../models/Investigator');
const Contact = require('../models/Contact');
const Case = require('../models/Case');
const { ensureAuthenticated } = require('../middleware/auth');
const { uploadAttachment } = require('../middleware/upload');
const { calculateFileHash } = require('../services/hashService');
const { createNotification } = require('../services/notificationService');

// 1. Messages / Chat Interface
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const investigatorId = req.investigator._id;
    const recipientId = req.query.recipientId;

    // Fetch accepted contacts to populate conversational drawer
    const contacts = await Contact.find({
      owner: investigatorId,
      status: 'Accepted'
    }).populate('contact', 'fullName role email profilePhoto lastActivity');

    let activeRecipient = null;
    let messages = [];

    if (recipientId) {
      activeRecipient = await Investigator.findById(recipientId);
      if (activeRecipient) {
        // Fetch message history between current investigator and recipient
        messages = await Message.find({
          $or: [
            { sender: investigatorId, recipient: activeRecipient._id },
            { sender: activeRecipient._id, recipient: investigatorId }
          ]
        }).sort({ sentTimestamp: 1 });

        // Mark unread incoming messages as read
        await Message.updateMany(
          { sender: activeRecipient._id, recipient: investigatorId, deliveryStatus: { $ne: 'Read' } },
          { deliveryStatus: 'Read', readTimestamp: new Date() }
        );
      }
    } else if (contacts.length > 0) {
      // Auto-select first contact
      return res.redirect(`/messages?recipientId=${contacts[0].contact._id}`);
    }

    res.render('messages/index', {
      title: 'Investigator Communication - Smart Investigation Workspace',
      contacts,
      activeRecipient,
      messages
    });
  } catch (error) {
    console.error('[Messages Interface Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Messaging Fault',
      message: error.message
    });
  }
});

// 2. Send Message via HTTP Post (Fallback / Form submit with attachments)
router.post('/send', ensureAuthenticated, uploadAttachment.single('attachment'), async (req, res) => {
  try {
    const { recipientId, messageText, caseId } = req.body;
    if (!recipientId) {
      return res.redirect('/messages?error=No+recipient+selected.');
    }

    const recipient = await Investigator.findById(recipientId);
    if (!recipient) {
      return res.redirect('/messages?error=Recipient+investigator+not+found.');
    }

    const attachments = [];
    if (req.file) {
      const sha256 = await calculateFileHash(req.file.path);
      attachments.push({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        storagePath: req.file.path,
        mimeType: req.file.mimetype,
        size: req.file.size,
        sha256
      });
    }

    if (!messageText && attachments.length === 0) {
      return res.redirect(`/messages?recipientId=${recipientId}&error=Message+cannot+be+empty.`);
    }

    const message = await Message.create({
      sender: req.investigator._id,
      senderName: req.investigator.fullName,
      recipient: recipient._id,
      recipientName: recipient.fullName,
      caseId: caseId || null,
      messageText: (messageText || '').trim(),
      attachments,
      deliveryStatus: 'Sent',
      sentTimestamp: new Date()
    });

    // Create Notification for recipient
    await createNotification({
      recipientId: recipient._id,
      senderId: req.investigator._id,
      senderName: req.investigator.fullName,
      notificationType: 'message',
      title: `Message from ${req.investigator.fullName}`,
      text: messageText ? (messageText.length > 50 ? messageText.substring(0, 47) + '...' : messageText) : `Sent an attachment (${attachments[0]?.originalName})`,
      actionLink: `/messages?recipientId=${req.investigator._id}`
    });

    res.redirect(`/messages?recipientId=${recipientId}`);
  } catch (err) {
    console.error('[Send Message Error]:', err);
    res.redirect(`/messages?error=${encodeURIComponent(err.message)}`);
  }
});

// 3. Authenticated Message Attachment Download
router.get('/attachment/:messageId/:attachmentIndex', ensureAuthenticated, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).send('Message record not found.');
    }

    // Security check: Must be sender or recipient
    const userId = req.investigator._id.toString();
    if (message.sender.toString() !== userId && message.recipient.toString() !== userId) {
      return res.status(403).send('Security Violation: Unauthorized attachment access.');
    }

    const index = parseInt(req.params.attachmentIndex, 10);
    const attachment = message.attachments[index];
    if (!attachment || !fs.existsSync(attachment.storagePath)) {
      return res.status(404).send('Attachment file not found on disk.');
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    res.sendFile(attachment.storagePath);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
