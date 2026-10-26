const Custody = require('../models/Custody');
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const AuditLog = require('../models/AuditLog');
const { getNextCustodyEventId } = require('./caseNumberService');
const { createNotification } = require('./notificationService');

/**
 * Initiates a case assignment transfer request
 */
async function initiateCaseTransfer({
  caseDoc,
  fromInvestigator,
  toInvestigator,
  reason,
  notes = ''
}) {
  const eventId = await getNextCustodyEventId();
  const now = new Date();

  // Create pending custody event record
  const custodyRecord = await Custody.create({
    eventId,
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    evidenceId: null,
    evidenceIdentifier: '',
    actor: fromInvestigator._id,
    actorName: fromInvestigator.fullName,
    action: 'Case Transferred',
    transferor: fromInvestigator._id,
    transferorName: fromInvestigator.fullName,
    recipient: toInvestigator._id,
    recipientName: toInvestigator.fullName,
    previousState: `Assigned to ${fromInvestigator.fullName}`,
    newState: `Transfer Pending to ${toInvestigator.fullName}`,
    reason,
    notes,
    status: 'Pending',
    eventTimestamp: now
  });

  // Record AuditLog
  await AuditLog.create({
    actor: fromInvestigator._id,
    actorName: fromInvestigator.fullName,
    action: 'CASE_TRANSFER_INITIATED',
    relatedCase: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    changeSummary: `Transfer request initiated to ${toInvestigator.fullName} (${toInvestigator.email}). Reason: ${reason}`,
    timestamp: now
  });

  // Send Notification to recipient
  await createNotification({
    recipientId: toInvestigator._id,
    senderId: fromInvestigator._id,
    senderName: fromInvestigator.fullName,
    notificationType: 'case_transfer',
    title: `Case Transfer Request: ${caseDoc.caseNumber}`,
    text: `${fromInvestigator.fullName} requested to transfer ${caseDoc.caseNumber} ("${caseDoc.caseName}") to you.`,
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    relatedId: custodyRecord._id.toString(),
    actionLink: `/custody`
  });

  return custodyRecord;
}

/**
 * Responds to a transfer request (Accept or Reject)
 */
