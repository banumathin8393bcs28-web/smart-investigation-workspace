const express = require('express');
const router = express.Router();
const EvidenceRequest = require('../models/EvidenceRequest');
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const Investigator = require('../models/Investigator');
const AuditLog = require('../models/AuditLog');
const { ensureAuthenticated } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');
const { recordEvidenceCustodyEvent } = require('../services/custodyService');

// 1. View Evidence Requests Dashboard
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.investigator._id;

    // Fetch requests where current investigator is recipient or requester
    const [incomingRequests, outgoingRequests, availableCases, investigators] = await Promise.all([
      EvidenceRequest.find({ requestedTo: userId }).sort({ createdAt: -1 }),
      EvidenceRequest.find({ requestedBy: userId }).sort({ createdAt: -1 }),
      Case.find().select('caseNumber caseName assignedInvestigators leadInvestigator'),
      Investigator.find({ _id: { $ne: userId } }).select('fullName role email')
    ]);

    res.render('evidence/requests', {
      title: 'Evidence Access & Sharing Requests - Smart Investigation Workspace',
      incomingRequests,
      outgoingRequests,
      availableCases,
      investigators,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error('[Evidence Requests Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Requests Fault',
      message: error.message
    });
  }
});

// 2. Submit New Evidence Access Request
router.post('/new', ensureAuthenticated, async (req, res) => {
  try {
    const { caseId, evidenceId, requestedTo, purpose } = req.body;

    if (!caseId || !requestedTo || !purpose) {
      return res.redirect('/evidence/requests?error=Please+complete+all+required+fields.');
    }

    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.redirect('/evidence/requests?error=Target+case+not+found.');
    }

    const custodian = await Investigator.findById(requestedTo);
    if (!custodian) {
      return res.redirect('/evidence/requests?error=Target+custodian+investigator+not+found.');
    }

    let evidenceDoc = null;
    if (evidenceId) {
      evidenceDoc = await Evidence.findById(evidenceId);
    }

    const count = await EvidenceRequest.countDocuments();
    const seq = String(count + 1).padStart(4, '0');
    const requestIdentifier = `REQ-${new Date().getFullYear()}-${seq}`;

    const newReq = await EvidenceRequest.create({
      requestIdentifier,
      caseId: caseDoc._id,
      caseNumber: caseDoc.caseNumber,
      evidenceId: evidenceDoc ? evidenceDoc._id : null,
      evidenceIdentifier: evidenceDoc ? evidenceDoc.evidenceIdentifier : 'ALL-CASE-EVIDENCE',
      requestedBy: req.investigator._id,
      requestedByName: req.investigator.fullName,
      requestedTo: custodian._id,
      requestedToName: custodian.fullName,
      purpose: purpose.trim(),
      status: 'Pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Notify Custodian
    await createNotification({
      recipientId: custodian._id,
      senderId: req.investigator._id,
      senderName: req.investigator.fullName,
      notificationType: 'evidence_request',
      title: `Evidence Request from ${req.investigator.fullName}`,
      text: `Requested access to ${evidenceDoc ? evidenceDoc.evidenceIdentifier : caseDoc.caseNumber}: "${purpose.substring(0, 50)}..."`,
      actionLink: `/evidence/requests`
    });

    // Audit Log
    await AuditLog.create({
      actor: req.investigator._id,
      actorName: req.investigator.fullName,
      action: 'EVIDENCE_REQUEST_FILED',
      relatedCase: caseDoc._id,
      caseNumber: caseDoc.caseNumber,
      relatedObjectIdentifier: requestIdentifier,
      changeSummary: `Evidence access request ${requestIdentifier} sent to ${custodian.fullName} for case ${caseDoc.caseNumber}.`,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date()
    });

    res.redirect(`/evidence/requests?success=${encodeURIComponent(`Evidence request ${requestIdentifier} submitted to ${custodian.fullName}.`)}`);
  } catch (error) {
    console.error('[Create Evidence Request Error]:', error);
    res.redirect(`/evidence/requests?error=${encodeURIComponent(error.message)}`);
  }
});

// 3. Respond to Request (Approve / Reject)
router.post('/:id/respond', ensureAuthenticated, async (req, res) => {
  try {
    const { decision, responseNotes } = req.body;
    const reqDoc = await EvidenceRequest.findById(req.params.id);

    if (!reqDoc) {
      return res.redirect('/evidence/requests?error=Request+record+not+found.');
    }

    // Security check: Must be the intended custodian
    if (reqDoc.requestedTo.toString() !== req.investigator._id.toString()) {
      return res.redirect('/evidence/requests?error=Unauthorized:+Only+assigned+custodian+may+authorize+sharing.');
    }

    const isApproved = decision === 'Approved';
    reqDoc.status = isApproved ? 'Approved' : 'Rejected';
    reqDoc.responseNotes = (responseNotes || '').trim();
    reqDoc.respondedBy = req.investigator.fullName;
    reqDoc.respondedAt = new Date();
    reqDoc.updatedAt = new Date();

    let evidenceDoc = null;
    if (reqDoc.evidenceId) {
      evidenceDoc = await Evidence.findById(reqDoc.evidenceId);
      if (evidenceDoc && isApproved) {
        reqDoc.fileHashAtShare = evidenceDoc.sha256Hash;
      }
    }

    await reqDoc.save();

    // If approved and associated with evidence, record Custody Event
    if (isApproved && evidenceDoc) {
      const caseDoc = await Case.findById(reqDoc.caseId);
      if (caseDoc) {
        await recordEvidenceCustodyEvent({
          caseDoc,
          evidence: evidenceDoc,
          actor: req.investigator,
          action: 'Evidence Transferred',
          reason: `Access authorized via request ${reqDoc.requestIdentifier}`,
          notes: `Authorized for investigator ${reqDoc.requestedByName}. Verified hash: ${evidenceDoc.sha256Hash.substring(0, 16)}...`
        });
      }
    }

    // Notify Requester
    await createNotification({
      recipientId: reqDoc.requestedBy,
      senderId: req.investigator._id,
      senderName: req.investigator.fullName,
      notificationType: 'evidence_response',
      title: `Evidence Request ${reqDoc.status}`,
      text: `${req.investigator.fullName} marked request ${reqDoc.requestIdentifier} as ${reqDoc.status}. Notes: ${reqDoc.responseNotes || 'None'}`,
      actionLink: `/evidence/requests`
    });

    // Audit Log
    await AuditLog.create({
      actor: req.investigator._id,
      actorName: req.investigator.fullName,
      action: isApproved ? 'EVIDENCE_REQUEST_APPROVED' : 'EVIDENCE_REQUEST_REJECTED',
      relatedCase: reqDoc.caseId,
      caseNumber: reqDoc.caseNumber,
      relatedObjectIdentifier: reqDoc.requestIdentifier,
      changeSummary: `Request ${reqDoc.requestIdentifier} ${reqDoc.status.toLowerCase()} by ${req.investigator.fullName}.`,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date()
    });

    res.redirect(`/evidence/requests?success=${encodeURIComponent(`Request ${reqDoc.requestIdentifier} marked as ${reqDoc.status}.`)}`);
  } catch (error) {
    console.error('[Respond Evidence Request Error]:', error);
    res.redirect(`/evidence/requests?error=${encodeURIComponent(error.message)}`);
  }
});

module.exports = router;
