const mongoose = require('mongoose');

const custodySchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  caseNumber: {
    type: String,
    required: true
  },
  evidenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evidence',
    default: null
  },
  evidenceIdentifier: {
    type: String,
    default: ''
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  actorName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: [
      'Evidence Received',
      'Evidence Viewed',
      'Evidence Transferred',
      'Evidence Returned',
      'Evidence Sealed',
      'Case Transferred',
      'Transfer Accepted',
      'Transfer Rejected',
      'Evidence Submitted for Analysis',
      'Analysis Completed',
      'Other'
    ],
    required: true
  },
  transferor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    default: null
  },
  transferorName: {
    type: String,
    default: ''
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    default: null
  },
  recipientName: {
    type: String,
    default: ''
  },
  previousState: {
    type: String,
    default: ''
  },
  newState: {
    type: String,
    default: ''
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Rejected', 'Recorded'],
    default: 'Recorded'
  },
  acknowledgementDetails: {
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Investigator', default: null },
    acknowledgedByName: { type: String, default: '' },
    acknowledgementNotes: { type: String, default: '' },
    acknowledgedTimestamp: { type: Date, default: null }
  },
  evidenceSha256: {
    type: String,
    default: ''
  },
  eventTimestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

custodySchema.index({ caseId: 1, eventTimestamp: -1 });
custodySchema.index({ evidenceId: 1 });
custodySchema.index({ recipient: 1, status: 1 });

module.exports = mongoose.model('Custody', custodySchema);
