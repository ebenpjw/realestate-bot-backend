// Test timezone handling
const { getSingaporeTime, formatForDatabase, formatForDisplay, isInFuture, getTimeDifferenceMinutes } = require('./utils/timezone');

console.log('=== TIMEZONE TEST ===');
console.log('Current server time (UTC):', new Date().toISOString());
console.log('Current server time (local):', new Date().toString());

const singaporeTime = getSingaporeTime();
console.log('Singapore time (calculated):', singaporeTime.toISOString());
console.log('Singapore time (display):', formatForDisplay(singaporeTime));

// Test parsing "9pm today"
const testTime = new Date(singaporeTime);
testTime.setHours(21, 0, 0, 0); // 9 PM

console.log('\n=== 9PM TODAY TEST ===');
console.log('9pm today (Singapore):', testTime.toISOString());
console.log('9pm today (display):', formatForDisplay(testTime));
console.log('Is 9pm in future?', isInFuture(testTime));
console.log('Minutes until 9pm:', getTimeDifferenceMinutes(testTime, singaporeTime));

// Test database format
console.log('\n=== DATABASE FORMAT ===');
console.log('Database timestamp:', formatForDatabase());

// Test Google Calendar format
console.log('\n=== GOOGLE CALENDAR FORMAT ===');
console.log('Calendar ISO string:', testTime.toISOString());
console.log('Calendar timezone display:', testTime.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }));
