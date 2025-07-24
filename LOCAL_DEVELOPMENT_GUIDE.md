# Local Development Environment Guide

This guide will help you set up a complete local development environment for the Real Estate Bot system, allowing you to test and develop features quickly without deploying to Railway.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- Git

### 1. Initial Setup
```bash
# Clone and navigate to the project
cd realestate-bot-backend

# Run the automated setup
npm run dev:setup
```

### 2. Configure Environment Variables
```bash
# Set up your production keys for local development
node scripts/setup-local-env.js
```

### 3. Start Development
```bash
# Start both backend and frontend with hot reload
npm run dev:full
```

🎉 **That's it!** Your local development environment is ready at:
- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- API Health: http://localhost:8080/health

## 🚀 Full Testing Environment

The local development environment is configured for complete testing:

### Enabled Features
- `DISABLE_WHATSAPP_SENDING=false` - **Real WhatsApp messages enabled**
- `TESTING_MODE=false` - Full production-like behavior
- `DRY_RUN_MODE=false` - Real operations executed
- `MOCK_WHATSAPP_RESPONSES=false` - Real API responses

### What You Can Test
✅ **Fully Functional:**
- **WhatsApp message sending** - Real messages to real numbers
- **AI conversation logic** - Full GPT-4 integration
- **Appointment booking** - Creates real calendar events
- **Property scraping** - Live data from ecoprop.com
- **Template generation** - Real Gupshup templates
- **User authentication** - Complete auth flow
- **Dashboard functionality** - Real-time data
- **All API endpoints** - Production behavior

⚠️ **Important Notes:**
- **WhatsApp messages will be sent to real phone numbers**
- **Calendar appointments will be created in real Google Calendar**
- **Use test phone numbers or your own number for safety**
- **All other integrations work exactly like production**

## 📋 Available Commands

### Development Commands
```bash
npm run dev:full          # Start both backend and frontend
npm run dev:backend       # Start backend only
npm run dev:frontend      # Start frontend only
npm run dev:setup         # Run initial setup
npm run dev:reset         # Reset development environment
npm run dev:test          # Run tests in development mode
npm run dev:lint          # Lint both backend and frontend
npm run dev:format        # Format code in both projects
```

### Docker Commands (Optional)
```bash
npm run dev:docker        # Start with Docker Compose
npm run dev:docker:down   # Stop Docker services
npm run dev:docker:clean  # Clean Docker resources
npm run dev:logs          # View Docker logs
```

## 🛠️ Development Workflow

### Making Changes

1. **Backend Changes:**
   - Edit files in the root directory
   - Changes auto-reload with nodemon
   - Check logs in terminal

2. **Frontend Changes:**
   - Edit files in `frontend/` directory
   - Changes auto-reload with Next.js
   - Check browser console for errors

3. **Testing Changes:**
   - Use the frontend UI to test features
   - Check API responses in browser dev tools
   - Monitor backend logs for debugging

### Hot Reload Features

- **Backend:** Automatic restart on file changes
- **Frontend:** Instant updates in browser
- **Environment:** Reload on .env changes
- **Dependencies:** Auto-install on package.json changes

## 🗂️ Project Structure

```
realestate-bot-backend/
├── api/                  # API routes
├── services/             # Business logic services
├── middleware/           # Express middleware
├── config/               # Configuration files
├── frontend/             # Next.js frontend
│   ├── app/             # Next.js app directory
│   ├── components/      # React components
│   └── lib/             # Frontend utilities
├── scripts/             # Development and utility scripts
├── tests/               # Test files
└── docs/                # Documentation
```

## 🔧 Configuration Files

### Environment Files
- `.env.development` - Template with placeholders
- `.env` - Your actual environment variables (created by setup)
- `frontend/.env.local` - Frontend environment variables

### Development Configuration
- `docker-compose.dev.yml` - Docker development setup
- `Dockerfile.dev` - Development Docker image
- `nodemon.json` - Backend auto-reload configuration
- `next.config.js` - Frontend configuration

## 🐛 Debugging

### Backend Debugging
```bash
# View detailed logs
npm run dev:backend

# Debug specific service
DEBUG=service:* npm run dev:backend

# Test specific endpoint
curl http://localhost:8080/api/health
```

### Frontend Debugging
- Open browser dev tools (F12)
- Check Console tab for JavaScript errors
- Check Network tab for API calls
- Use React Developer Tools extension

### Common Issues

1. **Port Already in Use:**
   ```bash
   # Kill processes on ports 3000 and 8080
   npx kill-port 3000 8080
   ```

2. **Environment Variables Not Loading:**
   ```bash
   # Recreate environment files
   npm run dev:reset
   node scripts/setup-local-env.js
   ```

3. **Database Connection Issues:**
   - Check your Supabase URL and keys
   - Verify network connectivity
   - Check Supabase project status

## 🧪 Testing

### Manual Testing
1. Open http://localhost:3000
2. Test login functionality
3. Navigate through different features
4. Check that WhatsApp sending is disabled

### Automated Testing
```bash
# Run all tests
npm run dev:test

# Run specific test suite
npm run test:messages

# Run tests with browser UI
npm run test:messages:headed
```

## 🔄 Switching Between Local and Production

### Local Development
- Use `.env` file with safety flags
- Run `npm run dev:full`
- Test features locally

### Production Deployment
- Push changes to GitHub
- Railway automatically deploys
- Production uses Railway environment variables

### Environment Comparison
| Feature | Local | Production |
|---------|-------|------------|
| WhatsApp Sending | Disabled | Enabled |
| Database | Same as production | Production |
| API Keys | Same as production | Production |
| Hot Reload | Enabled | Disabled |
| Debug Logging | Enabled | Minimal |

## 📚 Additional Resources

- [API Documentation](docs/API_DOCUMENTATION.md)
- [Database Schema](docs/DATABASE_SCHEMA_ANALYSIS.md)
- [Testing Guide](docs/TESTING_GUIDE.md)
- [Production Deployment](DEPLOYMENT_GUIDE.md)

## 🆘 Getting Help

If you encounter issues:

1. Check the logs for error messages
2. Verify environment variables are set correctly
3. Ensure all dependencies are installed
4. Try resetting the development environment:
   ```bash
   npm run dev:reset
   ```

## 🎯 Pro Tips

1. **Use Multiple Terminals:**
   - Terminal 1: Backend logs (`npm run dev:backend`)
   - Terminal 2: Frontend logs (`npm run dev:frontend`)
   - Terminal 3: Commands and testing

2. **Browser Bookmarks:**
   - http://localhost:3000 (Frontend)
   - http://localhost:8080/health (Backend Health)
   - http://localhost:8080/api/dashboard (API Dashboard)

3. **VS Code Extensions:**
   - ES7+ React/Redux/React-Native snippets
   - Prettier - Code formatter
   - ESLint
   - Thunder Client (for API testing)

4. **Development Database:**
   - All data is real but WhatsApp is disabled
   - Safe to experiment with leads and conversations
   - Appointments will create real calendar events (be careful!)

---

**Happy Coding! 🚀**
