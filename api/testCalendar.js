// api/testCalendar.js
// Test endpoint for Google Calendar integration

const express = require('express');
const router = express.Router();
const { testCalendarIntegration, createEvent } = require('./googleCalendarService');
const { formatForGoogleCalendar } = require('../utils/timezoneUtils');
const logger = require('../logger');

/**
 * Test Google Calendar integration
 * GET /api/test-calendar/:agentId
 */
router.get('/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    logger.info({ agentId }, 'Testing Google Calendar integration');
    
    const testResult = await testCalendarIntegration(agentId);
    
    res.json({
      success: true,
      testResult
    });
  } catch (error) {
    logger.error({ err: error }, 'Calendar integration test failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test creating a calendar event
 * POST /api/test-calendar/:agentId/create-event
 */
router.post('/:agentId/create-event', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    // Create a test event for 1 hour from now
    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration
    
    const eventDetails = {
      summary: '🧪 Test Calendar Event',
      description: 'This is a test event created by the calendar integration test.\n\nIf you see this event, the integration is working correctly!',
      startTimeISO: formatForGoogleCalendar(startTime),
      endTimeISO: formatForGoogleCalendar(endTime)
    };
    
    logger.info({ 
      agentId, 
      eventDetails,
      startTimeLocal: startTime.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
      endTimeLocal: endTime.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
    }, 'Creating test calendar event');
    
    const calendarEvent = await createEvent(agentId, eventDetails);
    
    res.json({
      success: true,
      message: 'Test calendar event created successfully',
      event: {
        id: calendarEvent.id,
        htmlLink: calendarEvent.htmlLink,
        summary: calendarEvent.summary,
        start: calendarEvent.start,
        end: calendarEvent.end
      }
    });
  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to create test calendar event');
    res.status(500).json({
      success: false,
      error: error.message,
      details: {
        code: error.code,
        status: error.status
      }
    });
  }
});

module.exports = router;
