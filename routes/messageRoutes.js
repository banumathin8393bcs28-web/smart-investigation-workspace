const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const { isAuthenticated } = require('../middleware/auth');

// GET /messages - Messaging workstation
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { caseId, recipientId } = req.query;

    const [allInvestigators, cases, evidenceList] = await Promise.all([
      User.find(),
      Case.find(),
      Evidence.find()
    ]);

    // Query messages: either case-specific, direct with investigator, or general channel
    let messages = [];
    if (caseId) {
      messages = await Message.find({ caseId });
    } else if (recipientId) {
      messages = await Message.find({
        $or: [
          { sender: req.user._id, recipient: recipientId },
          { sender: recipientId, recipient: req.user._id }
        ]
      });
    } else {
      // General briefing channel
      messages = await Message.find({ caseId: null, recipient: null });
    }

    messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Enrich messages with sender details and evidence references
    const enrichedMessages = messages.map(m => {
      const snd = allInvestigators.find(u => u._id.toString() === (m.sender || '').toString());
      let ev = null;
      if (m.evidenceShare) {
        ev = evidenceList.find(e => e._id.toString() === m.evidenceShare.toString());
      }
      return {
        ...m,
        senderObj: snd || { name: m.senderName || 'Investigator', avatar: '/images/default-avatar.png', rank: 'Detective' },
        evidenceObj: ev
      };
    });

    const currentRecipient = recipientId ? allInvestigators.find(u => u._id.toString() === recipientId.toString()) : null;
    const currentCase = caseId ? cases.find(c => c._id.toString() === caseId.toString()) : null;

    res.render('messages/index', {
      title: 'Secure Collaboration & Media Dispatch | Smart Investigation Workspace',
      investigators: allInvestigators.filter(u => u._id.toString() !== req.user._id.toString()),
      cases,
      evidenceList,
      messages: enrichedMessages,
      currentRecipient,
      currentCase,
      activeChannel: caseId ? `case_${caseId}` : (recipientId ? `direct_${recipientId}` : 'general')
    });
  } catch (err) {
    console.error('Messaging error:', err);
    res.redirect('/dashboard?error=Could not open messaging channel');
  }
});

// POST /messages - Send message via HTTP or fallback
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { content, caseId, recipientId, evidenceShare, messageType } = req.body;
    if (!content || !content.trim()) {
      return res.redirect('/messages');
    }

    const msg = await Message.create({
      sender: req.user._id,
      senderName: req.user.name,
      senderBadge: req.user.badgeId,
      recipient: recipientId || null,
      caseId: caseId || null,
      content: content.trim(),
      evidenceShare: evidenceShare || null,
      messageType: messageType || 'chat'
    });

    let redirectUrl = '/messages';
    if (caseId) redirectUrl += `?caseId=${caseId}`;
    else if (recipientId) redirectUrl += `?recipientId=${recipientId}`;

    res.redirect(redirectUrl);
  } catch (err) {
    console.error('Send message error:', err);
    res.redirect('/messages?error=Failed to deliver message');
  }
});

module.exports = router;
