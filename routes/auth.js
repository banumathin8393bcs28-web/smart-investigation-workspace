const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const svgCaptcha = require('svg-captcha');
const nodemailer = require('nodemailer');
const Investigator = require('../models/Investigator');
const AuditLog = require('../models/AuditLog');
const { uploadProfile } = require('../middleware/upload');
const { validateRegistration, validateLogin, handleValidationErrors } = require('../middleware/validation');
const { redirectIfAuthenticated, ensureAuthenticated } = require('../middleware/auth');
const { formatTimestamp } = require('../services/timestampService');

// Reusable CAPTCHA generator
function generateCaptcha(req) {
  const captcha = svgCaptcha.create({
    size: 5,
    noise: 3,
    color: true,
    background: '#f8f9fa',
    width: 140,
    height: 40,
    fontSize: 36
  });
  req.session.captcha = captcha.text;
  return captcha.data;
}

// CAPTCHA endpoint for dynamic refresh
router.get('/captcha', (req, res) => {
  const svg = generateCaptcha(req);
  res.type('svg');
  res.status(200).send(svg);
});

// Registration Page
router.get('/register', redirectIfAuthenticated, (req, res) => {
  const captchaSvg = generateCaptcha(req);
  res.render('auth/register', {
    title: 'Investigator Registration - Smart Investigation Workspace',
    captchaSvg,
    formData: {},
    errors: {}
  });
});

// Process Registration
router.post('/register', redirectIfAuthenticated, uploadProfile.single('profilePhoto'), validateRegistration, async (req, res) => {
  const validation = handleValidationErrors(req);
  if (validation.hasErrors) {
    const captchaSvg = generateCaptcha(req);
    return res.status(400).render('auth/register', {
      title: 'Investigator Registration - Smart Investigation Workspace',
      captchaSvg,
      formData: req.body,
      errors: validation.errors
    });
  }

  const {
    fullName,
    role,
    dob,
    gender,
    phone,
    email,
    username,
    password,
    securityQuestion,
    securityAnswer
  } = req.body;

  try {
    // Check duplicates
    const existingEmail = await Investigator.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      const captchaSvg = generateCaptcha(req);
      return res.status(400).render('auth/register', {
        title: 'Investigator Registration - Smart Investigation Workspace',
        captchaSvg,
        formData: req.body,
        errors: { email: 'Official email address is already registered.' }
      });
    }

    const existingUsername = await Investigator.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      const captchaSvg = generateCaptcha(req);
      return res.status(400).render('auth/register', {
        title: 'Investigator Registration - Smart Investigation Workspace',
        captchaSvg,
        formData: req.body,
        errors: { username: 'Username is already taken. Please choose another.' }
      });
    }

    // Hash password with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Hash normalized single-word security answer with bcryptjs
    const normalizedAnswer = securityAnswer.trim().toLowerCase();
    const securityAnswerHash = await bcrypt.hash(normalizedAnswer, salt);

    // Profile photo path
    let profilePhotoPath = '/images/default-avatar.png';
    if (req.file) {
      profilePhotoPath = `/uploads/profiles/${req.file.filename}`;
    }

    // SMTP verification token handling
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let isEmailVerified = false;
    let devEmailMessage = null;

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@investigation.gov.in',
          to: email.toLowerCase(),
          subject: 'Smart Investigation Workspace - Verification Code',
          text: `Your investigator account verification code is: ${verificationToken}. Valid for 24 hours.`
        });
      } catch (smtpErr) {
        console.warn('[Nodemailer] SMTP send failed:', smtpErr.message);
        devEmailMessage = `Development Notice: SMTP could not deliver email (${smtpErr.message}). Verification code for testing: ${verificationToken}`;
      }
    } else {
      // Development mode
      isEmailVerified = true; // Auto-verify in local development mode without configured SMTP
      devEmailMessage = 'Local Development Mode: SMTP credentials not configured in .env. Account has been auto-verified for testing.';
    }

    const investigator = await Investigator.create({
      fullName: fullName.trim(),
      role: role.trim(),
      profilePhoto: profilePhotoPath,
      dob: new Date(dob),
      age: req.calculatedAge || parseInt(req.body.age, 10),
      gender,
      phone: phone.trim(),
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      password: passwordHash,
      securityQuestion,
      securityAnswer: securityAnswerHash,
      isEmailVerified,
      emailVerificationToken: isEmailVerified ? null : verificationToken,
      emailVerificationExpires: isEmailVerified ? null : tokenExpires,
      isApproved: true,
      failedLoginAttempts: 0,
      createdAt: new Date()
    });

    // Audit log
    await AuditLog.create({
      actor: investigator._id,
      actorName: investigator.fullName,
      action: 'INVESTIGATOR_REGISTERED',
      changeSummary: `Investigator ${investigator.fullName} (${investigator.email}) registered under role ${investigator.role}.`,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date()
    });

    const successMsg = devEmailMessage
      ? `Registration successful! ${devEmailMessage}`
      : 'Registration successful! Please log in with your credentials.';

    res.redirect(`/auth/login?success=${encodeURIComponent(successMsg)}`);
  } catch (error) {
    console.error('[Registration Error]:', error);
    const captchaSvg = generateCaptcha(req);
    res.status(500).render('auth/register', {
      title: 'Investigator Registration - Smart Investigation Workspace',
      captchaSvg,
      formData: req.body,
      errors: { general: 'An error occurred during registration. Please try again.' }
    });
  }
});

