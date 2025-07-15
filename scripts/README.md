# Scripts Directory

This directory contains various utility scripts for the real estate bot backend system. Scripts are organized by category and purpose.

## 📁 Script Categories

### 🚀 Deployment Scripts
- **`railway-deploy.js`** - Railway deployment automation
- **`railway-unified-deploy.js`** - Unified frontend/backend deployment
- **`start-nextjs-standalone.js`** - Production server startup
- **`unified-server.js`** - Combined frontend/backend server

### 🔍 Property Scraping
- **`localScraperWithWebhook.js`** - Main property scraper with Supabase integration
- **`scrapePropertyDetails.js`** - Detailed property information extraction
- **`scrapeUnitMix.js`** - Unit mix and availability scraping

### ✅ Validation & Testing
- **`validateSystem.js`** - System health and configuration validation
- **`validateDatabaseConnection.js`** - Database connectivity testing

### 🛠️ Development Utilities
- **`build-for-railway.js`** - Frontend build optimization for Railway
- **`verify-setup.js`** - Development environment verification

## 🚀 Key Features

- **Direct Supabase Integration**: All scripts use centralized database service
- **Complete Data Extraction**: Property info, unit mix, and floor plans
- **Smart Availability Checking**: Only extracts floor plans for available properties
- **Duplicate Detection**: Updates only dynamic fields (prices, unit mix, TOP dates)
- **Progress Tracking**: Resumable operations with database session tracking
- **Error Handling**: Comprehensive error handling with fallback mechanisms
- **Rate Limiting**: Built-in delays to respect website limits

## 📋 Prerequisites

1. **Node.js** (v20 or higher)
2. **Supabase Project** with the required database schema
3. **Environment Variables** configured in `.env` file

## 🛠️ Setup Instructions

### 1. Environment Configuration

The system uses a centralized `.env` file in the project root. Required variables:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here

# Railway Deployment
RAILWAY_PUBLIC_DOMAIN=your-app.railway.app

# WhatsApp Integration
GUPSHUP_API_KEY=your-gupshup-api-key
GUPSHUP_APP_NAME=your-app-name

# Google Calendar Integration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/google/callback

# OpenAI Integration
OPENAI_API_KEY=your-openai-api-key

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
```

**Important**: Use the **Service Role Key** for scripts that need full database access.

## 🎯 Usage

### Deployment Scripts

```bash
# Deploy to Railway
npm run railway:deploy

# Check Railway deployment health
npm run railway:health

# Start production server
npm run start:production
```

### Property Scraping

```bash
# Run property scraper
node scripts/localScraperWithWebhook.js scrape

# Test database connection
node scripts/validateDatabaseConnection.js
```

### System Validation

```bash
# Validate entire system
node scripts/validateSystem.js

# Verify development setup
node scripts/verify-setup.js
```

## 📊 Data Structure

The scraper saves data to these Supabase tables:

### `property_projects`
- Master property information
- Location, pricing, developer details
- Scraping metadata and status

### `property_unit_mix`
- Unit type specifications
- Size ranges, pricing, availability
- Linked to property projects

### `visual_assets`
- Floor plan images and metadata
- Bedroom information stored in description
- Processing status tracking

### `scraping_sessions`
- Session tracking and progress monitoring
- Error logging and performance metrics
- Resumability support

## 🔄 How It Works

1. **Database Connection**: Verifies Supabase connectivity
2. **Session Tracking**: Creates database session for monitoring
3. **Page Detection**: Dynamically detects total pages
4. **Property Extraction**: Scrapes property listings with pagination
5. **Availability Check**: Extracts unit mix first to check availability
6. **Conditional Floor Plans**: Only extracts floor plans if units available
7. **Database Storage**: Saves all data directly to Supabase
8. **Progress Updates**: Updates session progress in real-time
9. **Local Backup**: Maintains local JSON files as backup

## 📈 Monitoring

- **Database Sessions**: Track progress in `scraping_sessions` table
- **Local Files**: `scraping-progress.json` and `scraped-properties.json`
- **Console Logs**: Detailed logging with emojis for easy reading

## 🛡️ Error Handling

- **Database Failures**: Falls back to local storage
- **Scraping Errors**: Continues with next property
- **Connection Issues**: Retries with exponential backoff
- **Resume Capability**: Can resume from last successful page

## 🎛️ Configuration

- **Rate Limiting**: 3-5 second delays between requests
- **Timeout Settings**: 30 second page load timeout
- **Duplicate Detection**: Smart comparison of existing data
- **Progress Persistence**: Automatic progress saving

## 📝 Logs and Output

The scraper provides detailed console output:
- 🚀 Starting operations
- 📊 Progress updates
- ✅ Successful operations
- ⚠️ Warnings and skipped items
- ❌ Errors and failures
- 🎉 Completion summaries

## 🔧 Troubleshooting

### Database Connection Issues
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Check if service role key has proper permissions
- Ensure database schema is up to date
- Run `node scripts/validateDatabaseConnection.js` to test connectivity

### Deployment Issues
- Check Railway environment variables are set correctly
- Verify build process completes without errors
- Monitor Railway logs for deployment failures
- Ensure all required dependencies are in `package.json`

### Scraping Issues
- Check if ecoprop.com structure has changed
- Verify internet connection and proxy settings
- Review rate limiting settings to avoid being blocked
- Monitor for CAPTCHA or anti-bot measures

### Performance Issues
- Adjust delay settings in scraper configuration
- Monitor memory usage during large operations
- Consider running resource-intensive scripts during off-peak hours
- Use `NODE_ENV=production` for optimized performance

## 📋 Best Practices

### Script Development
- Always use the centralized `databaseService` instead of direct Supabase client
- Implement proper error handling and logging
- Add progress tracking for long-running operations
- Use environment variables for configuration
- Follow the established naming conventions

### Security
- Never commit API keys or secrets to version control
- Use service role keys only for server-side operations
- Implement rate limiting for external API calls
- Validate all input data before processing

### Maintenance
- Regularly update dependencies for security patches
- Monitor script performance and optimize as needed
- Keep documentation updated when adding new scripts
- Remove unused scripts to maintain clean codebase

## 📚 Next Steps

After running scripts successfully:
1. Monitor logs for any errors or warnings
2. Verify data integrity in Supabase dashboard
3. Test related functionality in the main application
4. Schedule recurring scripts using cron jobs or Railway cron
5. Set up monitoring and alerting for critical scripts
