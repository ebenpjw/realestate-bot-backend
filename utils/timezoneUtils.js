// utils/timezoneUtils.js

/**
 * Timezone utilities for Singapore-based real estate bot
 *
 * CORRECTED CONTEXT:
 * - Supabase database is in ap-southeast-1 (Singapore) region
 * - Database stores timestamps in Singapore timezone (UTC+8)
 * - Business operates in Singapore Time (UTC+8)
 * - Google Calendar API requires local time + timezone specification
 * - All times are already in Singapore timezone - no conversion needed
 *
 * SIMPLIFIED STRATEGY:
 * 1. Treat all dates as Singapore time (which they already are)
 * 2. Format appropriately for different APIs
 * 3. Display times in user-friendly Singapore format
 */

const logger = require('../logger');

// Singapore timezone constants
const SINGAPORE_TIMEZONE = 'Asia/Singapore';

/**
 * Get current time (already in Singapore timezone since database is in Singapore)
 * @returns {Date} Current time as Date object
 */
function getNowInSg() {
  return new Date();
}

/**
 * Ensure date is a proper Date object (no timezone conversion needed)
 * @param {Date|string} date - Date to normalize
 * @returns {Date} Date object
 */
function toSgTime(date) {
  const inputDate = new Date(date);

  if (isNaN(inputDate.getTime())) {
    throw new Error(`Invalid date provided: ${date}`);
  }

  return inputDate;
}

/**
 * Format date for user-facing messages in Singapore timezone
 * @param {Date|string} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
function formatForDisplay(date, options = {}) {
  const sgDate = toSgTime(date);

  const defaultOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: SINGAPORE_TIMEZONE
  };

  const formatOptions = { ...defaultOptions, ...options };

  try {
    return sgDate.toLocaleString('en-SG', formatOptions);
  } catch (error) {
    logger.error({ err: error, date, options }, 'Error formatting date for display');
    return sgDate.toLocaleString('en-SG');
  }
}

/**
 * Format date for Google Calendar API (RFC3339 format with timezone)
 * @param {Date|string} date - Date to format
 * @returns {string} RFC3339 formatted string for Google Calendar
 */
function formatForGoogleCalendar(date) {
  const sgDate = toSgTime(date);

  // Google Calendar API expects RFC3339 format with timezone offset
  // Convert to Singapore timezone and format as RFC3339

  // Get Singapore time components
  const sgYear = sgDate.toLocaleString('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric' });
  const sgMonth = sgDate.toLocaleString('en-CA', { timeZone: 'Asia/Singapore', month: '2-digit' });
  const sgDay = sgDate.toLocaleString('en-CA', { timeZone: 'Asia/Singapore', day: '2-digit' });
  const sgHour = sgDate.toLocaleString('en-CA', { timeZone: 'Asia/Singapore', hour: '2-digit', hour12: false });
  const sgMinute = sgDate.toLocaleString('en-CA', { timeZone: 'Asia/Singapore', minute: '2-digit' });
  const sgSecond = sgDate.toLocaleString('en-CA', { timeZone: 'Asia/Singapore', second: '2-digit' });

  // Create RFC3339 format with Singapore timezone offset (+08:00)
  const rfc3339String = `${sgYear}-${sgMonth}-${sgDay}T${sgHour}:${sgMinute}:${sgSecond}+08:00`;

  logger.info({
    inputDate: date,
    sgDate: sgDate.toISOString(),
    sgComponents: { sgYear, sgMonth, sgDay, sgHour, sgMinute, sgSecond },
    finalRfc3339String: rfc3339String
  }, 'Formatted date for Google Calendar (RFC3339)');

  return rfc3339String;
}

/**
 * Create a Date object from date/time components in Singapore timezone
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {number} day - Day of month
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @param {number} second - Second (0-59)
 * @returns {Date} Date object representing Singapore time
 */
function createSgDate(year, month, day, hour = 0, minute = 0, second = 0) {
  // Create date string in Singapore timezone format
  const pad = (num) => num.toString().padStart(2, '0');
  const dateString = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+08:00`;

  // Parse as Singapore time (UTC+8)
  const date = new Date(dateString);

  logger.info({
    input: { year, month, day, hour, minute, second },
    dateString,
    resultISO: date.toISOString(),
    resultSgLocal: date.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
  }, 'Created Singapore date');

  return date;
}





// Legacy function alias for backward compatibility
// Note: formatToLocalISO was removed as it was unused
const formatToFullISO = (date) => {
  // formatForGoogleCalendar already includes the timezone offset, so just return it directly
  return formatForGoogleCalendar(date);
};

module.exports = {
  // Core timezone functions
  getNowInSg,
  toSgTime,
  formatForDisplay,
  formatForGoogleCalendar,
  createSgDate,

  // Constants
  SINGAPORE_TIMEZONE,

  // Legacy compatibility (deprecated - used in bookingHelper.js)
  formatToFullISO
};
