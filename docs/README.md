# Real Estate Bot Backend Documentation

Welcome to the comprehensive documentation for the Real Estate Bot Backend system. This documentation serves as your central hub for understanding, deploying, and maintaining the system.

## 📚 Documentation Index

### Getting Started
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Complete setup and deployment instructions
- **[Environment Configuration](.env.example)** - Required environment variables and configuration
- **[Quick Start Guide](QUICK_START.md)** - Get up and running in minutes

### Architecture & System Design
- **[Architecture Analysis](ARCHITECTURE_ANALYSIS.md)** - Comprehensive system architecture overview
- **[Multi-Tenant Summary](MULTI_TENANT_SUMMARY.md)** - Multi-tenant architecture and implementation
- **[Database Schema](../database/clean_minimal_schema.sql)** - Current database structure

### API Documentation
- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference
- **[Authentication Guide](AUTH_GUIDE.md)** - Authentication and authorization
- **[Rate Limiting](RATE_LIMITING.md)** - API rate limiting and throttling

### Development
- **[Development Memory Guide](DEVELOPMENT_MEMORY_GUIDE.md)** - Development best practices and patterns
- **[Testing Guide](TESTING_GUIDE.md)** - Testing strategies and implementation
- **[Contributing Guidelines](CONTRIBUTING.md)** - How to contribute to the project

### Production & Operations
- **[Production Readiness Report](PRODUCTION_READINESS_REPORT.md)** - Production deployment checklist
- **[Monitoring & Logging](MONITORING.md)** - System monitoring and logging
- **[Performance Optimization](PERFORMANCE.md)** - Performance tuning and optimization

### Features & Services
- **[AI System Documentation](AI_SYSTEM.md)** - AI conversation and learning system
- **[Template System](TEMPLATE_SYSTEM.md)** - WhatsApp template management
- **[Visual Property Data System](VISUAL_PROPERTY_DATA_SYSTEM.md)** - Property data and visual analysis
- **[Appointment Booking](APPOINTMENT_BOOKING.md)** - Appointment scheduling system
- **[WhatsApp Integration](WHATSAPP_INTEGRATION.md)** - WhatsApp Business API integration

### Security & Compliance
- **[Security Guide](SECURITY.md)** - Security best practices and implementation
- **[PDPA Compliance](PDPA_COMPLIANCE.md)** - Data protection and privacy compliance
- **[Audit Trail](AUDIT_TRAIL.md)** - System auditing and compliance tracking

### Troubleshooting & Support
- **[Troubleshooting Guide](TROUBLESHOOTING.md)** - Common issues and solutions
- **[FAQ](FAQ.md)** - Frequently asked questions
- **[Error Codes](ERROR_CODES.md)** - System error codes and meanings

## 🏗️ System Overview

The Real Estate Bot Backend is a comprehensive multi-tenant system designed for real estate agents to manage leads, appointments, and customer interactions through WhatsApp Business API integration.

### Key Features
- **Multi-Tenant Architecture** - Support for multiple agents with isolated data
- **AI-Powered Conversations** - Intelligent lead qualification and appointment booking
- **WhatsApp Business Integration** - Native WhatsApp messaging with template support
- **Visual Property Data** - Property scraping and visual analysis
- **Appointment Management** - Integrated Google Calendar and Zoom scheduling
- **Real-time Analytics** - Comprehensive dashboard and reporting

### Technology Stack
- **Backend**: Node.js with Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT with multi-tenant support
- **External APIs**: WhatsApp Business, Google Calendar, Zoom, OpenAI
- **Deployment**: Railway with automated CI/CD

## 🚀 Quick Navigation

### For Developers
1. Start with [Architecture Analysis](ARCHITECTURE_ANALYSIS.md) to understand the system
2. Follow [Deployment Guide](DEPLOYMENT_GUIDE.md) for local setup
3. Review [Development Memory Guide](DEVELOPMENT_MEMORY_GUIDE.md) for best practices
4. Check [API Documentation](API_DOCUMENTATION.md) for endpoint details

### For System Administrators
1. Review [Production Readiness Report](PRODUCTION_READINESS_REPORT.md)
2. Configure monitoring using [Monitoring & Logging](MONITORING.md)
3. Implement security measures from [Security Guide](SECURITY.md)
4. Set up compliance tracking per [PDPA Compliance](PDPA_COMPLIANCE.md)

### For Business Users
1. Understand system capabilities in [Multi-Tenant Summary](MULTI_TENANT_SUMMARY.md)
2. Learn about AI features in [AI System Documentation](AI_SYSTEM.md)
3. Review appointment booking in [Appointment Booking](APPOINTMENT_BOOKING.md)
4. Check analytics features in the dashboard documentation

## 📋 System Requirements

### Minimum Requirements
- Node.js 18+ (recommended: 20+)
- PostgreSQL 13+ (via Supabase)
- 512MB RAM minimum (2GB+ recommended)
- SSL certificate for production

### External Service Dependencies
- Supabase (Database & Authentication)
- WhatsApp Business API (Gupshup)
- Google Calendar API
- Zoom API
- OpenAI API

## 🔧 Configuration

The system uses environment variables for configuration. See [.env.example](../.env.example) for all required variables.

Key configuration areas:
- Database connection (Supabase)
- WhatsApp Business API credentials
- Google Calendar integration
- Zoom meeting integration
- OpenAI API configuration
- Security keys and tokens

## 📈 Monitoring & Health Checks

The system provides comprehensive health monitoring:

- **Health Endpoint**: `/health` - Overall system status
- **Feature Status**: `/debug/features` - Optional feature availability
- **Database Status**: Included in health checks
- **External Service Status**: API connectivity monitoring

## 🗂️ Historical Documentation

Previous implementation plans and historical documentation have been archived in `/archive/docs/` for reference:

- Multi-tenant implementation plans
- Database migration histories
- Legacy deployment guides
- Completed feature specifications

## 📞 Support & Contact

For technical support or questions:
1. Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
2. Review [FAQ](FAQ.md) for common questions
3. Consult [Error Codes](ERROR_CODES.md) for specific errors
4. Contact the development team for additional support

## 📝 Contributing

We welcome contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Follow coding standards in [Development Memory Guide](DEVELOPMENT_MEMORY_GUIDE.md)
4. Write tests per [Testing Guide](TESTING_GUIDE.md)
5. Submit a pull request

---

**Last Updated**: 2025-07-15  
**Version**: 2.0.0  
**Maintainer**: Development Team
