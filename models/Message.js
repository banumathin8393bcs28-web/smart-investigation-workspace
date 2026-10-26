const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  recipientName: {
    type: String,
    required: true
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    default: null
  },
  messageText: {
    type: String,
    trim: true,
    default: ''
  },
  attachments: [{
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    sha256: { type: String, required: true }
  }],
  sentTimestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  deliveryStatus: {
    type: String,
    enum: ['Sent', 'Delivered', 'Read'],
    default: 'Sent'
  },
  readTimestamp: {
    type: Date,
    default: null
  }
});

messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ recipient: 1, deliveryStatus: 1 });
messageSchema.index({ sentTimestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);
