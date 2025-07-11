# Local Property Scraper with Direct Supabase Integration

This scraper extracts property data from ecoprop.com and saves it directly to your Supabase database, eliminating the need for webhook integration with your Railway backend.

## 🚀 Features

- **Direct Supabase Integration**: Saves data directly to database without webhooks
- **Complete Data Extraction**: Property info, unit mix, and ALL floor plans
- **Smart Availability Checking**: Only extracts floor plans for properties with available units
- **Duplicate Detection**: Updates only dynamic fields (prices, unit mix, TOP dates)
- **Progress Tracking**: Resumable scraping with database session tracking
- **Error Handling**: Comprehensive error handling with local backup
- **Rate Limiting**: Built-in delays to respect website limits

## 📋 Prerequisites

1. **Node.js** (v16 or higher)
2. **Supabase Project** with the required database schema
3. **Environment Variables** configured

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
cd scripts
npm install
```

### 2. Database Setup

First, run the database migration to add the scraping_sessions table:

```sql
-- Run this in your Supabase SQL editor
-- File: database/migrations/add_scraping_sessions_table.sql
```

### 3. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
# Get these from your Supabase project settings > API
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional: Download floor plans locally
DOWNLOAD_FLOOR_PLANS=false
```

**Important**: Use the **Service Role Key**, not the anon key, as the scraper needs full database access.

## 🎯 Usage

### Test Database Connection
```bash
npm run test
# or
node localScraperWithWebhook.js test
```

### Run Scraper Once
```bash
npm run scrape
# or
node localScraperWithWebhook.js scrape
```

### Schedule Daily Scraping
```bash
npm run schedule
# or
node localScraperWithWebhook.js schedule
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
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- Check if service role key has proper permissions
- Ensure database schema is up to date

### Scraping Issues
- Check if ecoprop.com structure has changed
- Verify internet connection
- Review rate limiting settings

### Performance Issues
- Adjust delay settings in the code
- Monitor memory usage during large scrapes
- Consider running during off-peak hours

## 📚 Next Steps

After successful scraping, your Railway backend can access the property data directly from Supabase without needing to run any scraping operations itself.