// Login Page
router.get('/login', redirectIfAuthenticated, (req, res) => {
  const captchaSvg = generateCaptcha(req);
  res.render('auth/login', {
    title: 'Investigator Login - Smart Investigation Workspace',
    captchaSvg,
    requireSecurityQuestion: false,
    securityQuestionText: '',
    emailValue: '',
    errors: {}
  });
});

// Process Login
router.post('/login', redirectIfAuthenticated, validateLogin, async (req, res) => {
  const validation = handleValidationErrors(req);
  if (validation.hasErrors) {
    const captchaSvg = generateCaptcha(req);
    return res.status(400).render('auth/login', {
      title: 'Investigator Login - Smart Investigation Workspace',
      captchaSvg,
      requireSecurityQuestion: false,
      securityQuestionText: '',
      emailValue: req.body.email || '',
      errors: validation.errors
    });
  }

  const { email, password, securityAnswer } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const investigator = await Investigator.findOne({ email: normalizedEmail });

    // Prevent account enumeration by providing generic message if not found
    if (!investigator) {
      const captchaSvg = generateCaptcha(req);
      return res.status(401).render('auth/login', {
        title: 'Investigator Login - Smart Investigation Workspace',
        captchaSvg,
        requireSecurityQuestion: false,
        securityQuestionText: '',
        emailValue: normalizedEmail,
        errors: { general: 'Invalid official credentials or unauthorized account.' }
      });
    }

    // Check account lockout
    if (investigator.lockoutUntil && investigator.lockoutUntil > new Date()) {
      const captchaSvg = generateCaptcha(req);
      const remainingMinutes = Math.ceil((investigator.lockoutUntil.getTime() - Date.now()) / (60 * 1000));
      return res.status(403).render('auth/login', {
        title: 'Investigator Login - Smart Investigation Workspace',
        captchaSvg,
        requireSecurityQuestion: false,
        securityQuestionText: '',
        emailValue: normalizedEmail,
        errors: { general: `Account temporarily locked due to repeated failed logins. Please retry after ${remainingMinutes} minute(s).` }
      });
    }

    // Check if security question is required (failed attempts >= 3)
    const requiresSecurityChallenge = investigator.failedLoginAttempts >= 3;

    if (requiresSecurityChallenge) {
      if (!securityAnswer) {
        const captchaSvg = generateCaptcha(req);
        return res.status(401).render('auth/login', {
          title: 'Investigator Login - Smart Investigation Workspace',
          captchaSvg,
          requireSecurityQuestion: true,
          securityQuestionText: investigator.securityQuestion,
          emailValue: normalizedEmail,
          errors: {
            securityAnswer: '3 consecutive failed attempts detected. Please provide your registered security answer.'
          }
        });
      }

      // Verify security answer
      const answerMatch = await bcrypt.compare(securityAnswer.trim().toLowerCase(), investigator.securityAnswer);
      if (!answerMatch) {
        investigator.failedLoginAttempts += 1;
        if (investigator.failedLoginAttempts >= 5) {
          investigator.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
        }
        await investigator.save();

        await AuditLog.create({
          actor: investigator._id,
          actorName: investigator.fullName,
          action: 'LOGIN_FAILED_SECURITY_QUESTION',
          changeSummary: `Failed security question challenge for ${investigator.email}. Total failed attempts: ${investigator.failedLoginAttempts}`,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || '',
          timestamp: new Date()
        });

        const captchaSvg = generateCaptcha(req);
        return res.status(401).render('auth/login', {
          title: 'Investigator Login - Smart Investigation Workspace',
          captchaSvg,
          requireSecurityQuestion: true,
          securityQuestionText: investigator.securityQuestion,
          emailValue: normalizedEmail,
          errors: { securityAnswer: 'Incorrect security answer.' }
        });
      }
      // Note: If answerMatch is true, DO NOT GRANT ACCESS YET! Password must still be verified!
    }

    // Verify Password
    const passwordMatch = await bcrypt.compare(password, investigator.password);
    if (!passwordMatch) {
      investigator.failedLoginAttempts += 1;
      const nowFailed = investigator.failedLoginAttempts;

      if (nowFailed >= 5) {
        investigator.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await investigator.save();

      await AuditLog.create({
        actor: investigator._id,
        actorName: investigator.fullName,
        action: 'LOGIN_FAILED_PASSWORD',
        changeSummary: `Incorrect password attempt for ${investigator.email}. Failed attempts: ${nowFailed}`,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        timestamp: new Date()
      });

      const captchaSvg = generateCaptcha(req);
      const shouldNowPromptSecurity = nowFailed >= 3;

      return res.status(401).render('auth/login', {
        title: 'Investigator Login - Smart Investigation Workspace',
        captchaSvg,
        requireSecurityQuestion: shouldNowPromptSecurity,
        securityQuestionText: shouldNowPromptSecurity ? investigator.securityQuestion : '',
        emailValue: normalizedEmail,
        errors: {
          general: 'Invalid official credentials or unauthorized account.',
          ...(shouldNowPromptSecurity ? { securityAnswer: 'Security verification is now required due to multiple failed attempts.' } : {})
        }
      });
    }

    // Authentication Successful!
    // Reset consecutive failed attempt counter
    investigator.failedLoginAttempts = 0;
    investigator.lockoutUntil = null;
    investigator.lastLogin = new Date();
    await investigator.save();

    // Regenerate session ID at login for session fixation protection
    req.session.regenerate((err) => {
      if (err) {
        console.error('[Session Regenerate Error]:', err);
        return res.status(500).render('partials/error', {
          title: '500 - Session Fault',
          message: 'Unable to establish secure authenticated session.'
        });
      }

      req.session.userId = investigator._id.toString();
      req.session.lastActivity = Date.now();

      // Audit Log
      AuditLog.create({
        actor: investigator._id,
        actorName: investigator.fullName,
        action: 'LOGIN_SUCCESS',
        changeSummary: `Investigator ${investigator.fullName} authenticated successfully.`,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        timestamp: new Date()
      });

      res.redirect('/dashboard');
    });

  } catch (error) {
    console.error('[Login Error]:', error);
    const captchaSvg = generateCaptcha(req);
    res.status(500).render('auth/login', {
      title: 'Investigator Login - Smart Investigation Workspace',
      captchaSvg,
      requireSecurityQuestion: false,
      securityQuestionText: '',
      emailValue: normalizedEmail,
      errors: { general: 'An unexpected authentication error occurred.' }
    });
  }
});

