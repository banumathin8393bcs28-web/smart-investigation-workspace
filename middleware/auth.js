const Investigator = require('../models/Investigator');
const { getUnreadCount } = require('../services/notificationService');
const { formatTimestamp } = require('../services/timestampService');

// Inactivity session timeout: 30 minutes
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Authentication middleware ensuring user is logged in with an active MongoDB session
 */
async function ensureAuthenticated(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(401).json({ error: 'Authentication required. Session expired or not found.' });
    }
    return res.redirect(`/auth/login?error=${encodeURIComponent('Please log in to access the investigation workspace.')}`);
  }

  // Enforce inactivity timeout
  const now = Date.now();
  if (req.session.lastActivity && (now - req.session.lastActivity > INACTIVITY_TIMEOUT_MS)) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      return res.redirect(`/auth/login?error=${encodeURIComponent('Session expired due to inactivity. Please sign in again.')}`);
    });
    return;
  }
  req.session.lastActivity = now;

  try {
    const investigator = await Investigator.findById(req.session.userId);
    if (!investigator) {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        return res.redirect('/auth/login?error=Investigator account not found.');
      });
      return;
    }

    // Check account status
    if (investigator.lockoutUntil && investigator.lockoutUntil > new Date()) {
      return res.status(403).render('partials/error', {
        title: 'Account Locked',
        message: `Your account is temporarily locked due to multiple failed login attempts until ${formatTimestamp(investigator.lockoutUntil)}.`
      });
    }

    req.investigator = investigator;
    res.locals.currentInvestigator = investigator;

    // Attach unread notification count
    try {
      res.locals.unreadNotificationsCount = await getUnreadCount(investigator._id);
    } catch (e) {
      res.locals.unreadNotificationsCount = 0;
    }

    // Attach server timestamp helper
    res.locals.formatTimestamp = formatTimestamp;

    next();
  } catch (error) {
    console.error('[AuthMiddleware] Error fetching investigator:', error);
    next(error);
  }
}

/**
 * Redirects already logged in users away from login/register
 */
function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = {
  ensureAuthenticated,
  redirectIfAuthenticated
};
