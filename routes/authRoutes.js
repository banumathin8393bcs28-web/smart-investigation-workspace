const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const PREDEFINED_QUESTIONS = [
  'What is the name of your first elementary school?',
  'In what city was your mother born?',
  'What was the make/brand of your first vehicle?',
  'What is the last name of your favorite teacher?',
  'What was the street name of your childhood home?',
  'What was the name of your first childhood pet?'
];

// GET /auth/register
router.get('/register', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('auth/register', {
    title: 'Investigator Registration | Smart Investigation Workspace',
    questions: PREDEFINED_QUESTIONS,
    error: req.query.error || null,
    success: req.query.success || null,
    formData: {}
  });
});

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      badgeId,
      department,
      rank,
      role,
      password,
      confirmPassword,
      securityQuestion,
      customQuestion,
      securityAnswer
    } = req.body;

    const finalQuestion = (securityQuestion === 'custom' ? customQuestion : securityQuestion) || PREDEFINED_QUESTIONS[0];

    const formData = {
      name,
      email,
      phone,
      badgeId,
      department,
      rank,
      role,
      securityQuestion: finalQuestion
    };

    // 1. Validate Email
    if (!User.validateEmail(email)) {
      return res.render('auth/register', {
        title: 'Investigator Registration',
        questions: PREDEFINED_QUESTIONS,
        error: 'Invalid Email Address format. Please provide a standard address (e.g. investigator@agency.gov).',
        formData
      });
    }

    // 2. Validate Phone
    if (!User.validatePhone(phone)) {
      return res.render('auth/register', {
        title: 'Investigator Registration',
        questions: PREDEFINED_QUESTIONS,
        error: 'Invalid Phone Number format. Must be at least 10 digits (e.g. 555-019-2834 or +15550192834).',
        formData
      });
    }

    // 3. Validate Password match
    if (password !== confirmPassword) {
      return res.render('auth/register', {
        title: 'Investigator Registration',
        questions: PREDEFINED_QUESTIONS,
        error: 'Passwords do not match. Please re-enter identical passwords.',
        formData
      });
    }

    // 4. Validate Password strength
    if (!User.validatePassword(password)) {
      return res.render('auth/register', {
        title: 'Investigator Registration',
        questions: PREDEFINED_QUESTIONS,
        error: 'Password does not satisfy forensic security standards: must have at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special symbol (!@#$%^&*).',
        formData
      });
    }

    // 5. Validate Security Answer (One word only)
    if (!User.validateSecurityAnswer(securityAnswer)) {
      return res.render('auth/register', {
        title: 'Investigator Registration',
        questions: PREDEFINED_QUESTIONS,
        error: 'Security Answer must be exactly ONE SINGLE WORD with no spaces (minimum 2 letters).',
        formData
      });
    }

    // 6. Check duplicates
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.render('auth/register', {
        title: 'Investigator Registration',
        questions: PREDEFINED_QUESTIONS,
        error: 'An investigator account with this official email already exists.',
        formData
      });
    }

    if (badgeId) {
      const existingBadge = await User.findOne({ badgeId: badgeId.trim().toUpperCase() });
      if (existingBadge) {
        return res.render('auth/register', {
          title: 'Investigator Registration',
          questions: PREDEFINED_QUESTIONS,
          error: 'An investigator with this Badge Number is already registered.',
          formData
        });
      }
    }

    // Create User
    const newUser = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      badgeId: (badgeId || 'INV-' + Math.floor(1000 + Math.random() * 9000)).trim().toUpperCase(),
      department: department || 'Forensic Investigation Division',
      rank: rank || 'Detective',
      role: role || 'lead_investigator',
      password,
      securityQuestion: finalQuestion,
      securityAnswer: securityAnswer.trim().toLowerCase()
    });

    await AuditLog.log({
      investigator: newUser.name,
      badgeId: newUser.badgeId,
      action: 'USER_REGISTERED',
      targetType: 'User',
      targetId: newUser._id,
      details: `New investigator credential generated for ${newUser.email} with security question configured.`,
      ipAddress: req.ip
    });

    res.redirect('/auth/login?success=Account successfully registered. You may now log in with your credentials.');
  } catch (err) {
    console.error('Registration error:', err);
    res.render('auth/register', {
      title: 'Investigator Registration',
      questions: PREDEFINED_QUESTIONS,
      error: 'An internal error occurred during registration. Please try again.',
      formData: req.body
    });
  }
});

