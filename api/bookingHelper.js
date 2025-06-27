// api/bookingHelper.js

const { checkAvailability } = require('./googleCalendarService');
const supabase = require('../supabaseClient');
const logger = require('../logger');

const SLOT_DURATION_MINUTES = 60; // 1 hour consultations

/**
 * Get current time in Singapore timezone
 * @returns {Date} Current time in Singapore (properly adjusted for UTC storage)
 */
function getSingaporeTime() {
    const now = new Date();
    // Get Singapore time offset (UTC+8 = 8 hours = 8 * 60 * 60 * 1000 ms)
    const singaporeOffset = 8 * 60 * 60 * 1000;
    // Return UTC time adjusted for Singapore timezone
    return new Date(now.getTime() + singaporeOffset - (now.getTimezoneOffset() * 60 * 1000));
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
            logger.warn({ agentId, error }, 'Could not fetch agent working hours, using extended defaults');
            return {
                start: 8,
                end: 23, // 11pm
                days: [1, 2, 3, 4, 5, 6, 7], // All days of the week
                timezone: 'Asia/Singapore'
            };
        }

        // If agent has working hours but they're restrictive, use extended defaults
        // This allows agents to have extended hours unless they specifically set restrictions
        const agentHours = agent.working_hours;

        // Use extended defaults if agent doesn't have specific working hours configured
        // or if their hours are the old restrictive defaults (9-18, Mon-Fri)
        const isRestrictiveDefaults = agentHours &&
            agentHours.start === 9 &&
            agentHours.end === 18 &&
            agentHours.days &&
            agentHours.days.length === 5 &&
            agentHours.days.every(day => [1,2,3,4,5].includes(day));

        if (!agentHours || isRestrictiveDefaults) {
            logger.info({ agentId, agentHours }, 'Using extended default working hours instead of restrictive settings');
            return {
                start: 8,
                end: 23, // 11pm
                days: [1, 2, 3, 4, 5, 6, 7], // All days of the week
                timezone: agent.timezone || 'Asia/Singapore'
            };
        }

        return {
            ...agentHours,
            timezone: agent.timezone || 'Asia/Singapore'
        };
    } catch (error) {
        logger.error({ err: error, agentId }, 'Error fetching agent working hours');
        return {
            start: 8,
            end: 23, // 11pm
            days: [1, 2, 3, 4, 5, 6, 7], // All days of the week
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

        // Get current time in Singapore timezone
        const singaporeTime = getSingaporeTime();

        logger.info({
            agentId,
            currentTimeSingapore: singaporeTime.toISOString(),
            currentHourSingapore: singaporeTime.getHours(),
            currentDaySingapore: singaporeTime.getDay(),
            timezone: workingHours.timezone
        }, 'Current time information for slot calculation');

        // Calculate search start time in Singapore timezone
        const searchStart = new Date(singaporeTime);

        // If preferred time is provided and it's in the future, start search from that day
        if (preferredTime && preferredTime > singaporeTime) {
            // Preferred time is already in Singapore timezone
            searchStart.setTime(preferredTime.getTime());
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
            searchStart: searchStart.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
            searchEnd: searchEnd.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
            searchStartISO: searchStart.toISOString(),
            searchEndISO: searchEnd.toISOString()
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

                // Check for any overlap - slot overlaps if:
                // 1. Slot starts before busy period ends AND
                // 2. Slot ends after busy period starts
                const hasOverlap = slotStart < busyEnd && slotEnd > busyStart;

                if (hasOverlap) {
                    logger.info({
                        agentId,
                        slotTime: slot.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
                        busyPeriod: `${new Date(busy.start).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} - ${new Date(busy.end).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`
                    }, 'Slot overlaps with busy period - filtering out');
                }

                return hasOverlap;
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

        return availableSlots.slice(0, 10); // Return up to 10 available slots to include afternoon times
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
        const now = getSingaporeTime();
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
 * Check if a specific time slot is available
 * @param {string} agentId - Agent ID
 * @param {Date} requestedTime - The specific time to check
 * @returns {Promise<boolean>} True if the time is available
 */
async function isTimeSlotAvailable(agentId, requestedTime) {
    try {
        const workingHours = await getAgentWorkingHours(agentId);

        // Check if time is within working hours
        const hour = requestedTime.getHours();
        const day = requestedTime.getDay();

        if (!workingHours.days.includes(day) || hour < workingHours.start || hour >= workingHours.end) {
            logger.info({
                agentId,
                requestedTime: requestedTime.toISOString(),
                hour, day, workingHours
            }, 'Requested time is outside working hours');
            return false;
        }

        // Check for calendar conflicts
        const slotStart = requestedTime.toISOString();
        const slotEnd = new Date(requestedTime.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour later

        const busySlots = await checkAvailability(agentId, slotStart, slotEnd);

        // Check if there are any overlapping busy periods
        const hasConflict = busySlots.some(busy => {
            const busyStart = new Date(busy.start).getTime();
            const busyEnd = new Date(busy.end).getTime();
            const requestedStart = requestedTime.getTime();
            const requestedEnd = requestedStart + 60 * 60 * 1000; // 1 hour

            // Check for any overlap
            return requestedStart < busyEnd && requestedEnd > busyStart;
        });

        logger.info({
            agentId,
            requestedTime: requestedTime.toISOString(),
            hasConflict,
            busySlotsCount: busySlots.length
        }, 'Checked specific time slot availability');

        return !hasConflict;
    } catch (error) {
        logger.error({ err: error, agentId, requestedTime }, 'Error checking time slot availability');
        return false;
    }
}

/**
 * Find nearby available slots around a specific time
 * @param {string} agentId - Agent ID
 * @param {Date} requestedTime - The requested time
 * @param {number} hoursRange - How many hours before/after to search (default: 4)
 * @returns {Promise<Date[]>} Array of nearby available slots
 */
async function findNearbyAvailableSlots(agentId, requestedTime, hoursRange = 4) {
    try {
        const workingHours = await getAgentWorkingHours(agentId);
        const nearbySlots = [];

        // Generate slots before and after the requested time
        for (let hourOffset = -hoursRange; hourOffset <= hoursRange; hourOffset++) {
            if (hourOffset === 0) continue; // Skip the exact requested time

            const candidateTime = new Date(requestedTime);
            candidateTime.setHours(requestedTime.getHours() + hourOffset);

            // Check if within working hours
            const hour = candidateTime.getHours();
            const day = candidateTime.getDay();

            if (workingHours.days.includes(day) && hour >= workingHours.start && hour < workingHours.end) {
                const isAvailable = await isTimeSlotAvailable(agentId, candidateTime);
                if (isAvailable) {
                    nearbySlots.push(candidateTime);
                }
            }
        }

        // Sort by proximity to requested time
        nearbySlots.sort((a, b) => {
            const diffA = Math.abs(a.getTime() - requestedTime.getTime());
            const diffB = Math.abs(b.getTime() - requestedTime.getTime());
            return diffA - diffB;
        });

        logger.info({
            agentId,
            requestedTime: requestedTime.toISOString(),
            nearbyCount: nearbySlots.length,
            nearbyTimes: nearbySlots.slice(0, 3).map(slot => slot.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }))
        }, 'Found nearby available slots');

        return nearbySlots;
    } catch (error) {
        logger.error({ err: error, agentId, requestedTime }, 'Error finding nearby slots');
        return [];
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

        if (!preferredTime) {
            // No specific time mentioned, return next available slots
            const availableSlots = await findNextAvailableSlots(agentId, null);
            return {
                exactMatch: null,
                alternatives: availableSlots.slice(0, 5) // Reasonable default for general availability
            };
        }

        logger.info({
            agentId,
            preferredTime: preferredTime.toISOString(),
            preferredTimeLocal: preferredTime.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
        }, 'Checking if preferred time is available');

        // Directly check if the preferred time is available
        const isAvailable = await isTimeSlotAvailable(agentId, preferredTime);

        if (isAvailable) {
            logger.info({ agentId, preferredTime: preferredTime.toISOString() }, 'Preferred time is available - exact match found');

            return {
                exactMatch: preferredTime,
                alternatives: [] // No alternatives needed when exact match is found
            };
        } else {
            logger.info({ agentId, preferredTime: preferredTime.toISOString() }, 'Preferred time not available - finding nearby alternatives');

            // Find nearby alternatives around the requested time
            const nearbySlots = await findNearbyAvailableSlots(agentId, preferredTime);

            if (nearbySlots.length === 0) {
                // If no nearby slots, fall back to general availability
                logger.info({ agentId }, 'No nearby slots found, falling back to general availability');
                const generalSlots = await findNextAvailableSlots(agentId, null);
                return {
                    exactMatch: null,
                    alternatives: generalSlots.slice(0, 5)
                };
            }

            return {
                exactMatch: null,
                alternatives: nearbySlots.slice(0, 5) // Limit to 5 closest alternatives
            };
        }
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
    findMatchingSlot,
    isTimeSlotAvailable,
    findNearbyAvailableSlots
};