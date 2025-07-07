# Visual Property Data Collection - Implementation Plan

## Phase 1: External Scraping Service Setup (Week 1)

### Step 1: ScrapingBee Integration
```bash
# Add environment variables to Railway
SCRAPINGBEE_API_KEY=your_api_key_here
```

### Step 2: Enhanced Data Extraction
```javascript
// Target specific ecoprop.com data fields:
const extractionRules = {
  propertyName: '.project-title, h1, .property-name',
  district: '.district, .location-district, [data-district]',
  address: '.address, .location-address, .full-address',
  developer: '.developer, .developer-name, .by-developer',
  propertyType: '.property-type, .type, .category',
  tenure: '.tenure, .lease-type, .ownership',
  priceRange: '.price, .price-range, .starting-from',
  unitTypes: '.unit-type, .bedroom-type, .layout-type',
  floorPlans: 'img[src*="floor"], img[alt*="floor"], img[src*="plan"]',
  brochures: 'a[href$=".pdf"], a[href*="brochure"], .download-brochure',
  amenities: '.amenities, .facilities, .features',
  nearbyMRT: '.mrt, .transport, .connectivity',
  schools: '.schools, .education, .nearby-schools'
};
```

### Step 3: Data Verification System
```javascript
// Cross-reference with multiple sources
const verificationSources = [
  'https://www.propertyguru.com.sg',
  'https://www.99.co',
  'https://www.edgeprop.sg'
];
```

## Phase 2: GitHub Actions Backup (Week 2)

### Step 1: Workflow Configuration
```yaml
# .github/workflows/property-scraping.yml
name: Property Data Collection
on:
  schedule:
    - cron: '0 18 * * *' # 2 AM Singapore time
  workflow_dispatch:

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install chromium
      - run: node scripts/github-scraper.js
        env:
          RAILWAY_WEBHOOK_URL: ${{ secrets.RAILWAY_WEBHOOK_URL }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
```

### Step 2: Data Processing Pipeline
```javascript
// Process and send to Railway via webhook
const processedData = {
  properties: extractedProperties,
  source: 'github_actions',
  timestamp: new Date().toISOString(),
  metadata: {
    totalProcessed: properties.length,
    successRate: successCount / properties.length,
    errors: errorLog
  }
};

await axios.post(process.env.RAILWAY_WEBHOOK_URL, processedData);
```

## Phase 3: Webhook Integration (Week 2)

### Step 1: Webhook Endpoints
```javascript
// /api/webhooks/property-data
app.post('/api/webhooks/property-data', async (req, res) => {
  const { properties, source, timestamp } = req.body;
  
  // Validate and process data
  for (const property of properties) {
    await savePropertyData(property);
    await triggerAIAnalysis(property.visualAssets);
  }
  
  res.json({ success: true, processed: properties.length });
});
```

### Step 2: Data Quality Validation
```javascript
const validatePropertyData = (property) => {
  const required = ['name', 'district', 'address'];
  const missing = required.filter(field => !property[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  
  // Validate district format (D01, D02, etc.)
  if (property.district && !property.district.match(/^D\d{2}$/)) {
    property.district = normalizeDistrict(property.district);
  }
  
  return property;
};
```

## Phase 4: AI Analysis Enhancement (Week 3)

### Step 1: GPT-4 Vision Integration
```javascript
// Enhanced floor plan analysis
const analyzeFloorPlan = async (imageUrl) => {
  const prompt = `Analyze this Singapore property floor plan and extract:
  
  1. Unit specifications:
     - Bedroom count and sizes
     - Bathroom count and types
     - Living/dining area layout
     - Kitchen type (open/closed concept)
     - Balcony/terrace presence
     - Study room availability
     - Storage spaces
  
  2. Layout characteristics:
     - Overall layout type (open concept, traditional, etc.)
     - Traffic flow efficiency
     - Privacy levels between rooms
     - Natural light optimization
     - Space utilization efficiency
  
  3. Singapore-specific features:
     - Bomb shelter location
     - Service yard/utility area
     - Air-con ledge placement
     - Facing direction indicators
  
  4. Investment/livability assessment:
     - Family suitability score (1-10)
     - Rental potential score (1-10)
     - Resale attractiveness score (1-10)
     - Unique selling points
  
  Provide structured JSON response with confidence scores.`;
  
  return await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [{ role: "user", content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: imageUrl, detail: "high" }}
    ]}],
    max_tokens: 1500
  });
};
```

