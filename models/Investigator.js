const mongoose = require('mongoose');

const investigatorSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: 120
  },
  role: {
    type: String,
    required: [true, 'Investigator designation/role is required'],
    trim: true,
    default: 'Investigator'
  },
  profilePhoto: {
    type: String,
    default: '/images/default-avatar.png'
  },
  dob: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  age: {
    type: Number,
    required: [true, 'Age is required'],
    min: [18, 'Investigator must be at least 18 years of age'],
    max: [80, 'Investigator age cannot exceed 80']
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
    required: [true, 'Gender is required']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Official email address is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+@gov\.in$/, 'Official email must follow xxx.yyy@gov.in format']
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 40
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  securityQuestion: {
    type: String,
    required: [true, 'Security question selection is required']
  },
  securityAnswer: {
    type: String,
    required: [true, 'Security question answer hash is required']
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  emailVerificationAttempts: {
    type: Number,
    default: 0
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockoutUntil: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

investigatorSchema.index({ role: 1 });

module.exports = mongoose.model('Investigator', investigatorSchema);
