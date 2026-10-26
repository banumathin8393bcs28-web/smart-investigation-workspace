const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    default: null
  },
  actorName: {
    type: String,
    default: 'System'
  },
  action: {
    type: String,
    required: true,
    trim: true
  },
  relatedCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    default: null
  },
  caseNumber: {
    type: String,
    default: ''
  },
  relatedEvidence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evidence',
    default: null
  },
  relatedObjectIdentifier: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: '127.0.0.1'
  },
  userAgent: {
    type: String,
    default: ''
  },
  changeSummary: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ relatedCase: 1 });
auditLogSchema.index({ actor: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
