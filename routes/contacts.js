const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const Investigator = require('../models/Investigator');
const Message = require('../models/Message');
const AuditLog = require('../models/AuditLog');
const { ensureAuthenticated } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

// 1. View Existing Contacts
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const investigatorId = req.investigator._id;

    // Fetch accepted and pending contacts
    const contacts = await Contact.find({
      owner: investigatorId,
      status: { $in: ['Accepted', 'Pending'] }
    }).populate('contact', 'fullName role email profilePhoto lastActivity');

    // Fetch incoming pending requests (where this investigator is the target contact)
    const incomingRequests = await Contact.find({
      contact: investigatorId,
      status: 'Pending'
    }).populate('owner', 'fullName role email profilePhoto');

    // Get unread counts per contact
    const enrichedContacts = await Promise.all(
      contacts.map(async (c) => {
        const unreadCount = await Message.countDocuments({
          sender: c.contact._id,
          recipient: investigatorId,
          deliveryStatus: { $ne: 'Read' }
        });

        // Online if activity within 5 minutes
        const isOnline = c.contact.lastActivity && (Date.now() - new Date(c.contact.lastActivity).getTime() < 5 * 60 * 1000);

        return {
          ...c.toObject(),
          unreadCount,
          isOnline
        };
      })
    );

    res.render('contacts/index', {
      title: 'Investigator Contacts - Smart Investigation Workspace',
      contacts: enrichedContacts,
      incomingRequests,
      errors: {}
    });
  } catch (error) {
    console.error('[Contacts Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Contacts Service Fault',
      message: error.message
    });
  }
});

// 2. Add New Contact Form
router.get('/add', ensureAuthenticated, (req, res) => {
  res.render('contacts/add', {
    title: 'Add New Investigator Contact - Smart Investigation Workspace',
    searchResult: null,
    searchQuery: '',
    errors: {}
  });
});

// 3. Search Investigator by Official Email
router.post('/search', ensureAuthenticated, async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  try {
    if (!email) {
      return res.status(400).render('contacts/add', {
        title: 'Add New Investigator Contact',
        searchResult: null,
        searchQuery: '',
        errors: { email: 'Please enter an official government email address.' }
      });
    }

    if (email === req.investigator.email) {
      return res.status(400).render('contacts/add', {
        title: 'Add New Investigator Contact',
        searchResult: null,
        searchQuery: email,
        errors: { email: 'You cannot add your own official account as a contact.' }
      });
    }

    const targetUser = await Investigator.findOne({ email }).select('fullName role email profilePhoto department');
    if (!targetUser) {
      return res.render('contacts/add', {
        title: 'Add New Investigator Contact',
        searchResult: null,
        searchQuery: email,
        errors: { email: 'No authorized investigator found matching this government email.' }
      });
    }

    // Check existing contact relationship
    const existing = await Contact.findOne({
      owner: req.investigator._id,
      contact: targetUser._id
    });

    res.render('contacts/add', {
      title: 'Add New Investigator Contact',
      searchResult: targetUser,
      existingStatus: existing ? existing.status : null,
      searchQuery: email,
      errors: {}
    });
  } catch (err) {
    res.status(500).render('contacts/add', {
      title: 'Add New Investigator Contact',
      searchResult: null,
      searchQuery: email,
      errors: { general: 'Search failed.' }
    });
  }
});

// 4. Send Contact Request
router.post('/request', ensureAuthenticated, async (req, res) => {
  const { contactId, displayName, notes } = req.body;
  try {
    const target = await Investigator.findById(contactId);
    if (!target) {
      return res.redirect('/contacts?error=Investigator+not+found');
    }

    // Create or update contact record for owner
    await Contact.findOneAndUpdate(
      { owner: req.investigator._id, contact: target._id },
      {
        status: 'Pending',
        displayName: (displayName || target.fullName).trim(),
        requestNotes: (notes || '').trim(),
        updatedTimestamp: new Date()
      },
      { upsert: true, new: true }
    );

    // Notify target investigator
    await createNotification({
      recipientId: target._id,
      senderId: req.investigator._id,
      senderName: req.investigator.fullName,
      notificationType: 'contact_request',
      title: 'New Contact Request',
      text: `${req.investigator.fullName} (${req.investigator.role}) sent you a contact request.`,
      actionLink: '/contacts'
    });

    await AuditLog.create({
      actor: req.investigator._id,
      actorName: req.investigator.fullName,
      action: 'CONTACT_REQUEST_SENT',
      changeSummary: `Contact request sent to ${target.fullName} (${target.email}).`,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date()
    });

    res.redirect('/contacts?success=Contact+request+sent+successfully.');
  } catch (err) {
    console.error('[Contact Request Error]:', err);
    res.redirect('/contacts?error=Failed+to+send+contact+request.');
  }
});

// 5. Accept Contact Request
router.post('/accept/:id', ensureAuthenticated, async (req, res) => {
  try {
    const requestRecord = await Contact.findById(req.params.id);
    if (!requestRecord || requestRecord.contact.toString() !== req.investigator._id.toString()) {
      return res.redirect('/contacts?error=Unauthorized+contact+action.');
    }

    requestRecord.status = 'Accepted';
    requestRecord.updatedTimestamp = new Date();
    await requestRecord.save();

    // Reciprocal contact entry so both parties can message each other
    await Contact.findOneAndUpdate(
      { owner: req.investigator._id, contact: requestRecord.owner },
      { status: 'Accepted', updatedTimestamp: new Date() },
      { upsert: true }
    );

    // Notify requester
    await createNotification({
      recipientId: requestRecord.owner,
      senderId: req.investigator._id,
      senderName: req.investigator.fullName,
      notificationType: 'contact_accept',
      title: 'Contact Request Accepted',
      text: `${req.investigator.fullName} accepted your contact connection request.`,
      actionLink: '/contacts'
    });

    res.redirect('/contacts?success=Contact+request+accepted.');
  } catch (err) {
    res.redirect('/contacts?error=Failed+to+accept+contact.');
  }
});

// 6. Edit Contact Display Name
router.post('/edit/:id', ensureAuthenticated, async (req, res) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      owner: req.investigator._id
    });
    if (!contact) {
      return res.redirect('/contacts?error=Contact+record+not+found.');
    }

    const { displayName } = req.body;
    contact.displayName = (displayName || '').trim();
    contact.updatedTimestamp = new Date();
    await contact.save();

    res.redirect('/contacts?success=Contact+alias+updated.');
  } catch (err) {
    res.redirect('/contacts?error=Failed+to+update+contact.');
  }
});

module.exports = router;