async function respondToTransfer({
  custodyRecordId,
  investigator,
  response, // 'Accept' or 'Reject'
  responseNotes = ''
}) {
  const record = await Custody.findById(custodyRecordId);
  if (!record) {
    throw new Error('Custody record not found');
  }

  if (record.recipient.toString() !== investigator._id.toString()) {
    throw new Error('Unauthorized: You are not the designated recipient of this transfer.');
  }

  if (record.status !== 'Pending') {
    throw new Error(`This transfer is already marked as ${record.status}.`);
  }

  const now = new Date();
  const caseDoc = await Case.findById(record.caseId);

  if (response === 'Accept') {
    record.status = 'Completed';
    record.acknowledgementDetails = {
      acknowledgedBy: investigator._id,
      acknowledgedByName: investigator.fullName,
      acknowledgementNotes: responseNotes || 'Transfer accepted and acknowledged.',
      acknowledgedTimestamp: now
    };
    record.newState = `Assigned to ${investigator.fullName}`;
    await record.save();

    // If it's a case transfer, update case assignment!
    if (caseDoc && !record.evidenceId) {
      caseDoc.assignedInvestigator = investigator._id;
      caseDoc.assignedName = investigator.fullName;
      caseDoc.status = 'Transferred';
      caseDoc.lastUpdatedTimestamp = now;
      caseDoc.lastUpdatedBy = investigator._id;
      caseDoc.lastUpdatedByName = investigator.fullName;
      if (!caseDoc.collaborators.includes(record.transferor)) {
        caseDoc.collaborators.push(record.transferor);
      }
      await caseDoc.save();
    }

    // If it's an evidence transfer, update evidence custodian!
    if (record.evidenceId) {
      await Evidence.findByIdAndUpdate(record.evidenceId, {
        currentCustodian: investigator._id,
        currentCustodianName: investigator.fullName,
        custodyStatus: 'Transferred',
        lastModifiedTimestamp: now
      });
    }

    // Record AuditLog
    await AuditLog.create({
      actor: investigator._id,
      actorName: investigator.fullName,
      action: 'TRANSFER_ACCEPTED',
      relatedCase: record.caseId,
      caseNumber: record.caseNumber,
      changeSummary: `Custody/assignment transfer of ${record.caseNumber} accepted by ${investigator.fullName}.`,
      timestamp: now
    });

    // Notify transferor
    if (record.transferor) {
      await createNotification({
        recipientId: record.transferor,
        senderId: investigator._id,
        senderName: investigator.fullName,
        notificationType: 'transfer_accept',
        title: `Transfer Accepted: ${record.caseNumber}`,
        text: `${investigator.fullName} accepted the transfer of ${record.caseNumber}.`,
        caseId: record.caseId,
        caseNumber: record.caseNumber,
        actionLink: `/cases/${record.caseId}`
      });
    }
  } else {
    // Rejection
    record.status = 'Rejected';
    record.acknowledgementDetails = {
      acknowledgedBy: investigator._id,
      acknowledgedByName: investigator.fullName,
      acknowledgementNotes: responseNotes || 'Transfer declined by recipient.',
      acknowledgedTimestamp: now
    };
    record.newState = `Transfer Rejected - Retained by ${record.transferorName}`;
    await record.save();

    // Record AuditLog
    await AuditLog.create({
      actor: investigator._id,
      actorName: investigator.fullName,
      action: 'TRANSFER_REJECTED',
      relatedCase: record.caseId,
      caseNumber: record.caseNumber,
      changeSummary: `Transfer of ${record.caseNumber} declined by ${investigator.fullName}. Reason: ${responseNotes}`,
      timestamp: now
    });

    // Notify transferor
    if (record.transferor) {
      await createNotification({
        recipientId: record.transferor,
        senderId: investigator._id,
        senderName: investigator.fullName,
        notificationType: 'transfer_reject',
        title: `Transfer Rejected: ${record.caseNumber}`,
        text: `${investigator.fullName} declined transfer of ${record.caseNumber}. Reason: ${responseNotes || 'None provided'}`,
        caseId: record.caseId,
        caseNumber: record.caseNumber,
        actionLink: `/cases/${record.caseId}`
      });
    }
  }

  return record;
}

/**
 * Records an immutable custody event for an evidence item
 */
async function recordEvidenceCustodyEvent({
  caseDoc,
  evidence,
  actor,
  action, // 'Evidence Received', 'Evidence Viewed', 'Evidence Transferred', 'Evidence Returned', 'Evidence Sealed', 'Other'
  reason,
  notes = '',
  newState = ''
}) {
  const eventId = await getNextCustodyEventId();
  const now = new Date();

  const record = await Custody.create({
    eventId,
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    evidenceId: evidence._id,
    evidenceIdentifier: evidence.evidenceIdentifier,
    actor: actor._id,
    actorName: actor.fullName,
    action,
    transferor: actor._id,
    transferorName: actor.fullName,
    previousState: evidence.custodyStatus,
    newState: newState || action,
    reason,
    notes,
    status: 'Recorded',
    evidenceSha256: evidence.sha256Hash,
    eventTimestamp: now
  });

  await AuditLog.create({
    actor: actor._id,
    actorName: actor.fullName,
    action: `EVIDENCE_${action.toUpperCase().replace(/\s+/g, '_')}`,
    relatedCase: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    relatedEvidence: evidence._id,
    relatedObjectIdentifier: evidence.evidenceIdentifier,
    changeSummary: `Evidence custody event '${action}' logged. SHA-256: ${evidence.sha256Hash.substring(0, 16)}...`,
    timestamp: now
  });

  return record;
}

module.exports = {
  initiateCaseTransfer,
  respondToTransfer,
  recordEvidenceCustodyEvent
};
