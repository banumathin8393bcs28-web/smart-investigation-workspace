const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { isAuthenticated } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

const PREDEFINED_QUESTIONS = [
  'What is the name of your first elementary school?',
  'In what city was your mother born?',
  'What was the make/brand of your first vehicle?',
  'What is the last name of your favorite teacher?',
  'What was the street name of your childhood home?',
  'What was the name of your first childhood pet?'
];

// GET /profile/edit
router.get('/edit', isAuthenticated, async (req, res) => {
  const user = await User.findById(req.user._id);
  res.render('profile/edit', {
    title: 'Investigator Profile & Security Settings | Smart Investigation Workspace',
    user,
    questions: PREDEFINED_QUESTIONS,
    error: req.query.error || null,
    success: req.query.success || null
  });
});

// POST /profile/edit
router.post('/edit', isAuthenticated, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      badgeId,
      department,
      rank,
      bio,
      securityQuestion,
      customQuestion,
      securityAnswer,
      currentPassword,
      newPassword,
      confirmNewPassword
    } = req.body;

    const user = await User.findById(req.user._id);
    const updates = {};

    // 1. Validate Email
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      if (!User.validateEmail(email)) {
        return res.redirect('/profile/edit?error=Invalid Email Address format.');
      }
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing && existing._id !== user._id) {
        return res.redirect('/profile/edit?error=Email address already assigned to another investigator.');
      }
      updates.email = email.toLowerCase().trim();
    }

    // 2. Validate Phone
    if (phone) {
      if (!User.validatePhone(phone)) {
        return res.redirect('/profile/edit?error=Invalid Phone Number format. Must be at least 10 digits.');
      }
      updates.phone = phone.trim();
    }

    if (name) updates.name = name.trim();
    if (badgeId) updates.badgeId = badgeId.trim().toUpperCase();
    if (department) updates.department = department.trim();
    if (rank) updates.rank = rank.trim();
    if (bio !== undefined) updates.bio = bio.trim();

    // 3. Avatar upload
    if (req.file) {
      updates.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    // 4. Update Security Question & One-word answer
    if (securityAnswer && securityAnswer.trim().length > 0) {
      if (!User.validateSecurityAnswer(securityAnswer)) {
        return res.redirect('/profile/edit?error=Security Answer must be ONE single word with no spaces.');
      }
      const finalQuestion = (securityQuestion === 'custom' ? customQuestion : securityQuestion) || user.securityQuestion;
      updates.securityQuestion = finalQuestion;
      updates.securityAnswer = securityAnswer.trim().toLowerCase();
    }

    // 5. Update Password
    if (newPassword && newPassword.length > 0) {
      if (!currentPassword) {
        return res.redirect('/profile/edit?error=You must enter your current password to authorize a password change.');
      }
      const isMatch = await User.comparePassword(currentPassword, user.password);
      if (!isMatch) {
        return res.redirect('/profile/edit?error=Current password incorrect.');
      }
      if (newPassword !== confirmNewPassword) {
        return res.redirect('/profile/edit?error=New passwords do not match.');
      }
      if (!User.validatePassword(newPassword)) {
        return res.redirect('/profile/edit?error=New password must have at least 8 characters, with uppercase, lowercase, digit, and special symbol.');
      }
      updates.password = newPassword;
    }

    await User.findByIdAndUpdate(user._id, updates);

    await AuditLog.log({
      investigator: user.name,
      badgeId: user.badgeId,
      action: 'PROFILE_UPDATED',
      targetType: 'User',
      targetId: user._id,
      details: 'Investigator updated profile information, credentials or security question.',
      ipAddress: req.ip
    });

    res.redirect('/profile/edit?success=Profile and security credentials successfully updated.');
  } catch (err) {
    console.error('Profile update error:', err);
    res.redirect('/profile/edit?error=An error occurred while updating profile.');
  }
});

module.exports = router;
