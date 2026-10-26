const mongoose = require('mongoose');

const aiInspectionSchema = new mongoose.Schema({
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
    required: true
  },
  evidenceIdentifier: {
    type: String,
    required: true
  },
  extractedSearchTerms: [{
    type: String
  }],
  modelName: {
    type: String,
    default: 'Ultralytics YOLOv8'
  },
  modelVersion: {
    type: String,
    default: '8.1.0-forensic'
  },
  confidenceThreshold: {
    type: Number,
    default: 0.25
  },
  detections: [{
    label: { type: String, required: true },
    confidence: { type: Number, required: true },
    boundingBox: {
      x: { type: Number, required: true },      // percentage 0-100 or pixels
      y: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true }
    },
    isContextMatch: { type: Boolean, default: false },
    notes: { type: String, default: '' }
  }],
  detectionLabels: [{
    type: String
  }],
  confidenceScores: [{
    type: Number
  }],
  annotatedImageReference: {
    type: String,
    default: ''
  },
  annotatedSha256: {
    type: String,
    default: ''
  },
  inspectionStatus: {
    type: String,
    enum: ['Success', 'No Objects Detected', 'Service Unavailable', 'Failed'],
    required: true
  },
  errorInformation: {
    type: String,
    default: null
  },
  summaryMessage: {
    type: String,
    default: ''
  },
  disclaimer: {
    type: String,
    default: 'AI object detections are computer vision predictions intended for preliminary investigative assistance only. They do not constitute conclusive forensic proof that an object was used in the commission of a crime, nor does non-detection prove an object is absent.'
  },
  inspectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  inspectedByName: {
    type: String,
    required: true
  },
  inspectionTimestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

aiInspectionSchema.index({ evidenceId: 1 });
aiInspectionSchema.index({ caseId: 1 });

module.exports = mongoose.model('AIInspection', aiInspectionSchema);
