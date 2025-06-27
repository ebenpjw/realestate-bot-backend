// utils/timezone.js
// Centralized timezone utilities for Singapore time handling

const SINGAPORE_TIMEZONE = 'Asia/Singapore';

/**
 * Get current time in Singapore timezone
 * @returns {Date} Current Singapore time as Date object
 */
function getSingaporeTime() {
    const now = new Date();
    // Get the current time in Singapore timezone as a string, then parse it
    const singaporeTimeString = now.toLocaleString('en-CA', {
        timeZone: SINGAPORE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    // Parse the string back to a Date object (this will be in local timezone but represent Singapore time)
    const [datePart, timePart] = singaporeTimeString.split(', ');
    const [year, month, day] = datePart.split('-');
    const [hour, minute, second] = timePart.split(':');

    return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Convert any Date to Singapore timezone
 * @param {Date} date - Date to convert
 * @returns {Date} Date in Singapore timezone
 */
function toSingaporeTime(date) {
    if (!(date instanceof Date)) {
        throw new Error('Input must be a Date object');
    }
    return new Date(date.toLocaleString('en-US', { timeZone: SINGAPORE_TIMEZONE }));
}

/**
 * Create a Date object for a specific Singapore time
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {number} day - Day
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @param {number} second - Second (0-59)
 * @returns {Date} Date object representing the Singapore time
 */
function createSingaporeDate(year, month, day, hour = 0, minute = 0, second = 0) {
    // Create date string in Singapore timezone format
    const dateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}.000+08:00`;
    return new Date(dateString);
}

/**
 * Format Date for database storage (ISO string)
 * @param {Date} date - Date to format
 * @returns {string} ISO string for database storage
 */
function formatForDatabase(date = null) {
    const targetDate = date || getSingaporeTime();
    return targetDate.toISOString();
}

/**
 * Format Date for display in Singapore timezone
 * @param {Date} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
function formatForDisplay(date, options = {}) {
    const defaultOptions = {
        timeZone: SINGAPORE_TIMEZONE,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    return date.toLocaleString('en-SG', { ...defaultOptions, ...options });
}

/**
 * Check if a time is in the future (Singapore timezone)
 * @param {Date} targetTime - Time to check
 * @returns {boolean} True if time is in the future
 */
function isInFuture(targetTime) {
    const now = getSingaporeTime();
    return targetTime > now;
}

/**
 * Get time difference in minutes
 * @param {Date} time1 - First time
 * @param {Date} time2 - Second time
 * @returns {number} Difference in minutes (time1 - time2)
 */
function getTimeDifferenceMinutes(time1, time2) {
    return Math.round((time1.getTime() - time2.getTime()) / (1000 * 60));
}

/**
 * Parse time string and create Singapore Date
 * @param {string} timeString - Time string like "9pm", "2:30pm"
 * @param {Date} baseDate - Base date to use (defaults to today in Singapore)
 * @returns {Date|null} Parsed date or null if invalid
 */
function parseTimeToSingaporeDate(timeString, baseDate = null) {
    try {
        const base = baseDate || getSingaporeTime();
        const lowerTime = timeString.toLowerCase().trim();
        
        // Match patterns like "9pm", "2:30pm", "14:30"
        const timePattern = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
        const match = lowerTime.match(timePattern);
        
        if (!match) return null;
        
        let hour = parseInt(match[1]);
        const minute = parseInt(match[2] || '0');
        const ampm = match[3]?.toLowerCase();
        
        // Convert to 24-hour format
        if (ampm === 'pm' && hour !== 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        
        // Create new date with same day but different time
        const result = new Date(base);
        result.setHours(hour, minute, 0, 0);
        
        return result;
    } catch (error) {
        return null;
    }
}

module.exports = {
    SINGAPORE_TIMEZONE,
    getSingaporeTime,
    toSingaporeTime,
    createSingaporeDate,
    formatForDatabase,
    formatForDisplay,
    isInFuture,
    getTimeDifferenceMinutes,
    parseTimeToSingaporeDate
};
