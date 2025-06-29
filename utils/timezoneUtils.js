// utils/timezoneUtils.js

/**
 * Utility functions for handling Singapore timezone formatting
 * Fixes the timezone bug where UTC timestamps were being sent to Google Calendar API
 */

/**
 * Format a Date object to local ISO string for Singapore timezone
 * This creates a string like 'YYYY-MM-DDTHH:mm:ss' in local time
 * Used for Google Calendar event creation where timezone is specified separately
 * @param {Date} date - The date to format
 * @returns {string} Local ISO string
 */
function formatToLocalISO(date) {
  const pad = (num) => num.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Format a Date object to full ISO string with timezone for API calls that require it
 * This creates a string like 'YYYY-MM-DDTHH:mm:ss+08:00' 
 * Used for Google Calendar freebusy queries and other APIs that need timezone info
 * @param {Date} date - The date to format
 * @returns {string} Full ISO string with timezone
 */
function formatToFullISO(date) {
  // For Singapore timezone, we need to add +08:00
  return formatToLocalISO(date) + '+08:00';
}

module.exports = {
  formatToLocalISO,
  formatToFullISO
};