// Forgot Password / Password Reset via Security Question
router.get('/forgot-password', redirectIfAuthenticated, (req, res) => {
  const captchaSvg = generateCaptcha(req);
  res.render('auth/forgot-password', {
    title: 'Reset Credentials - Smart Investigation Workspace',
    captchaSvg,
    step: 1,
    email: '',
    securityQuestionText: '',
    errors: {}
  });
});

router.post('/forgot-password/step1', redirectIfAuthenticated, async (req, res) => {
  const { email, captcha } = req.body;
  if (!req.session.captcha || captcha.toLowerCase() !== req.session.captcha.toLowerCase()) {
    const captchaSvg = generateCaptcha(req);
    return res.status(400).render('auth/forgot-password', {
      title: 'Reset Credentials - Smart Investigation Workspace',
      captchaSvg,
      step: 1,
      email,
      securityQuestionText: '',
      errors: { captcha: 'Incorrect CAPTCHA code.' }
    });
  }

  const investigator = await Investigator.findOne({ email: (email || '').toLowerCase().trim() });
  if (!investigator) {
    const captchaSvg = generateCaptcha(req);
    return res.status(400).render('auth/forgot-password', {
      title: 'Reset Credentials - Smart Investigation Workspace',
      captchaSvg,
      step: 1,
      email,
      securityQuestionText: '',
      errors: { email: 'If this official email is registered, a security challenge has been initialized.' }
    });
  }

  req.session.resetEmail = investigator.email;
  const captchaSvg = generateCaptcha(req);
  res.render('auth/forgot-password', {
    title: 'Reset Credentials - Smart Investigation Workspace',
    captchaSvg,
    step: 2,
    email: investigator.email,
    securityQuestionText: investigator.securityQuestion,
    errors: {}
  });
});