// GET /auth/login
router.get('/login', async (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }

  const emailParam = req.query.email || '';
  let challengeActive = false;
  let securityQuestion = '';

  if (emailParam) {
    const user = await User.findOne({
      $or: [
        { email: emailParam.toLowerCase() },
        { badgeId: emailParam.toUpperCase() }
      ]
    });
    if (user && (user.failedLoginAttempts >= 3 || user.isLocked)) {
      challengeActive = true;
      securityQuestion = user.securityQuestion;
    }
  }

  res.render('auth/login', {
    title: 'Investigator Access Terminal | Smart Investigation Workspace',
    error: req.query.error || null,
    success: req.query.success || null,
    challengeActive,
    securityQuestion,
    emailValue: emailParam
  });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password, securityAnswer } = req.body;
    const cleanId = (identifier || '').trim();

    if (!cleanId || !password) {
      return res.render('auth/login', {
        title: 'Investigator Access Terminal',
        error: 'Please enter both your Email / Badge ID and Password.',
        success: null,
        challengeActive: false,
        securityQuestion: '',
        emailValue: cleanId
      });
    }

    const user = await User.findOne({
      $or: [
        { email: cleanId.toLowerCase() },
        { badgeId: cleanId.toUpperCase() }
      ]
    });

    if (!user) {
      await AuditLog.log({
        investigator: cleanId,
        badgeId: 'UNKNOWN',
        action: 'FAILED_LOGIN_ATTEMPT',
        targetType: 'User',
        details: 'Attempted login with non-existent user identifier.',
        ipAddress: req.ip
      });

      return res.render('auth/login', {
        title: 'Investigator Access Terminal',
        error: 'Invalid investigator credentials. Access denied.',
        success: null,
        challengeActive: false,
        securityQuestion: '',
        emailValue: cleanId
      });
    }

    const isLockedOut = (user.failedLoginAttempts >= 3 || user.isLocked);

    // If account has failed 3 or more times, trigger mandatory security question verification!
    if (isLockedOut) {
      if (!securityAnswer) {
        return res.render('auth/login', {
          title: 'Investigator Access Terminal',
          error: 'SECURITY LOCKOUT ACTIVE: More than 3 failed attempts recorded for this account. You MUST answer your personal security question with your one-word answer to proceed.',
          success: null,
          challengeActive: true,
          securityQuestion: user.securityQuestion,
          emailValue: cleanId
        });
      }

      // Validate the security answer
      const cleanAnswer = securityAnswer.trim().toLowerCase();
      const expectedAnswer = (user.securityAnswer || '').trim().toLowerCase();

      if (cleanAnswer !== expectedAnswer) {
        await AuditLog.log({
          investigator: user.name,
          badgeId: user.badgeId,
          action: 'FAILED_SECURITY_CHALLENGE',
          targetType: 'User',
          targetId: user._id,
          details: `Incorrect security answer provided during lockout challenge.`,
          ipAddress: req.ip
        });

        return res.render('auth/login', {
          title: 'Investigator Access Terminal',
          error: 'Security question answer is incorrect. Account remains locked.',
          success: null,
          challengeActive: true,
          securityQuestion: user.securityQuestion,
          emailValue: cleanId
        });
      }

      // Security answer is correct! Now check password
      const passwordMatches = await User.comparePassword(password, user.password);
      if (!passwordMatches) {
        return res.render('auth/login', {
          title: 'Investigator Access Terminal',
          error: 'Security answer was verified, but the password provided is still incorrect.',
          success: null,
          challengeActive: true,
          securityQuestion: user.securityQuestion,
          emailValue: cleanId
        });
      }

      // Both security answer and password matched! Unlock and log in
      await User.findByIdAndUpdate(user._id, {
        failedLoginAttempts: 0,
        isLocked: false
      });

      await AuditLog.log({
        investigator: user.name,
        badgeId: user.badgeId,
        action: 'SECURITY_CHALLENGE_PASSED',
        targetType: 'User',
        targetId: user._id,
        details: 'User successfully answered security challenge and restored account access.',
        ipAddress: req.ip
      });

      req.session.userId = user._id;
      return res.redirect('/dashboard');
    }

    // Normal login flow (< 3 failed attempts)
    const isMatch = await User.comparePassword(password, user.password);

    if (!isMatch) {
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      const willLock = newAttempts >= 3;

      await User.findByIdAndUpdate(user._id, {
        failedLoginAttempts: newAttempts,
        isLocked: willLock
      });

      await AuditLog.log({
        investigator: user.name,
        badgeId: user.badgeId,
        action: willLock ? 'ACCOUNT_LOCKED' : 'FAILED_LOGIN_ATTEMPT',
        targetType: 'User',
        targetId: user._id,
        details: `Incorrect password attempt #${newAttempts}.${willLock ? ' Account locked. Security challenge triggered.' : ''}`,
        ipAddress: req.ip
      });

      if (willLock) {
        return res.render('auth/login', {
          title: 'Investigator Access Terminal',
          error: 'ACCOUNT LOCKED: 3 consecutive invalid password attempts. Please answer your personal security question to unlock your workspace.',
          success: null,
          challengeActive: true,
          securityQuestion: user.securityQuestion,
          emailValue: cleanId
        });
      } else {
        const remaining = 3 - newAttempts;
        return res.render('auth/login', {
          title: 'Investigator Access Terminal',
          error: `Invalid password. Warning: ${remaining} attempt(s) remaining before security lockout.`,
          success: null,
          challengeActive: false,
          securityQuestion: '',
          emailValue: cleanId
        });
      }
    }

    // Successful login
    await User.findByIdAndUpdate(user._id, {
      failedLoginAttempts: 0,
      isLocked: false
    });

    await AuditLog.log({
      investigator: user.name,
      badgeId: user.badgeId,
      action: 'LOGIN_SUCCESS',
      targetType: 'User',
      targetId: user._id,
      details: 'Investigator successfully authenticated into workstation session.',
      ipAddress: req.ip
    });

    req.session.userId = user._id;
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.render('auth/login', {
      title: 'Investigator Access Terminal',
      error: 'An internal error occurred during login. Please try again.',
      success: null,
      challengeActive: false,
      securityQuestion: '',
      emailValue: req.body.identifier || ''
    });
  }
});

// GET /auth/logout
router.get('/logout', async (req, res) => {
  if (req.session && req.session.userId) {
    const user = await User.findById(req.session.userId);
    if (user) {
      await AuditLog.log({
        investigator: user.name,
        badgeId: user.badgeId,
        action: 'LOGOUT',
        targetType: 'User',
        targetId: user._id,
        details: 'Investigator logged out of secure workspace.',
        ipAddress: req.ip
      });
    }
    req.session.destroy();
  }
  res.redirect('/auth/login?success=Successfully logged out of secure workstation.');
});

module.exports = router;
