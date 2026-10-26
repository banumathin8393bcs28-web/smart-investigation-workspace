const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected'],
    default: 'Pending'
  },
  displayName: {
    type: String,
    trim: true,
    default: ''
  },
  requestNotes: {
    type: String,
    trim: true,
    default: ''
  },
  creationTimestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedTimestamp: {
    type: Date,
    default: Date.now
  }
});

contactSchema.index({ owner: 1, contact: 1 }, { unique: true });

module.exports = mongoose.model('Contact', contactSchema);
