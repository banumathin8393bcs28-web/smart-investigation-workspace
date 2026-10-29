const mongoose = require('mongoose');

const criminalRecordSchema = new mongoose.Schema({
  recordNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  fullName: {
    type: String,
    required: [true, 'Subject legal full name is required'],
    trim: true
  },
  alias: {
    type: String,
    default: 'None',
    trim: true
  },
  nationalId: {
    type: String,
    default: '',
    trim: true
  },
  photo: {
    type: String,
    default: '/images/default-suspect.png'
  },
  photoGridFsId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', 'Unknown'],
    default: 'Unknown'
  },
  dob: {
    type: Date,
    default: null
  },
  age: {
    type: Number,
    default: null
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  address: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: ['Wanted', 'In Custody', 'Under Surveillance', 'Person of Interest', 'Cleared', 'Convicted'],
    default: 'Person of Interest'
  },
  riskLevel: {
    type: String,
    enum: ['Extreme', 'High', 'Moderate', 'Low'],
    default: 'Moderate'
  },
  physicalTraits: {
    height: { type: String, default: 'Not recorded' },
    eyeColor: { type: String, default: 'Not recorded' },
    hairColor: { type: String, default: 'Not recorded' },
    identifyingMarks: { type: String, default: 'None noted' }
  },
  priorOffenses: [{
    offense: { type: String, required: true },
    statute: { type: String, default: '' },
    convictionDate: { type: Date, default: null },
    sentence: { type: String, default: '' },
    jurisdiction: { type: String, default: 'State Forensic Authority' }
  }],
  connectedCases: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  }],
  interrogationNotes: [{
    date: { type: Date, default: Date.now },
    investigatorName: { type: String, required: true },
    notes: { type: String, required: true }
  }],
  registeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  registeredByName: {
    type: String,
    required: true
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

criminalRecordSchema.index({ fullName: 'text', alias: 'text', nationalId: 'text' });
criminalRecordSchema.index({ status: 1 });
criminalRecordSchema.index({ connectedCases: 1 });

module.exports = mongoose.model('CriminalRecord', criminalRecordSchema);
