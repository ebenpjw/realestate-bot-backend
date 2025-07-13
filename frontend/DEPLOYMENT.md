# PropertyHub Command Frontend - Deployment Guide

This guide covers the deployment process for the PropertyHub Command frontend application.

## Overview

The application is deployed using:
- **Hosting**: Netlify
- **CI/CD**: GitHub Actions
- **Performance Monitoring**: Lighthouse CI
- **Bundle Analysis**: Webpack Bundle Analyzer

## Prerequisites

### Required Tools
- Node.js 18+ 
- npm or yarn
- Git
- Netlify CLI (for manual deployments)

### Environment Variables

Create the following environment variables in your deployment environment:

#### Required
```bash
NETLIFY_SITE_ID=your-netlify-site-id
NETLIFY_AUTH_TOKEN=your-netlify-auth-token
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### Optional
```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=your-google-analytics-id
NEXT_PUBLIC_HOTJAR_ID=your-hotjar-id
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-key
```

## Deployment Methods

### 1. Automatic Deployment (Recommended)

The application automatically deploys when code is pushed to specific branches:

- **Production**: Push to `main` branch
- **Preview**: Create a pull request to `main` branch

#### GitHub Actions Workflow

The CI/CD pipeline includes:
1. **Quality Checks**: Linting, type checking, unit tests
2. **Security Checks**: Dependency audit, security scanning
3. **Build**: Application build and bundle analysis
4. **E2E Tests**: End-to-end testing with Playwright
5. **Deploy**: Deployment to Netlify
6. **Performance**: Lighthouse performance monitoring

### 2. Manual Deployment

#### Using Deployment Script

```bash
# Deploy to preview
npm run deploy:preview

# Deploy to production
npm run deploy:production

# Build only (no deployment)
npm run deploy:build-only
```

#### Using Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy to preview
netlify deploy --dir=out

# Deploy to production
netlify deploy --prod --dir=out
```

### 3. Manual Build and Upload

```bash
# Build the application
npm run build

# Upload the 'out' directory to your hosting provider
```

## Build Configuration

### Environment-Specific Builds

The application supports different build configurations:

#### Production Build
```bash
NODE_ENV=production npm run build
```

#### Development Build
```bash
NODE_ENV=development npm run build
```

#### Bundle Analysis
```bash
npm run analyze
```

### Build Optimization

The build process includes:
- **Code Splitting**: Automatic route-based splitting
- **Tree Shaking**: Unused code elimination
- **Minification**: JavaScript and CSS minification
- **Image Optimization**: Next.js image optimization
- **Static Generation**: Pre-rendered pages where possible

## Performance Monitoring

### Lighthouse CI

Performance is automatically monitored using Lighthouse CI:

```bash
# Run Lighthouse locally
npm run lighthouse
```

#### Performance Budgets
- Performance: ≥85
- Accessibility: ≥95
- Best Practices: ≥90
- SEO: ≥90
- PWA: ≥80

### Bundle Analysis

Monitor bundle size and composition:

```bash
# Generate bundle analysis
npm run analyze
```

The analysis is available at:
- Client bundle: `analyze/client.html`
- Server bundle: `analyze/server.html`

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Performance budgets met
- [ ] Security audit passed

### Post-Deployment
- [ ] Application loads correctly
- [ ] Authentication working
- [ ] Real-time features functional
- [ ] PWA features working
- [ ] Performance metrics acceptable
- [ ] Error monitoring active

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear cache and rebuild
npm run clean
npm ci
npm run build
```

#### Deployment Failures
```bash
# Check Netlify logs
netlify logs

# Verify environment variables
netlify env:list
```

#### Performance Issues
```bash
# Run performance analysis
npm run analyze
npm run lighthouse
```

### Debug Mode

Enable debug mode for detailed logging:

```bash
DEBUG=true npm run deploy
```

## Rollback Procedure

### Automatic Rollback
Netlify provides automatic rollback through their dashboard:
1. Go to Netlify dashboard
2. Select your site
3. Go to "Deploys" tab
4. Click "Publish deploy" on a previous version

### Manual Rollback
```bash
# Deploy a specific commit
git checkout <previous-commit>
npm run deploy:production
```

## Monitoring and Alerts

### Performance Monitoring
- Lighthouse CI reports
- Core Web Vitals tracking
- Bundle size monitoring

### Error Monitoring
- Application error tracking
- Build failure notifications
- Performance regression alerts

### Uptime Monitoring
- Netlify status monitoring
- Custom health checks
- Alert notifications

## Security Considerations

### Headers
Security headers are configured in `netlify.toml`:
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

### Environment Variables
- Never commit sensitive data
- Use Netlify environment variables
- Rotate keys regularly

### Dependencies
- Regular security audits
- Automated dependency updates
- Vulnerability scanning

## Support

### Documentation
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Netlify Documentation](https://docs.netlify.com/)
- [GitHub Actions](https://docs.github.com/en/actions)

### Contacts
- Development Team: dev@propertyhub.sg
- DevOps Team: devops@propertyhub.sg
- Emergency: emergency@propertyhub.sg

## Changelog

### Version 1.0.0
- Initial production deployment
- CI/CD pipeline setup
- Performance monitoring
- PWA features
- Real-time capabilities
