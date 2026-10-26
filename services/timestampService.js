/**
 * Authoritative Server Timestamp Utility
 * Provides standardized UTC storage helpers and configured timezone (Asia/Kolkata) formatting.
 */

const DEFAULT_TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';

/**
 * Returns current server authoritative Date object in UTC
 */
function getAuthoritativeTimestamp() {
  return new Date();
}

/**
 * Formats a Date object or ISO string in the configured local timezone (Asia/Kolkata)
 * e.g., "26 Oct 2026, 01:25:30 IST"
 */
function formatTimestamp(date, options = {}) {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';

  const tz = options.timezone || DEFAULT_TIMEZONE;
  const includeSeconds = options.includeSeconds !== false;

  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true
    });
    return formatter.format(d) + (tz === 'Asia/Kolkata' ? ' IST' : ` (${tz})`);
  } catch (err) {
    return d.toUTCString();
  }
}

/**
 * Formats a date only (e.g. "26 Oct 2026")
 */
function formatDateOnly(date, options = {}) {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';

  const tz = options.timezone || DEFAULT_TIMEZONE;
  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
    return formatter.format(d);
  } catch (err) {
    return d.toISOString().split('T')[0];
  }
}

/**
 * Formats time only (e.g. "01:25 PM IST")
 */
function formatTimeOnly(date, options = {}) {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';

  const tz = options.timezone || DEFAULT_TIMEZONE;
  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    return formatter.format(d) + (tz === 'Asia/Kolkata' ? ' IST' : '');
  } catch (err) {
    return d.toTimeString().split(' ')[0];
  }
}

module.exports = {
  DEFAULT_TIMEZONE,
  getAuthoritativeTimestamp,
  formatTimestamp,
  formatDateOnly,
  formatTimeOnly
};
