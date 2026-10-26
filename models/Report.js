const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportIdentifier: {
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
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  generatorName: {
    type: String,
    required: true
  },
  generatorEmail: {
    type: String,
    required: true
  },
  protectedFileReference: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  pdfSha256Hash: {
    type: String,
    required: true
  },
  generationTimestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

reportSchema.index({ caseId: 1 });

module.exports = mongoose.model('Report', reportSchema);
