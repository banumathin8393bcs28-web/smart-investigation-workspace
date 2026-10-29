const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Investigator = require('../models/Investigator');
const AuditLog = require('../models/AuditLog');
const { ensureAuthenticated } = require('../middleware/auth');
const { uploadProfile } = require('../middleware/upload');
const { GOV_EMAIL_REGEX, PASSWORD_REGEX } = require('../middleware/validation');
const { saveToStorage } = require('../services/storageService');

// View & Edit Profile
router.get('/edit', ensureAuthenticated, (req, res) => {
  res.render('profile/edit', {
    title: 'Edit Profile - Smart Investigation Workspace',
    investigator: req.investigator,
    errors: {},
    successMsg: null
  });
});

// Update Profile Details
router.post('/edit', ensureAuthenticated, uploadProfile.single('profilePhoto'), async (req, res) => {
  const investigator = req.investigator;
  const { fullName, role, phone, gender } = req.body;
  const errors = {};

  if (!fullName || fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.';
  }
  if (!phone || !/^\+?[0-9\s\-()]{10,15}$/.test(phone.trim())) {
    errors.phone = 'Valid 10-15 digit phone number is required.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).render('profile/edit', {
      title: 'Edit Profile - Smart Investigation Workspace',
      investigator,
      errors,
      successMsg: null
    });
  }

  try {
    const changes = [];
    if (fullName && fullName.trim() !== investigator.fullName) {
      changes.push(`Name: '${investigator.fullName}' -> '${fullName.trim()}'`);
      investigator.fullName = fullName.trim();
    }
    if (role && role.trim() !== investigator.role) {
      changes.push(`Role: '${investigator.role}' -> '${role.trim()}'`);
      investigator.role = role.trim();
    }
    if (phone && phone.trim() !== investigator.phone) {
      changes.push(`Phone: '${investigator.phone}' -> '${phone.trim()}'`);
      investigator.phone = phone.trim();
    }
    if (gender && gender !== investigator.gender) {
      changes.push(`Gender: '${investigator.gender}' -> '${gender}'`);
      investigator.gender = gender;
    }

    if (req.file) {
      investigator.profilePhoto = `/uploads/profiles/${req.file.filename}`;
      try {
        const storageResult = await saveToStorage({
          filePath: req.file.path,
          filename: req.file.filename,
          mimeType: req.file.mimetype,
          bucketName: 'profile_bucket',
          metadata: { investigatorId: investigator._id }
        });
        investigator.profilePhotoKey = storageResult.storageKey;
        investigator.profilePhotoGridFsId = storageResult.gridFsId;
      } catch (storageErr) {
        console.warn('[Profile Edit] Persistent photo storage warning:', storageErr.message);
      }
      changes.push('Profile photograph replaced');
    }

    investigator.updatedAt = new Date();
    await investigator.save();

    if (changes.length > 0) {
      await AuditLog.create({
        actor: investigator._id,
        actorName: investigator.fullName,
        action: 'PROFILE_UPDATED',
        changeSummary: `Profile updated by ${investigator.fullName}: ${changes.join(', ')}`,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        timestamp: new Date()
      });
    }

    res.render('profile/edit', {
      title: 'Edit Profile - Smart Investigation Workspace',
      investigator,
      errors: {},
      successMsg: 'Profile updated successfully.'
    });
  } catch (err) {
    console.error('[Profile Update Error]:', err);
    res.status(500).render('profile/edit', {
      title: 'Edit Profile - Smart Investigation Workspace',
      investigator,
      errors: { general: 'Failed to update profile records.' },
      successMsg: null
    });
  }
});

// Change Password with current password re-authentication
router.post('/change-password', ensureAuthenticated, async (req, res) => {
  const investigator = req.investigator;
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const errors = {};

  if (!currentPassword) {
    errors.currentPassword = 'Current password is required for verification.';
  }
  if (!newPassword || !PASSWORD_REGEX.test(newPassword)) {
    errors.newPassword = 'New password must have >=8 chars, uppercase, lowercase, number, and special character.';
  }
  if (newPassword !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).render('profile/edit', {
      title: 'Edit Profile - Smart Investigation Workspace',
      investigator,
      errors,
      successMsg: null
    });
  }

  try {
    const isMatch = await bcrypt.compare(currentPassword, investigator.password);
    if (!isMatch) {
      return res.status(400).render('profile/edit', {
        title: 'Edit Profile - Smart Investigation Workspace',
        investigator,
        errors: { currentPassword: 'Incorrect current password.' },
        successMsg: null
      });
    }

    const salt = await bcrypt.genSalt(10);
    investigator.password = await bcrypt.hash(newPassword, salt);
    investigator.updatedAt = new Date();
    await investigator.save();

    await AuditLog.create({
      actor: investigator._id,
      actorName: investigator.fullName,
      action: 'PASSWORD_CHANGED',
      changeSummary: `Password changed with re-authentication by ${investigator.fullName}.`,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date()
    });

    res.render('profile/edit', {
      title: 'Edit Profile - Smart Investigation Workspace',
      investigator,
      errors: {},
      successMsg: 'Password changed successfully.'
    });
  } catch (err) {
    console.error('[Password Change Error]:', err);
    res.status(500).render('profile/edit', {
      title: 'Edit Profile - Smart Investigation Workspace',
      investigator,
      errors: { general: 'Failed to update password.' },
      successMsg: null
    });
  }
});

module.exports = router;
