# Zoom Marketplace App Information

## Basic Information
- **App Name:** Real Estate AI Assistant
- **Company Name:** Marketing with Doro
- **Contact Name:** Dorothy
- **Contact Email:** dorothy@marketingwithdoro.com

## OAuth Configuration
- **Client ID:** V1J6oJ7sRPu7HwB735k94Q
- **Client Secret:** a8IhehOFJrTsrlXCc7RJ1R41bAEngWoA
- **Redirect URL:** https://realestate-bot-backend-production.up.railway.app/api/auth/zoom/callback

## Scopes
- meeting:write:meeting (Create a meeting for a user)
- user:read:user (View a user)

## Short Description
AI-powered real estate assistant that schedules property consultations via Zoom meetings.

## Long Description
Our Real Estate AI Assistant streamlines property consultation booking by automatically scheduling Zoom meetings between potential buyers and real estate agents. The bot handles initial inquiries, qualifies leads, and seamlessly integrates with agents' calendars to book convenient consultation times.

Key Features:
• Automated lead qualification through WhatsApp integration
• Smart Google Calendar integration for availability checking
• Instant Zoom meeting creation with professional settings
• WABA-compliant messaging for international reach
• Secure token management and encryption
• Real-time lead tracking and management

Perfect for real estate agencies looking to automate their initial client interactions while maintaining a personal touch through scheduled video consultations. The system ensures compliance with WhatsApp Business API regulations while providing a seamless experience for both agents and potential clients.

## Cover Image Description
A professional interface showing the Real Estate AI Assistant workflow - from WhatsApp inquiry to scheduled Zoom consultation, highlighting the seamless integration between messaging, calendar, and video conferencing.

## App Gallery Descriptions

### Image 1: WhatsApp Integration
Shows how potential clients can interact with the AI assistant through WhatsApp, with natural conversation flow leading to consultation booking.

### Image 2: Calendar Integration
Demonstrates the smart calendar integration that checks agent availability and suggests optimal meeting times.

### Image 3: Zoom Meeting Creation
Displays the automatic Zoom meeting creation process with professional settings and secure access.

### Image 4: Lead Management Dashboard
Shows the comprehensive lead tracking system that helps agents manage their pipeline effectively.

### Image 5: Complete Workflow
Illustrates the end-to-end process from initial WhatsApp contact to completed Zoom consultation.

## Technical Specifications
- **Platform:** Node.js with Express
- **Database:** Supabase with Row Level Security
- **Integrations:** WhatsApp Business API (Gupshup), Google Calendar, Zoom, OpenAI
- **Security:** Encrypted token storage, CSRF protection, rate limiting
- **Compliance:** WABA-compliant messaging templates
- **Deployment:** Railway platform with environment variable management
