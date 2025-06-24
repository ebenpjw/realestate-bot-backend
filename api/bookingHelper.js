// api/bookingHelper.js

const { checkAvailability } = require('./googleCalendarService');
const logger = require('../logger');

const SLOT_DURATION_MINUTES = 20;
const SLOTS_PER_HOUR = 60 / SLOT_DURATION_MINUTES;

/**
 * Finds the next available 20-minute slots in an agent's calendar.
 * @param {string} agentId - The agent's ID.
 * @returns {Promise<Date[]>} A list of available slot start times.
 */
async function findNextAvailableSlots(agentId) {
    try {
        const now = new Date();
        const searchStart = new Date(now);
        searchStart.setDate(now.getDate() + 1); // Start search from tomorrow
        searchStart.setHours(9, 0, 0, 0); // Start at 9:00 AM SGT

        const searchEnd = new Date(searchStart);
        searchEnd.setDate(searchStart.getDate() + 5); // Search for the next 5 days
        searchEnd.setHours(18, 0, 0, 0); // End at 6:00 PM SGT

        // 1. Get all busy periods from Google Calendar
        const busySlots = await checkAvailability(agentId, searchStart.toISOString(), searchEnd.toISOString());

        // 2. Generate all potential slots within working hours
        const potentialSlots = [];
        let currentSlotTime = new Date(searchStart);

        while (currentSlotTime < searchEnd) {
            const day = currentSlotTime.getDay();
            const hour = currentSlotTime.getHours();

            // Check if it's a weekday (Monday=1 to Friday=5) and within working hours (9am to 6pm)
            if (day >= 1 && day <= 5 && hour >= 9 && hour < 18) {
                potentialSlots.push(new Date(currentSlotTime));
            }
            
            currentSlotTime.setMinutes(currentSlotTime.getMinutes() + SLOT_DURATION_MINUTES);
            
            // If we cross into the next day, reset time to 9 AM
            if (currentSlotTime.getDate() !== new Date(currentSlotTime - 1).getDate()) {
                currentSlotTime.setHours(9, 0, 0, 0);
            }
        }

        // 3. Filter out slots that overlap with busy periods
        const availableSlots = potentialSlots.filter(slot => {
            const slotStart = slot.getTime();
            const slotEnd = slotStart + SLOT_DURATION_MINUTES * 60 * 1000;

            const isOverlapping = busySlots.some(busy => {
                const busyStart = new Date(busy.start).getTime();
                const busyEnd = new Date(busy.end).getTime();
                // Check for any overlap
                return slotStart < busyEnd && slotEnd > busyStart;
            });

            return !isOverlapping;
        });

        logger.info({ agentId, count: availableSlots.length }, 'Found available booking slots.');
        return availableSlots.slice(0, 5); // Return up to 5 available slots
    } catch (error) {
        logger.error({ err: error, agentId }, 'Error finding available slots');
        return [];
    }
}

module.exports = { findNextAvailableSlots };