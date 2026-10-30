const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  evidenceIdentifier: {
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
  sceneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scene',
    default: null
  },
  originalFilename: {
    type: String,
    required: true
  },
  storedFilename: {
    type: String,
    required: true
  },
  storageKey: {
    type: String,
    default: ''
  },
  gridFsId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  protectedStoragePath: {
    type: String,
    required: true
  },
  thumbnailPath: {
    type: String,
    default: ''
  },
  thumbnailGridFsId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  thumbnailDataUri: {
    type: String,
    default: ''
  },
  fileMimeType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  imageProperties: {
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    format: { type: String, default: '' },
    colorSpace: { type: String, default: '' },
    channels: { type: Number, default: 0 },
    orientation: { type: Number, default: 1 }
  },
  availableMetadata: {
    hasExif: { type: Boolean, default: false },
    make: { type: String, default: 'Not specified' },
    model: { type: String, default: 'Not specified' },
    dateTimeOriginal: { type: String, default: 'Not recorded' },
    orientation: { type: Number, default: 1 },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    rawExifSummary: { type: String, default: 'No EXIF metadata available.' }
  },
  sha256Hash: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  uploaderName: {
    type: String,
    required: true
  },
  uploadTimestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  inspectionStatus: {
    type: String,
    enum: ['Uninspected', 'Pending', 'Inspected', 'Failed'],
    default: 'Uninspected'
  },
  currentCustodian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  currentCustodianName: {
    type: String,
    required: true
  },
  custodyStatus: {
    type: String,
    enum: ['In Custody', 'Transferred', 'Sealed', 'Released', 'Archived'],
    default: 'In Custody'
  },
  lastModifiedTimestamp: {
    type: Date,
    default: Date.now
  }
});

evidenceSchema.index({ caseId: 1 });
evidenceSchema.index({ sha256Hash: 1 });
evidenceSchema.index({ currentCustodian: 1 });

module.exports = mongoose.model('Evidence', evidenceSchema);