router.post('/forgot-password/step2', redirectIfAuthenticated, async (req, res) => {
  const { securityAnswer, newPassword, retypePassword, captcha } = req.body;
  const email = req.session.resetEmail;

  if (!email) {
    return res.redirect('/auth/forgot-password');
  }

  if (!req.session.captcha || captcha.toLowerCase() !== req.session.captcha.toLowerCase()) {
    const captchaSvg = generateCaptcha(req);
    const investigator = await Investigator.findOne({ email });
    return res.status(400).render('auth/forgot-password', {
      title: 'Reset Credentials - Smart Investigation Workspace',
      captchaSvg,
      step: 2,
      email,
      securityQuestionText: investigator.securityQuestion,
      errors: { captcha: 'Incorrect CAPTCHA code.' }
    });
  }

  const investigator = await Investigator.findOne({ email });
  if (!investigator) {
    return res.redirect('/auth/forgot-password');
  }

  const answerMatch = await bcrypt.compare((securityAnswer || '').trim().toLowerCase(), investigator.securityAnswer);
  if (!answerMatch) {
    const captchaSvg = generateCaptcha(req);
    return res.status(400).render('auth/forgot-password', {
      title: 'Reset Credentials - Smart Investigation Workspace',
      captchaSvg,
      step: 2,
      email,
      securityQuestionText: investigator.securityQuestion,
      errors: { securityAnswer: 'Incorrect security answer.' }
    });
  }

  if (newPassword !== retypePassword) {
    const captchaSvg = generateCaptcha(req);
    return res.status(400).render('auth/forgot-password', {
      title: 'Reset Credentials - Smart Investigation Workspace',
      captchaSvg,
      step: 2,
      email,
      securityQuestionText: investigator.securityQuestion,
      errors: { retypePassword: 'Passwords do not match.' }
    });
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  investigator.password = await bcrypt.hash(newPassword, salt);
  investigator.failedLoginAttempts = 0;
  investigator.lockoutUntil = null;
  await investigator.save();

  await AuditLog.create({
    actor: investigator._id,
    actorName: investigator.fullName,
    action: 'PASSWORD_RESET',
    changeSummary: `Password reset via security question for ${investigator.email}.`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || '',
    timestamp: new Date()
  });

  delete req.session.resetEmail;
  res.redirect('/auth/login?success=Password+reset+successful.+Please+log+in+with+your+new+password.');
});

// Sign Out
router.get('/logout', async (req, res) => {
  const investigatorId = req.session ? req.session.userId : null;

  if (investigatorId) {
    try {
      const investigator = await Investigator.findById(investigatorId);
      if (investigator) {
        await AuditLog.create({
          actor: investigator._id,
          actorName: investigator.fullName,
          action: 'LOGOUT',
          changeSummary: `Investigator ${investigator.fullName} signed out.`,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || '',
          timestamp: new Date()
        });
      }
    } catch (e) {
      // ignore
    }
  }

  if (req.session) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/?success=You+have+been+securely+signed+out.');
    });
  } else {
    res.redirect('/');
  }
});

module.exports = router;
