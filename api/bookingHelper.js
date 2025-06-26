// api/bookingHelper.js

const { checkAvailability } = require('./googleCalendarService');
const supabase = require('../supabaseClient');
const logger = require('../logger');

const SLOT_DURATION_MINUTES = 60; // 1 hour consultations
const SINGAPORE_OFFSET = 8 * 60 * 60 * 1000; // GMT+8 in milliseconds

/**
 * Get current time in Singapore timezone
 * @returns {Date} Current time in Singapore
 */
function getSingaporeTime() {
    const now = new Date();
    // Use proper timezone conversion
    return new Date(now.toLocaleString("en-US", {timeZone: "Asia/Singapore"}));
}

/**
 * Convert UTC time to Singapore time
 * @param {Date} utcDate - UTC date
 * @returns {Date} Singapore time
 */
function toSingaporeTime(utcDate) {
    return new Date(utcDate.toLocaleString("en-US", {timeZone: "Asia/Singapore"}));
}

/**
 * Convert Singapore time to UTC (approximate)
 * @param {Date} singaporeDate - Singapore time
 * @returns {Date} UTC time
 */
function toUTC(singaporeDate) {
    return new Date(singaporeDate.getTime() - SINGAPORE_OFFSET);
}

/**
 * Get agent's working hours from database
 * @param {string} agentId - The agent's ID
 * @returns {Promise<Object>} Working hours configuration
 */
async function getAgentWorkingHours(agentId) {
    try {
        const { data: agent, error } = await supabase
            .from('agents')
            .select('working_hours, timezone')
            .eq('id', agentId)
            .single();

        if (error || !agent) {
            logger.warn({ agentId, error }, 'Could not fetch agent working hours, using defaults');
            return {
                start: 9,
                end: 18,
                days: [1, 2, 3, 4, 5], // Monday to Friday
                timezone: 'Asia/Singapore'
            };
        }

        return {
            ...agent.working_hours,
            timezone: agent.timezone || 'Asia/Singapore'
        };
    } catch (error) {
        logger.error({ err: error, agentId }, 'Error fetching agent working hours');
        return {
            start: 9,
            end: 18,
            days: [1, 2, 3, 4, 5],
            timezone: 'Asia/Singapore'
        };
    }
}

/**
 * Finds the next available 1-hour consultation slots in an agent's calendar.
 * @param {string} agentId - The agent's ID.
 * @param {Date} preferredTime - Optional preferred appointment time
 * @param {number} daysToSearch - Number of days to search ahead (default: 14)
 * @returns {Promise<Date[]>} A list of available slot start times.
 */