### Step 2: Market Data Integration
```javascript
// Cross-reference with market data
const enhanceWithMarketData = async (property) => {
  const marketData = await Promise.all([
    getPropertyGuruData(property.name),
    get99CoData(property.name),
    getEdgePropData(property.name),
    getURAData(property.district)
  ]);
  
  return {
    ...property,
    marketInsights: {
      averagePSF: calculateAveragePSF(marketData),
      priceAppreciation: calculateAppreciation(marketData),
      rentalYield: calculateRentalYield(marketData),
      transactionVolume: getTransactionVolume(marketData),
      competitorAnalysis: getCompetitorAnalysis(marketData)
    }
  };
};
```

## Phase 5: Monitoring & Optimization (Week 4)

### Step 1: Success Rate Monitoring
```javascript
// Track scraping success rates
const monitoringMetrics = {
  scrapingBeeSuccessRate: 0.95,
  githubActionsSuccessRate: 0.85,
  dataQualityScore: 0.92,
  aiAnalysisAccuracy: 0.88,
  averageProcessingTime: '45 seconds per property'
};
```

### Step 2: Automated Alerts
```javascript
// Alert system for failures
if (successRate < 0.8) {
  await sendSlackAlert(`Scraping success rate dropped to ${successRate}`);
  await switchToBackupMethod();
}
```

## Expected Results

### Data Collection Targets
- **Properties per day**: 20-50 new/updated properties
- **Visual assets per property**: 3-8 (floor plans, brochures, site plans)
- **Data accuracy**: 95%+ for basic information, 85%+ for detailed specs
- **Processing time**: 30-60 seconds per property
- **Success rate**: 90%+ with primary method, 85%+ with backup

### Cost Analysis
- **ScrapingBee**: $29/month (100K requests)
- **GitHub Actions**: Free (within limits)
- **OpenAI GPT-4 Vision**: ~$20/month for analysis
- **Total monthly cost**: ~$50

### Maintenance Requirements
- **Weekly**: Review success rates and error logs
- **Monthly**: Update extraction rules if site changes
- **Quarterly**: Optimize AI prompts and data quality

## Risk Mitigation

### Technical Risks
1. **Site structure changes**: Multiple extraction strategies
2. **Rate limiting**: Built-in delays and proxy rotation
3. **CAPTCHA challenges**: ScrapingBee handles automatically
4. **Data quality issues**: Multi-source verification

### Business Risks
1. **Legal compliance**: Respectful scraping with proper delays
2. **Data accuracy**: Cross-referencing with multiple sources
3. **Service reliability**: Multiple backup methods
4. **Cost management**: Usage monitoring and alerts

## Success Metrics

### Quantitative KPIs
- Properties scraped per day: 20-50
- Data accuracy rate: >95%
- System uptime: >99%
- Processing speed: <60s per property
- Cost per property: <$0.10

### Qualitative KPIs
- Bot response quality improvement
- Lead qualification accuracy
- Customer satisfaction with property information
- Agent productivity increase

## Next Steps

1. **Immediate (This Week)**:
   - Set up ScrapingBee account
   - Deploy external scraping service
   - Test with 10 sample properties

2. **Week 2**:
   - Implement GitHub Actions backup
   - Set up webhook endpoints
   - Begin daily automated collection

3. **Week 3**:
   - Enhance AI analysis prompts
   - Implement market data cross-referencing
   - Optimize data quality validation

4. **Week 4**:
   - Deploy monitoring and alerting
   - Performance optimization
   - Scale to full property database

This implementation plan provides a robust, scalable solution for comprehensive property data collection that works within Railway's constraints while delivering the detailed property information your bot needs.
