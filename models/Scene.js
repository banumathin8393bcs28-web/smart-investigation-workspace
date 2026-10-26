const mongoose = require('mongoose');

const sceneSchema = new mongoose.Schema({
  sceneIdentifier: {
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
  sceneDetails: {
    type: String,
    required: true
  },
  sceneImages: [{
    type: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigator',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

sceneSchema.index({ caseId: 1 });

module.exports = mongoose.model('Scene', sceneSchema);