async function findNextAvailableSlots(agentId, preferredTime = null, daysToSearch = 14) {
    try {
        // Get agent's actual working hours from database
        const workingHours = await getAgentWorkingHours(agentId);

        logger.info({
            agentId,
            workingHours,
            preferredTime: preferredTime?.toISOString(),
            daysToSearch
        }, 'Finding available slots with agent working hours');

        // Get current time and convert to Singapore timezone properly
        const now = new Date();

        // Get Singapore time using proper timezone conversion
        const singaporeTimeString = now.toLocaleString("en-US", {timeZone: "Asia/Singapore"});
        const singaporeTime = new Date(singaporeTimeString);

        logger.info({
            agentId,
            currentTimeUTC: now.toISOString(),
            singaporeTimeString,
            currentTimeSingapore: singaporeTime.toISOString(),
            currentHourSingapore: singaporeTime.getHours(),
            currentDaySingapore: singaporeTime.getDay(),
            timezone: workingHours.timezone
        }, 'Current time information for slot calculation');

        // Calculate search start time in Singapore timezone
        const searchStart = new Date(singaporeTime);

        // If preferred time is provided and it's in the future, start search from that day
        if (preferredTime && preferredTime > now) {
            const preferredSingaporeTime = toSingaporeTime(preferredTime);
            searchStart.setTime(preferredSingaporeTime.getTime());
            searchStart.setHours(workingHours.start, 0, 0, 0);
        } else {
            // Start search from next available hour (based on Singapore time)
            const currentHourSingapore = singaporeTime.getHours();
            const currentDaySingapore = singaporeTime.getDay();
            const nextHour = currentHourSingapore + 1;

            logger.info({
                agentId,
                currentHourSingapore,
                nextHour,
                workingHoursEnd: workingHours.end,
                currentDaySingapore,
                isWeekend: currentDaySingapore === 0 || currentDaySingapore === 6,
                isWorkingDay: workingHours.days.includes(currentDaySingapore)
            }, 'Determining search start time logic');

            // Check if we need to move to next working day
            if (nextHour >= workingHours.end || currentDaySingapore === 0 || currentDaySingapore === 6) {
                // If next hour is past working hours or it's weekend, start from next working day
                const nextWorkingDay = new Date(singaporeTime);
                nextWorkingDay.setDate(singaporeTime.getDate() + 1);

                // Skip weekends
                while (nextWorkingDay.getDay() === 0 || nextWorkingDay.getDay() === 6) {
                    nextWorkingDay.setDate(nextWorkingDay.getDate() + 1);
                }

                nextWorkingDay.setHours(workingHours.start, 0, 0, 0);
                searchStart.setTime(nextWorkingDay.getTime());

                logger.info({
                    agentId,
                    reason: 'Next working day',
                    nextWorkingDay: nextWorkingDay.toISOString(),
                    searchStartAfterSet: searchStart.toISOString()
                }, 'Set search start to next working day');
            } else if (workingHours.days.includes(currentDaySingapore) && nextHour < workingHours.end) {
                // Start from next hour today if within working hours
                searchStart.setHours(nextHour, 0, 0, 0);

                logger.info({
                    agentId,
                    reason: 'Next hour today',
                    nextHour,
                    searchStartAfterSet: searchStart.toISOString()
                }, 'Set search start to next hour today');
            } else {
                // Start from beginning of working hours tomorrow
                const nextWorkingDay = new Date(singaporeTime);
                nextWorkingDay.setDate(singaporeTime.getDate() + 1);

                // Skip weekends
                while (nextWorkingDay.getDay() === 0 || nextWorkingDay.getDay() === 6) {
                    nextWorkingDay.setDate(nextWorkingDay.getDate() + 1);
                }

                nextWorkingDay.setHours(workingHours.start, 0, 0, 0);
                searchStart.setTime(nextWorkingDay.getTime());

                logger.info({
                    agentId,
                    reason: 'Beginning of working hours tomorrow',
                    nextWorkingDay: nextWorkingDay.toISOString(),
                    searchStartAfterSet: searchStart.toISOString()
                }, 'Set search start to beginning of working hours tomorrow');
            }
        }

        // Calculate search end time (also in Singapore time)
        const searchEnd = new Date(searchStart);
        searchEnd.setDate(searchStart.getDate() + daysToSearch);
        searchEnd.setHours(workingHours.end, 0, 0, 0);

        logger.info({
            agentId,
            searchStartSingapore: searchStart.toISOString(),
            searchEndSingapore: searchEnd.toISOString(),
            searchStartLocal: searchStart.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
            searchEndLocal: searchEnd.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
        }, 'Calculated search time range (Singapore time)');

        // 1. Get all busy periods from Google Calendar (Singapore time)
        logger.info({
            agentId,
            searchStart: searchStart.toISOString(),
            searchEnd: searchEnd.toISOString()
        }, 'Checking calendar availability for date range');

        const busySlots = await checkAvailability(agentId, searchStart.toISOString(), searchEnd.toISOString());

        logger.info({
            agentId,
            busySlotsCount: busySlots.length,
            busySlots: busySlots.map(slot => ({ start: slot.start, end: slot.end }))
        }, 'Retrieved busy slots from calendar');

        // 2. Generate all potential slots within working hours (in Singapore time)
        const potentialSlots = [];
        const currentSlotTime = new Date(searchStart);

        while (currentSlotTime < searchEnd) {
            const day = currentSlotTime.getDay();
            const hour = currentSlotTime.getHours();

            // Check if it's within working hours and working days
            if (workingHours.days.includes(day) && hour >= workingHours.start && hour < workingHours.end) {
                // Keep in Singapore time for consistency
                potentialSlots.push(new Date(currentSlotTime));
            }

            currentSlotTime.setMinutes(currentSlotTime.getMinutes() + SLOT_DURATION_MINUTES);

            // If we cross into the next day, reset time to working hours start
            if (currentSlotTime.getDate() !== new Date(currentSlotTime - SLOT_DURATION_MINUTES * 60 * 1000).getDate()) {
                currentSlotTime.setHours(workingHours.start, 0, 0, 0);
            }
        }

        logger.info({
            agentId,
            potentialSlotsCount: potentialSlots.length,
            firstFewSlots: potentialSlots.slice(0, 3).map(slot => slot.toISOString())
        }, 'Generated potential appointment slots');

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
        // Use Singapore timezone for consistency
        const now = new Date();
        const lowerMessage = message.toLowerCase();

        logger.info({ message, lowerMessage }, 'Parsing preferred time from message');

        // Common time patterns with proper capture groups
        const timePatterns = [
            // "tomorrow at 3pm", "today at 2:30pm"
            {
                pattern: /(?:tomorrow|today)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
                hourIndex: 1, minuteIndex: 2, ampmIndex: 3
            },
            // "3pm tomorrow", "2:30pm today"
            {
                pattern: /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+(?:tomorrow|today)/i,
                hourIndex: 1, minuteIndex: 2, ampmIndex: 3
            },
            // "Monday at 3pm", "Tuesday 2pm"
            {
                pattern: /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
                hourIndex: 2, minuteIndex: 3, ampmIndex: 4
            },
            // Just time: "3pm", "2:30pm", "for 2pm"
            {
                pattern: /(?:^|\s|for\s+)(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s|$)/i,
                hourIndex: 1, minuteIndex: 2, ampmIndex: 3
            }
        ];

        for (const { pattern, hourIndex, minuteIndex, ampmIndex } of timePatterns) {
            const match = lowerMessage.match(pattern);
            if (match) {
                logger.info({ match: match[0], fullMatch: match }, 'Found time pattern match');

                const targetDate = new Date(now);
                let hour = parseInt(match[hourIndex]);
                const minute = parseInt(match[minuteIndex] || '0');
                const ampm = match[ampmIndex].toLowerCase();

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

                logger.info({
                    parsedTime: targetDate.toISOString(),
                    parsedTimeLocal: targetDate.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
                    hour, minute, ampm,
                    isInFuture: targetDate > now
                }, 'Parsed preferred time');

                // Return the parsed time if it's in the future (working hours check will be done later)
                if (targetDate > now) {
                    return targetDate;
                }
            }
        }

        logger.info({ message }, 'No preferred time found in message');
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
    getAgentWorkingHours,
    findNextAvailableSlots,
    parsePreferredTime,
    findMatchingSlot
};