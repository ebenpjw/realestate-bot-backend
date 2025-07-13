#!/bin/bash

# PropertyHub Command Frontend Deployment Script
# This script handles the complete deployment process for production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="propertyhub-command"
BUILD_DIR="out"
NETLIFY_SITE_ID="${NETLIFY_SITE_ID:-}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_VERSION="18.0.0"
    
    if ! npx semver -r ">=$REQUIRED_VERSION" "$NODE_VERSION" &> /dev/null; then
        log_error "Node.js version $NODE_VERSION is not supported. Required: >=$REQUIRED_VERSION"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check environment variables
    if [ -z "$NETLIFY_SITE_ID" ] && [ "$ENVIRONMENT" = "production" ]; then
        log_warning "NETLIFY_SITE_ID not set. Manual deployment may be required."
    fi
    
    log_success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    if [ -f "package-lock.json" ]; then
        npm ci --production=false
    else
        npm install
    fi
    
    log_success "Dependencies installed"
}

# Run tests
run_tests() {
    log_info "Running tests..."
    
    # Unit tests
    npm run test:unit || {
        log_error "Unit tests failed"
        exit 1
    }
    
    # Type checking
    npm run type-check || {
        log_error "Type checking failed"
        exit 1
    }
    
    # Linting
    npm run lint || {
        log_error "Linting failed"
        exit 1
    }
    
    log_success "All tests passed"
}

# Build application
build_application() {
    log_info "Building application for $ENVIRONMENT..."
    
    # Set environment variables
    export NODE_ENV=production
    export NEXT_TELEMETRY_DISABLED=1
    
    # Clean previous build
    rm -rf .next
    rm -rf $BUILD_DIR
    
    # Build
    npm run build || {
        log_error "Build failed"
        exit 1
    }
    
    # Generate bundle analysis if requested
    if [ "$ANALYZE" = "true" ]; then
        log_info "Generating bundle analysis..."
        ANALYZE=true npm run build
    fi
    
    log_success "Build completed"
}

# Optimize build
optimize_build() {
    log_info "Optimizing build..."
    
    # Compress static assets
    if command -v gzip &> /dev/null; then
        find $BUILD_DIR -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" \) -exec gzip -k {} \;
        log_info "Gzip compression applied"
    fi
    
    # Generate service worker
    if [ -f "public/sw.js" ]; then
        cp public/sw.js $BUILD_DIR/sw.js
        log_info "Service worker copied"
    fi
    
    log_success "Build optimization completed"
}

# Deploy to Netlify
deploy_to_netlify() {
    log_info "Deploying to Netlify..."
    
    if [ -z "$NETLIFY_SITE_ID" ]; then
        log_warning "NETLIFY_SITE_ID not set. Skipping automatic deployment."
        log_info "To deploy manually:"
        log_info "1. Install Netlify CLI: npm install -g netlify-cli"
        log_info "2. Login: netlify login"
        log_info "3. Deploy: netlify deploy --prod --dir=$BUILD_DIR"
        return
    fi
    
    # Check if Netlify CLI is installed
    if ! command -v netlify &> /dev/null; then
        log_info "Installing Netlify CLI..."
        npm install -g netlify-cli
    fi
    
    # Deploy
    if [ "$ENVIRONMENT" = "production" ]; then
        netlify deploy --prod --dir=$BUILD_DIR --site=$NETLIFY_SITE_ID || {
            log_error "Production deployment failed"
            exit 1
        }
        log_success "Production deployment completed"
    else
        netlify deploy --dir=$BUILD_DIR --site=$NETLIFY_SITE_ID || {
            log_error "Preview deployment failed"
            exit 1
        }
        log_success "Preview deployment completed"
    fi
}

# Generate deployment report
generate_report() {
    log_info "Generating deployment report..."
    
    REPORT_FILE="deployment-report.json"
    
    cat > $REPORT_FILE << EOF
{
  "deployment": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "$ENVIRONMENT",
    "version": "$(npm run version --silent 2>/dev/null || echo 'unknown')",
    "commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
    "buildSize": "$(du -sh $BUILD_DIR 2>/dev/null | cut -f1 || echo 'unknown')",
    "nodeVersion": "$(node --version)",
    "npmVersion": "$(npm --version)"
  },
  "performance": {
    "buildTime": "$BUILD_TIME",
    "bundleSize": "$(find $BUILD_DIR -name "*.js" -type f -exec du -ch {} + 2>/dev/null | grep total | cut -f1 || echo 'unknown')",
    "cssSize": "$(find $BUILD_DIR -name "*.css" -type f -exec du -ch {} + 2>/dev/null | grep total | cut -f1 || echo 'unknown')"
  }
}
EOF
    
    log_success "Deployment report generated: $REPORT_FILE"
}

# Cleanup
cleanup() {
    log_info "Cleaning up..."
    
    # Remove temporary files
    rm -f deployment-report.json
    
    log_success "Cleanup completed"
}

# Main deployment process
main() {
    log_info "Starting deployment process for $PROJECT_NAME..."
    
    START_TIME=$(date +%s)
    
    # Run deployment steps
    check_prerequisites
    install_dependencies
    
    if [ "$SKIP_TESTS" != "true" ]; then
        run_tests
    else
        log_warning "Skipping tests (SKIP_TESTS=true)"
    fi
    
    build_application
    optimize_build
    
    END_TIME=$(date +%s)
    BUILD_TIME=$((END_TIME - START_TIME))
    
    generate_report
    
    if [ "$SKIP_DEPLOY" != "true" ]; then
        deploy_to_netlify
    else
        log_warning "Skipping deployment (SKIP_DEPLOY=true)"
    fi
    
    log_success "Deployment process completed in ${BUILD_TIME}s"
    
    # Print next steps
    echo ""
    log_info "Next steps:"
    log_info "1. Verify deployment at your Netlify URL"
    log_info "2. Run smoke tests on production"
    log_info "3. Monitor performance metrics"
    log_info "4. Update documentation if needed"
}

# Handle script arguments
case "${1:-}" in
    "preview")
        ENVIRONMENT="preview"
        ;;
    "production")
        ENVIRONMENT="production"
        ;;
    "build-only")
        SKIP_DEPLOY="true"
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [preview|production|build-only|help]"
        echo ""
        echo "Options:"
        echo "  preview      Deploy to preview environment"
        echo "  production   Deploy to production environment (default)"
        echo "  build-only   Build without deploying"
        echo "  help         Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  NETLIFY_SITE_ID  Netlify site ID for deployment"
        echo "  SKIP_TESTS       Skip test execution (true/false)"
        echo "  SKIP_DEPLOY      Skip deployment step (true/false)"
        echo "  ANALYZE          Generate bundle analysis (true/false)"
        exit 0
        ;;
    "")
        # Default to production
        ;;
    *)
        log_error "Unknown argument: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac

# Run main function
main
