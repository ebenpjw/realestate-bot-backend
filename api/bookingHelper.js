// api/bookingHelper.js

const { checkAvailability } = require('./googleCalendarService');
const logger = require('../logger');

const SLOT_DURATION_MINUTES = 60; // 1 hour consultations
// const SLOTS_PER_HOUR = 60 / SLOT_DURATION_MINUTES; // Unused variable
const WORKING_HOURS_START = 8; // 8 AM
const WORKING_HOURS_END = 22; // 10 PM
const WORKING_DAYS = [0, 1, 2, 3, 4, 5, 6]; // All days (Sunday=0 to Saturday=6)

/**
 * Finds the next available 1-hour consultation slots in an agent's calendar.
 * @param {string} agentId - The agent's ID.
 * @param {Date} preferredTime - Optional preferred appointment time
 * @param {number} daysToSearch - Number of days to search ahead (default: 14)
 * @returns {Promise<Date[]>} A list of available slot start times.
 */
async function findNextAvailableSlots(agentId, preferredTime = null, daysToSearch = 14) {
    try {
        const now = new Date();
        const searchStart = new Date(now);

        // If preferred time is provided and it's in the future, start search from that day
        if (preferredTime && preferredTime > now) {
            searchStart.setTime(preferredTime.getTime());
            searchStart.setHours(WORKING_HOURS_START, 0, 0, 0);
        } else {
            // Start search from current time (no advance booking required)
            searchStart.setTime(now.getTime());
            // If current time is past working hours, start from next day
            if (now.getHours() >= WORKING_HOURS_END) {
                searchStart.setDate(now.getDate() + 1);
                searchStart.setHours(WORKING_HOURS_START, 0, 0, 0);
            }
        }

        const searchEnd = new Date(searchStart);
        searchEnd.setDate(searchStart.getDate() + daysToSearch);
        searchEnd.setHours(WORKING_HOURS_END, 0, 0, 0);

        // 1. Get all busy periods from Google Calendar
        const busySlots = await checkAvailability(agentId, searchStart.toISOString(), searchEnd.toISOString());

        // 2. Generate all potential slots within working hours
        const potentialSlots = [];
        const currentSlotTime = new Date(searchStart);

        while (currentSlotTime < searchEnd) {
            const day = currentSlotTime.getDay();
            const hour = currentSlotTime.getHours();

            // Check if it's within working hours (8am to 10pm) and working days (all days)
            if (WORKING_DAYS.includes(day) && hour >= WORKING_HOURS_START && hour < WORKING_HOURS_END) {
                potentialSlots.push(new Date(currentSlotTime));
            }

            currentSlotTime.setMinutes(currentSlotTime.getMinutes() + SLOT_DURATION_MINUTES);

            // If we cross into the next day, reset time to working hours start
            if (currentSlotTime.getDate() !== new Date(currentSlotTime - SLOT_DURATION_MINUTES * 60 * 1000).getDate()) {
                currentSlotTime.setHours(WORKING_HOURS_START, 0, 0, 0);
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

        // If preferred time was provided, sort by proximity to preferred time
        if (preferredTime) {
            availableSlots.sort((a, b) => {
                const diffA = Math.abs(a.getTime() - preferredTime.getTime());
                const diffB = Math.abs(b.getTime() - preferredTime.getTime());
                return diffA - diffB;
            });
        }

        logger.info({
            agentId,
            count: availableSlots.length,
            preferredTime: preferredTime?.toISOString(),
            searchDays: daysToSearch
        }, 'Found available consultation slots.');

        return availableSlots.slice(0, 5); // Return up to 5 available slots
    } catch (error) {
        logger.error({ err: error, agentId }, 'Error finding available slots');
        return [];
    }
}

/**
 * Parse user's preferred time from natural language
 * @param {string} message - User's message containing time preference
 * @returns {Date|null} Parsed preferred time or null if not found
 */
function parsePreferredTime(message) {
    try {
        const now = new Date();
        const lowerMessage = message.toLowerCase();

        // Common time patterns
        const timePatterns = [
            // "tomorrow at 3pm", "today at 2:30pm"
            /(?:tomorrow|today)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
            // "3pm tomorrow", "2:30pm today"
            /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+(?:tomorrow|today)/i,
            // "Monday at 3pm", "Tuesday 2pm"
            /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
            // Just time: "3pm", "2:30pm"
            /(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s|$)/i
        ];

        for (const pattern of timePatterns) {
            const match = lowerMessage.match(pattern);
            if (match) {
                const targetDate = new Date(now);
                let hour = parseInt(match[1] || match[2]);
                const minute = parseInt(match[2] || match[3] || '0');
                const ampm = (match[3] || match[4] || '').toLowerCase();

                // Convert to 24-hour format
                if (ampm === 'pm' && hour !== 12) hour += 12;
                if (ampm === 'am' && hour === 12) hour = 0;

                // Handle day references
                if (lowerMessage.includes('tomorrow')) {
                    targetDate.setDate(now.getDate() + 1);
                } else if (lowerMessage.includes('today')) {
                    // Keep current date
                } else {
                    // Handle day names (Monday, Tuesday, etc.)
                    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const dayMatch = lowerMessage.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
                    if (dayMatch) {
                        const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
                        const currentDay = now.getDay();
                        let daysToAdd = targetDay - currentDay;
                        if (daysToAdd <= 0) daysToAdd += 7; // Next week if day has passed
                        targetDate.setDate(now.getDate() + daysToAdd);
                    }
                }

                targetDate.setHours(hour, minute, 0, 0);

                // Only return if the time is in the future and within working hours
                if (targetDate > now &&
                    hour >= WORKING_HOURS_START &&
                    hour < WORKING_HOURS_END) {
                    return targetDate;
                }
            }
        }

        return null;
    } catch (error) {
        logger.error({ err: error, message }, 'Error parsing preferred time');
        return null;
    }
}

/**
 * Find the best matching slot for user's preference
 * @param {string} agentId - Agent ID
 * @param {string} userMessage - User's message with time preference
 * @returns {Promise<{exactMatch: Date|null, alternatives: Date[]}>}
 */
async function findMatchingSlot(agentId, userMessage) {
    try {
        const preferredTime = parsePreferredTime(userMessage);
        const availableSlots = await findNextAvailableSlots(agentId, preferredTime);

        if (!preferredTime) {
            // No specific time mentioned, return next available slots
            return {
                exactMatch: null,
                alternatives: availableSlots
            };
        }

        // Check if preferred time is available (within 30 minutes tolerance)
        const exactMatch = availableSlots.find(slot => {
            const timeDiff = Math.abs(slot.getTime() - preferredTime.getTime());
            return timeDiff <= 30 * 60 * 1000; // 30 minutes tolerance
        });

        return {
            exactMatch: exactMatch || null,
            alternatives: availableSlots.filter(slot => slot !== exactMatch)
        };
    } catch (error) {
        logger.error({ err: error, agentId, userMessage }, 'Error finding matching slot');
        return {
            exactMatch: null,
            alternatives: []
        };
    }
}

module.exports = {
    findNextAvailableSlots,
    parsePreferredTime,
    findMatchingSlot
};