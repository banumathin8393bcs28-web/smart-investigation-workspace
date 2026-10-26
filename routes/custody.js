const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const Custody = require('../models/Custody');
const Investigator = require('../models/Investigator');
const { ensureAuthenticated } = require('../middleware/auth');
const { initiateCaseTransfer, respondToTransfer, recordEvidenceCustodyEvent } = require('../services/custodyService');

// 1. Chain of Custody & Transfer Dashboard
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const investigatorId = req.investigator._id;
    const caseId = req.query.caseId;

    const query = caseId
      ? { caseId }
      : {
          $or: [
            { actor: investigatorId },
            { transferor: investigatorId },
            { recipient: investigatorId }
          ]
        };

    // Pending transfers awaiting current investigator's action
    const pendingTransfers = await Custody.find({
      recipient: investigatorId,
      status: 'Pending'
    }).populate('caseId', 'caseNumber caseName');

    // Chronological history
    const custodyHistory = await Custody.find(query).sort({ eventTimestamp: -1 });

    // Available cases for initiating a transfer
    const authorizedCases = await Case.find({
      $or: [
        { assignedInvestigator: investigatorId },
        { createdBy: investigatorId }
      ]
    }).select('caseNumber caseName');

    // Available colleagues
    const colleagues = await Investigator.find({
      _id: { $ne: investigatorId }
    }).select('fullName role email');

    res.render('custody/index', {
      title: 'Chain of Custody & Transfers - Smart Investigation Workspace',
      pendingTransfers,
      custodyHistory,
      authorizedCases,
      colleagues,
      filterCaseId: caseId || ''
    });
  } catch (error) {
    console.error('[Custody Route Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Custody Service Error',
      message: error.message
    });
  }
});

// 2. Transfer Case Initiator Form
router.get('/transfer-case', ensureAuthenticated, async (req, res) => {
  try {
    const caseId = req.query.caseId;
    let selectedCase = null;
    if (caseId) {
      selectedCase = await Case.findById(caseId);
    }

    const authorizedCases = await Case.find({
      $or: [
        { assignedInvestigator: req.investigator._id },
        { createdBy: req.investigator._id }
      ]
    });

    const colleagues = await Investigator.find({
      _id: { $ne: req.investigator._id }
    }).select('fullName role email');

    res.render('custody/transfer', {
      title: 'Initiate Case Transfer - Smart Investigation Workspace',
      authorizedCases,
      selectedCase,
      colleagues,
      errors: {}
    });
  } catch (err) {
    res.status(500).render('partials/error', {
      title: '500 - Transfer Initialization Error',
      message: err.message
    });
  }
});

// 3. Process Case Transfer Request
router.post('/transfer-case', ensureAuthenticated, async (req, res) => {
  const { caseId, recipientId, reason, notes } = req.body;
  const errors = {};

  if (!caseId) errors.caseId = 'Please select a case to transfer.';
  if (!recipientId) errors.recipientId = 'Please select a recipient investigator.';
  if (!reason || reason.trim().length < 5) errors.reason = 'Please provide an official transfer reason (min 5 chars).';

  if (Object.keys(errors).length > 0) {
    const authorizedCases = await Case.find({
      $or: [
        { assignedInvestigator: req.investigator._id },
        { createdBy: req.investigator._id }
      ]
    });
    const colleagues = await Investigator.find({
      _id: { $ne: req.investigator._id }
    }).select('fullName role email');

    return res.status(400).render('custody/transfer', {
      title: 'Initiate Case Transfer',
      authorizedCases,
      selectedCase: null,
      colleagues,
      errors
    });
  }

  try {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.redirect('/custody?error=Case+not+found.');
    }

    // Must be assigned or creator
    const invId = req.investigator._id.toString();
    if (caseDoc.assignedInvestigator.toString() !== invId && caseDoc.createdBy.toString() !== invId) {
      return res.status(403).render('partials/error', {
        title: '403 - Forbidden',
        message: 'You are not authorized to transfer this case.'
      });
    }

    const recipient = await Investigator.findById(recipientId);
    if (!recipient) {
      return res.redirect('/custody?error=Recipient+investigator+not+found.');
    }

    await initiateCaseTransfer({
      caseDoc,
      fromInvestigator: req.investigator,
      toInvestigator: recipient,
      reason: reason.trim(),
      notes: (notes || '').trim()
    });

    res.redirect(`/custody?success=${encodeURIComponent(`Transfer request for ${caseDoc.caseNumber} initiated to ${recipient.fullName}. Awaiting recipient acknowledgement.`)}`);
  } catch (err) {
    console.error('[Custody Transfer Submit Error]:', err);
    res.redirect(`/custody?error=${encodeURIComponent(err.message)}`);
  }
});

// 4. Respond to Transfer Request (Accept / Reject)
router.post('/respond/:id', ensureAuthenticated, async (req, res) => {
  const { response, notes } = req.body; // 'Accept' or 'Reject'
  try {
    const record = await respondToTransfer({
      custodyRecordId: req.params.id,
      investigator: req.investigator,
      response,
      responseNotes: notes
    });

    res.redirect(`/custody?success=${encodeURIComponent(`Transfer ${response === 'Accept' ? 'accepted' : 'declined'} successfully.`)}`);
  } catch (err) {
    console.error('[Custody Response Error]:', err);
    res.redirect(`/custody?error=${encodeURIComponent(err.message)}`);
  }
});

// 5. Record Physical Evidence Custody Action
router.post('/evidence-action', ensureAuthenticated, async (req, res) => {
  const { evidenceId, action, reason, notes, newState } = req.body;
  try {
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      return res.redirect('/custody?error=Evidence+item+not+found.');
    }

    const caseDoc = await Case.findById(evidence.caseId);
    if (!caseDoc) {
      return res.redirect('/custody?error=Associated+case+not+found.');
    }

    await recordEvidenceCustodyEvent({
      caseDoc,
      evidence,
      actor: req.investigator,
      action,
      reason: (reason || 'Routine evidentiary audit inspection').trim(),
      notes: (notes || '').trim(),
      newState: newState || action
    });

    res.redirect(`/evidence/${evidence._id}?success=${encodeURIComponent(`Custody action '${action}' recorded in tamper-evident ledger.`)}`);
  } catch (err) {
    res.redirect(`/custody?error=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
