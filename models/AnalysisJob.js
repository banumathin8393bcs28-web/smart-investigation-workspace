const mongoose = require('mongoose');

const analysisJobSchema = new mongoose.Schema({
  jobIdentifier: {
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
    default: 'CASE-LEVEL-ANALYSIS'
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  submitterName: {
    type: String,
    required: true
  },
  submissionTimestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Queued', 'Running', 'Completed', 'Failed'],
    default: 'Queued'
  },
  dataSourceType: {
    type: String,
    enum: ['forensic_disk_image', 'file_evidence', 'logical_directory'],
    default: 'file_evidence'
  },
  dataSourceFilename: {
    type: String,
    default: ''
  },
  dataSourceHash: {
    type: String,
    default: ''
  },
  autopsyCaseName: {
    type: String,
    required: true
  },
  modulesConfigured: [{
    type: String,
    trim: true
  }],
  workerId: {
    type: String,
    default: 'local-forensic-engine'
  },
  startedTimestamp: {
    type: Date,
    default: null
  },
  completedTimestamp: {
    type: Date,
    default: null
  },
  reportLocation: {
    type: String,
    default: ''
  },
  reportSummary: {
    type: String,
    default: ''
  },
  findingsCount: {
    type: Number,
    default: 0
  },
  findings: [{
    category: { type: String, default: 'General Artifact' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    sourcePath: { type: String, default: '' },
    artifactType: { type: String, default: 'File' },
    confidence: { type: String, default: 'Verified' },
    timestamp: { type: Date, default: Date.now }
  }],
  logOutput: {
    type: String,
    default: ''
  },
  failureReason: {
    type: String,
    default: ''
  }
});

analysisJobSchema.index({ caseId: 1 });
analysisJobSchema.index({ status: 1 });
analysisJobSchema.index({ submissionTimestamp: -1 });

module.exports = mongoose.model('AnalysisJob', analysisJobSchema);
