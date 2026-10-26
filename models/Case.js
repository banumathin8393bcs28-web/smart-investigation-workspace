const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  caseNumber: {
    type: String,
    required: [true, 'Case number is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  caseName: {
    type: String,
    required: [true, 'Case name/title is required'],
    trim: true,
    maxlength: 200
  },
  crimeType: {
    type: String,
    required: [true, 'Crime type is required'],
    enum: [
      'Theft',
      'Murder',
      'Robbery',
      'Assault',
      'Burglary',
      'Cybercrime',
      'Fraud',
      'Missing Person',
      'Drug-Related Crime',
      'Other'
    ]
  },
  crimeTypeOther: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['New', 'Under Investigation', 'Pending', 'Transferred', 'Closed'],
    default: 'New'
  },
  incidentDate: {
    type: Date,
    required: [true, 'Incident date is required']
  },
  incidentTime: {
    type: String,
    required: [true, 'Incident time is required']
  },
  incidentLocation: {
    type: String,
    required: [true, 'Incident location is required'],
    trim: true
  },
  crimeSceneAddress: {
    type: String,
    trim: true,
    default: ''
  },
  caseDescription: {
    type: String,
    required: [true, 'Case description is required'],
    trim: true
  },
  reportingInvestigator: {
    type: String,
    required: [true, 'Reporting investigator is required'],
    trim: true
  },
  department: {
    type: String,
    trim: true,
    default: 'General Crime Branch'
  },
  victimDetails: {
    type: String,
    trim: true,
    default: ''
  },
  suspectDetails: {
    type: String,
    trim: true,
    default: ''
  },
  witnessDetails: {
    type: String,
    trim: true,
    default: ''
  },
  preliminaryFindings: {
    type: String,
    trim: true,
    default: ''
  },
  knownObjects: {
    type: String,
    trim: true,
    default: '' // contextual object terms for AI analysis e.g. knife, gun, bag, car, phone
  },
  additionalNotes: {
    type: String,
    trim: true,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  creatorName: {
    type: String,
    required: true
  },
  assignedInvestigator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  assignedName: {
    type: String,
    required: true
  },
  collaborators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator'
  }],
  creationTimestamp: {
    type: Date,
    default: Date.now,
    immutable: true // Original creation timestamp must remain unchanged when edited
  },
  lastUpdatedTimestamp: {
    type: Date,
    default: Date.now
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    default: null
  },
  lastUpdatedByName: {
    type: String,
    default: ''
  }
}, {
  timestamps: false // Manually managed authoritative UTC timestamps
});

caseSchema.index({ assignedInvestigator: 1 });
caseSchema.index({ createdBy: 1 });
caseSchema.index({ status: 1 });

module.exports = mongoose.model('Case', caseSchema);
