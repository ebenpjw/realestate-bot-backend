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
 * Format date for Google Calendar API (local time string + timezone)
 * @param {Date|string} date - Date to format
 * @returns {string} Local ISO string for Google Calendar
 */
function formatForGoogleCalendar(date) {
  const sgDate = toSgTime(date);

  // Create local time string without timezone suffix
  const pad = (num) => num.toString().padStart(2, '0');
  const year = sgDate.getFullYear();
  const month = pad(sgDate.getMonth() + 1);
  const day = pad(sgDate.getDate());
  const hours = pad(sgDate.getHours());
  const minutes = pad(sgDate.getMinutes());
  const seconds = pad(sgDate.getSeconds());

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Create a Date object from date/time components
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {number} day - Day of month
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @param {number} second - Second (0-59)
 * @returns {Date} Date object
 */
function createSgDate(year, month, day, hour = 0, minute = 0, second = 0) {
  return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Parse time string and create Date object
 * @param {string} timeString - Time string like "2:30 PM" or "14:30"
 * @param {Date} baseDate - Base date to apply time to (defaults to today)
 * @returns {Date} Date object
 */
function parseSgTime(timeString, baseDate = null) {
  const base = baseDate ? toSgTime(baseDate) : getNowInSg();

  // Common time patterns
  const patterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/i,  // 2:30 PM
    /(\d{1,2})\s*(am|pm)/i,          // 2 PM
    /(\d{1,2}):(\d{2})/,             // 14:30
    /(\d{1,2})/                      // 14
  ];

  for (const pattern of patterns) {
    const match = timeString.toLowerCase().match(pattern);
    if (match) {
      let hour = parseInt(match[1]);
      const minute = parseInt(match[2] || '0');
      const ampm = match[3];

      // Convert to 24-hour format
      if (ampm) {
        if (ampm === 'pm' && hour !== 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
      }

      return createSgDate(
        base.getFullYear(),
        base.getMonth() + 1,
        base.getDate(),
        hour,
        minute
      );
    }
  }

  throw new Error(`Unable to parse time string: ${timeString}`);
}

/**
 * Check if a date is in business hours
 * @param {Date|string} date - Date to check
 * @param {Object} businessHours - Business hours configuration
 * @returns {boolean} True if in business hours
 */
function isInSgBusinessHours(date, businessHours = {}) {
  const sgDate = toSgTime(date);
  const hour = sgDate.getHours();
  const day = sgDate.getDay(); // 0 = Sunday, 6 = Saturday

  const defaultHours = {
    weekdayStart: 9,    // 9 AM
    weekdayEnd: 18,     // 6 PM
    weekendStart: 10,   // 10 AM
    weekendEnd: 16,     // 4 PM
    excludeSunday: true
  };

  const hours = { ...defaultHours, ...businessHours };

  // Check if Sunday and excluded
  if (day === 0 && hours.excludeSunday) {
    return false;
  }

  // Determine start/end times based on day
  const isWeekend = day === 0 || day === 6;
  const startHour = isWeekend ? hours.weekendStart : hours.weekdayStart;
  const endHour = isWeekend ? hours.weekendEnd : hours.weekdayEnd;

  return hour >= startHour && hour < endHour;
}

/**
 * Add business days to a date
 * @param {Date|string} date - Starting date
 * @param {number} days - Number of business days to add
 * @returns {Date} New date with business days added
 */
function addSgBusinessDays(date, days) {
  const sgDate = toSgTime(date);
  const result = new Date(sgDate);
  let addedDays = 0;

  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();

    // Skip weekends (Saturday = 6, Sunday = 0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }

  return result;
}

// Legacy function aliases for backward compatibility
const formatToLocalISO = formatForGoogleCalendar;
const formatToFullISO = (date) => {
  return `${formatForGoogleCalendar(date)}+08:00`;
};

module.exports = {
  // Core timezone functions
  getNowInSg,
  toSgTime,
  formatForDisplay,
  formatForGoogleCalendar,
  createSgDate,
  parseSgTime,

  // Business logic helpers
  isInSgBusinessHours,
  addSgBusinessDays,

  // Constants
  SINGAPORE_TIMEZONE,

  // Legacy compatibility (deprecated)
  formatToLocalISO,
  formatToFullISO
};
