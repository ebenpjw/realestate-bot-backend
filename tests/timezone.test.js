// Tests for timezone utility functions and Google Calendar integration
const {
  formatToLocalISO,
  formatToFullISO,
  getNowInSg,
  toSgTime,
  fromSgTimeToUtc,
  formatForDisplay,
  formatForGoogleCalendar,
  createSgDate,
  parseSgTime,
  isInSgBusinessHours,
  validateTimezoneConfig
} = require('../utils/timezoneUtils');

describe('Timezone Utilities', () => {
  describe('formatToLocalISO', () => {
    test('should format date to local ISO string without timezone', () => {
      // Create a specific date for testing
      const testDate = new Date(2024, 5, 15, 17, 30, 45); // June 15, 2024, 5:30:45 PM
      
      const result = formatToLocalISO(testDate);
      
      // Should be in format YYYY-MM-DDTHH:mm:ss
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(result).toBe('2024-06-15T17:30:45');
    });

    test('should pad single digits correctly', () => {
      // Create a date with single digit month, day, hour, minute, second
      const testDate = new Date(2024, 0, 5, 9, 5, 3); // January 5, 2024, 9:05:03 AM
      
      const result = formatToLocalISO(testDate);
      
      expect(result).toBe('2024-01-05T09:05:03');
    });

    test('should handle midnight correctly', () => {
      const testDate = new Date(2024, 11, 31, 0, 0, 0); // December 31, 2024, midnight
      
      const result = formatToLocalISO(testDate);
      
      expect(result).toBe('2024-12-31T00:00:00');
    });
  });

  describe('formatToFullISO', () => {
    test('should format date to full ISO string with Singapore timezone', () => {
      const testDate = new Date(2024, 5, 15, 17, 30, 45); // June 15, 2024, 5:30:45 PM
      
      const result = formatToFullISO(testDate);
      
      // Should be in format YYYY-MM-DDTHH:mm:ss+08:00
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
      expect(result).toBe('2024-06-15T17:30:45+08:00');
    });

    test('should handle edge cases correctly', () => {
      const testDate = new Date(2024, 0, 1, 0, 0, 0); // January 1, 2024, midnight
      
      const result = formatToFullISO(testDate);
      
      expect(result).toBe('2024-01-01T00:00:00+08:00');
    });
  });

  describe('Timezone Fix Validation', () => {
    test('should not use UTC timestamps for calendar events', () => {
      const testDate = new Date(2024, 5, 15, 17, 30, 0); // June 15, 2024, 5:30 PM local
      
      const localISO = formatToLocalISO(testDate);
      const utcISO = testDate.toISOString();
      
      // Local ISO should be different from UTC ISO (unless we're in UTC timezone)
      // The key difference is that local ISO doesn't have 'Z' suffix and represents local time
      expect(localISO).not.toContain('Z');
      expect(utcISO).toContain('Z');
      
      // Local time should match what we expect for Singapore time
      expect(localISO).toBe('2024-06-15T17:30:00');
    });

    test('should create proper Google Calendar API format', () => {
      const testDate = new Date(2024, 5, 15, 17, 30, 0);
      
      const calendarEventFormat = {
        start: {
          dateTime: formatToLocalISO(testDate),
          timeZone: 'Asia/Singapore'
        },
        end: {
          dateTime: formatToLocalISO(new Date(testDate.getTime() + 60 * 60 * 1000)), // +1 hour
          timeZone: 'Asia/Singapore'
        }
      };
      
      expect(calendarEventFormat.start.dateTime).toBe('2024-06-15T17:30:00');
      expect(calendarEventFormat.end.dateTime).toBe('2024-06-15T18:30:00');
      expect(calendarEventFormat.start.timeZone).toBe('Asia/Singapore');
      expect(calendarEventFormat.end.timeZone).toBe('Asia/Singapore');
    });

    test('should create proper freebusy query format', () => {
      const startDate = new Date(2024, 5, 15, 9, 0, 0); // 9 AM
      const endDate = new Date(2024, 5, 15, 18, 0, 0); // 6 PM
      
      const freebusyQuery = {
        timeMin: formatToFullISO(startDate),
        timeMax: formatToFullISO(endDate),
        items: [{ id: 'primary' }]
      };
      
      expect(freebusyQuery.timeMin).toBe('2024-06-15T09:00:00+08:00');
      expect(freebusyQuery.timeMax).toBe('2024-06-15T18:00:00+08:00');
    });
  });
});

describe('Calendar Integration Timezone Fix', () => {
  test('should demonstrate the timezone bug fix', () => {
    // Simulate the old buggy behavior vs new fixed behavior
    const appointmentTime = new Date(2024, 5, 15, 17, 0, 0); // June 15, 2024, 5:00 PM Singapore time
    
    // OLD BUGGY WAY (what was happening before)
    const oldBuggyFormat = appointmentTime.toISOString(); // This creates UTC time
    
    // NEW FIXED WAY
    const newFixedFormat = formatToLocalISO(appointmentTime); // This creates local time
    
    // The bug was that 5 PM Singapore time was being sent as UTC time to Google Calendar
    // which would be interpreted as 5 PM UTC = 1 AM Singapore time the next day
    expect(oldBuggyFormat).toContain('Z'); // UTC indicator
    expect(newFixedFormat).not.toContain('Z'); // No UTC indicator
    
    // The fixed version should represent the actual local time
    expect(newFixedFormat).toBe('2024-06-15T17:00:00');
    
    // When combined with timeZone: 'Asia/Singapore' in the Google Calendar API,
    // this will correctly create an event at 5 PM Singapore time
  });
});
