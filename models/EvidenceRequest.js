const mongoose = require('mongoose');

const evidenceRequestSchema = new mongoose.Schema({
  requestIdentifier: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
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
    default: 'ALL-CASE-EVIDENCE'
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  requestedByName: {
    type: String,
    required: true
  },
  requestedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  requestedToName: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    required: [true, 'Forensic necessity/purpose is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Fulfilled', 'Cancelled'],
    default: 'Pending'
  },
  responseNotes: {
    type: String,
    default: ''
  },
  respondedBy: {
    type: String,
    default: ''
  },
  respondedAt: {
    type: Date,
    default: null
  },
  fileHashAtShare: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

evidenceRequestSchema.index({ requestedTo: 1, status: 1 });
evidenceRequestSchema.index({ requestedBy: 1 });
evidenceRequestSchema.index({ caseId: 1 });

module.exports = mongoose.model('EvidenceRequest', evidenceRequestSchema);
