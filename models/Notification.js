const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    default: null
  },
  senderName: {
    type: String,
    default: 'System'
  },
  notificationType: {
    type: String,
    enum: [
      'message',
      'contact_request',
      'contact_accept',
      'case_transfer',
      'evidence_transfer',
      'transfer_accept',
      'transfer_reject',
      'shared_report',
      'case_update'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  notificationText: {
    type: String,
    required: true,
    trim: true
  },
  relatedCaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    default: null
  },
  caseNumber: {
    type: String,
    default: ''
  },
  relatedId: {
    type: String,
    default: ''
  },
  actionLink: {
    type: String,
    default: ''
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdTimestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  readTimestamp: {
    type: Date,
    default: null
  }
});

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdTimestamp: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
