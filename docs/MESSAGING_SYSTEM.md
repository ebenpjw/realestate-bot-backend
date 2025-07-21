# WhatsApp Business Messaging System

## Overview

A comprehensive message sending system for the agent dashboard that allows agents to send individual and bulk WhatsApp messages using approved templates. The system integrates with Gupshup Partner API and supports real-time progress tracking, template creation, and campaign management.

## Features

### ✅ Completed Features

1. **Template Management**
   - Fetch approved templates from Gupshup Partner API
   - Template selection with preview and parameter highlighting
   - Template creation interface with validation
   - Category filtering (Marketing, Utility, Authentication)
   - Search functionality

2. **Lead Selection**
   - Lead list with search and filtering
   - Bulk selection capabilities
   - Lead information display (name, phone, status, intent, etc.)
   - Selection count and management

3. **Message Composition**
   - Template parameter input with validation
   - Real-time message preview
   - Parameter validation and error handling
   - Message length estimation

4. **Individual Messaging**
   - Send messages to single leads
   - Template parameter substitution
   - Success/error feedback
   - Message logging in database

5. **Bulk Messaging**
   - Send messages to multiple leads simultaneously
   - Campaign creation and tracking
   - Real-time progress updates via WebSocket
   - Pause/resume/cancel functionality
   - Rate limiting compliance

6. **Campaign Management**
   - Campaign history and analytics
   - Status tracking (pending, in_progress, completed, failed, paused)
   - Performance metrics (sent, delivered, failed counts)
   - Campaign details and error tracking

7. **Real-time Updates**
   - WebSocket integration for live progress updates
   - Bulk messaging progress indicators
   - Campaign completion notifications
   - Error handling and user feedback

8. **Testing Infrastructure**
   - Comprehensive Playwright test suite
   - API mocking to prevent actual WhatsApp messages
   - Performance testing
   - Error handling validation

## Architecture

### Backend Components

1. **API Endpoints** (`/api/messages.js`)
   - `GET /api/messages/templates` - Fetch approved templates
   - `GET /api/messages/leads` - Get leads for messaging
   - `POST /api/messages/send` - Send individual message
   - `POST /api/messages/send-bulk` - Start bulk campaign
   - `GET /api/messages/campaigns` - Get campaign history
   - `POST /api/messages/templates` - Create new template
   - Campaign control endpoints (pause/resume/cancel)

2. **Message Service** (`services/messageService.js`)
   - Gupshup Partner API v3 integration
   - Rate limiting and retry logic
   - Bulk message processing with pause/resume support
   - Message logging and campaign tracking
   - WebSocket notifications

3. **Database Schema**
   - `message_campaigns` table for bulk campaign tracking
   - Enhanced `messages` table with template and campaign references
   - RLS policies for multi-tenant security
   - Analytics views for reporting

### Frontend Components

1. **Main Messages Page** (`/agent/messages`)
   - Tab-based interface (Send, Create, History)
   - Real-time WebSocket integration
   - Responsive design

2. **Template Selector** (`TemplateSelector.tsx`)
   - Template grid with search and filtering
   - Template preview modal
   - Category-based organization

3. **Lead Selector** (`LeadSelector.tsx`)
   - Lead list with bulk selection
   - Search and status filtering
   - Lead information display

4. **Message Composer** (`MessageComposer.tsx`)
   - Parameter input and validation
   - Real-time message preview
   - Send button logic (individual vs bulk)

5. **Bulk Progress Tracker** (`BulkMessageProgress.tsx`)
   - Real-time progress display
   - Campaign control buttons
   - Status indicators and metrics

6. **Template Creator** (`TemplateCreator.tsx`)
   - Template creation form
   - Parameter management
   - Validation and preview

7. **Campaign History** (`CampaignHistory.tsx`)
   - Campaign list with filtering
   - Performance metrics
   - Campaign details modal

## Database Setup

Run the following SQL in your Supabase SQL Editor:

```sql
-- See database/message_campaigns_schema.sql for complete schema
```

## API Integration

### Gupshup Partner API Configuration

The system uses Gupshup Partner API v3 for message sending:

1. **Authentication**: Uses app-specific access tokens
2. **Rate Limiting**: 1 second delay between messages
3. **Retry Logic**: Exponential backoff for failures
4. **Webhook Integration**: Delivery status updates

### Multi-tenant Architecture

Each agent has their own:
- WABA credentials and app ID
- Template library (filtered by agent)
- Lead database (agent-specific)
- Campaign history

## Testing

### Playwright Test Suite

Location: `tests/messages.spec.js`

**Test Coverage:**
- Template loading and selection
- Lead selection and filtering
- Message composition and validation
- Individual message sending
- Bulk campaign creation
- Template creation
- Campaign history display
- Error handling
- Performance testing

**Running Tests:**
```bash
npx playwright test tests/messages.spec.js
```

**Important:** Tests use API mocking to prevent actual WhatsApp messages from being sent.

## Usage Guide

### For Agents

1. **Navigate to Messages**
   - Click "Messages" in the agent sidebar
   - View the three-tab interface

2. **Send Individual Messages**
   - Select a template from the left panel
   - Choose one lead from the center panel
   - Fill in template parameters
   - Preview the message
   - Click "Send to 1 Lead"

3. **Send Bulk Messages**
   - Select a template
   - Choose multiple leads (use checkboxes)
   - Fill in template parameters
   - Click "Send Bulk (X leads)"
   - Monitor progress in real-time
   - Use pause/resume/cancel as needed

4. **Create Templates**
   - Switch to "Create Template" tab
   - Fill in template details
   - Add parameters using {{1}}, {{2}} syntax
   - Preview the template
   - Submit for approval

5. **View Campaign History**
   - Switch to "Campaign History" tab
   - Filter by status or search campaigns
   - Click campaigns for detailed metrics

### For Developers

1. **Adding New Template Categories**
   - Update the category enum in the API
   - Add to frontend select options
   - Update validation logic

2. **Extending Message Types**
   - Modify Gupshup API integration
   - Update template creation form
   - Add new validation rules

3. **Custom Analytics**
   - Use existing database views
   - Create new analytics endpoints
   - Add frontend visualization

## Security Considerations

1. **Row Level Security (RLS)**
   - All tables have agent-specific policies
   - Agents can only access their own data

2. **API Authentication**
   - All endpoints require valid JWT tokens
   - Agent ID validation on all operations

3. **Rate Limiting**
   - Built-in delays prevent API abuse
   - Exponential backoff for failures

4. **Data Validation**
   - Template content validation
   - Parameter sanitization
   - Phone number formatting

## Performance Optimizations

1. **Database Indexing**
   - Optimized queries for large datasets
   - Proper indexes on frequently queried columns

2. **Frontend Optimization**
   - Lazy loading for large lead lists
   - Efficient re-rendering with React hooks
   - Debounced search inputs

3. **API Efficiency**
   - Batch operations where possible
   - Pagination for large datasets
   - Caching for frequently accessed data

## Troubleshooting

### Common Issues

1. **Templates Not Loading**
   - Check Gupshup Partner API credentials
   - Verify agent has approved templates
   - Check network connectivity

2. **Messages Not Sending**
   - Verify WABA configuration
   - Check template approval status
   - Validate phone number format

3. **Bulk Campaigns Stuck**
   - Check campaign status in database
   - Verify WebSocket connection
   - Review error logs

### Debug Tools

1. **Browser Console**
   - WebSocket connection status
   - API response errors
   - Component state debugging

2. **Network Tab**
   - API request/response inspection
   - Rate limiting detection
   - Error response analysis

3. **Database Queries**
   - Campaign status monitoring
   - Message delivery tracking
   - Error log analysis

## Future Enhancements

1. **Advanced Analytics**
   - Delivery rate tracking
   - Response rate analysis
   - A/B testing for templates

2. **Scheduling**
   - Delayed message sending
   - Recurring campaigns
   - Time zone optimization

3. **Rich Media**
   - Image and document support
   - Interactive buttons
   - Location sharing

4. **Integration Expansion**
   - Multiple WhatsApp providers
   - SMS fallback
   - Email integration

## Support

For technical support or feature requests:
1. Check the troubleshooting guide above
2. Review the test suite for expected behavior
3. Consult the API documentation
4. Contact the development team

---

**Last Updated:** January 2025
**Version:** 1.0.0
**Status:** Production Ready
