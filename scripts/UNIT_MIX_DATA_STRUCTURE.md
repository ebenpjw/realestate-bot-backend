# Unit Mix Data Structure for Real Estate Bot

## 📊 Comprehensive Unit Mix Data Extraction

The scraper extracts detailed unit mix information that enables the bot to provide precise pricing and availability information to leads.

## 🗃️ Database Storage Structure

### `property_unit_mix` Table Fields:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `unit_type` | VARCHAR(100) | Original unit type text | "3 Bedroom" |
| `size_range_raw` | VARCHAR(255) | Original size text from website | "980" |
| `size_min_sqft` | INTEGER | Minimum size in square feet | 980 |
| `size_max_sqft` | INTEGER | Maximum size in square feet | 980 |
| `price_range_raw` | VARCHAR(255) | Original price text from website | "$2.44M - $2.48M" |
| `price_min` | DECIMAL(12,2) | Minimum price in SGD | 2440000.00 |
| `price_max` | DECIMAL(12,2) | Maximum price in SGD | 2480000.00 |
| `availability_raw` | VARCHAR(255) | Original availability text | "2 / 4" |
| `units_available` | INTEGER | Number of available units | 2 |
| `units_total` | INTEGER | Total number of units | 4 |
| `availability_percentage` | INTEGER | Availability percentage | 50 |

## 🤖 Bot Usage Examples

### 1. **Specific Unit Type Inquiry**
**Lead asks:** "How much does a 3-bedroom cost in this project?"

**Bot can respond:** "The 3-bedroom units in this project are priced from $2.44M to $2.48M, with 980 sqft of space. Currently, 2 out of 4 units are still available."

### 2. **Budget-Based Recommendations**
**Lead asks:** "What can I get for under $3M?"

**Bot can query:** 
```sql
SELECT * FROM property_unit_mix 
WHERE project_id = ? AND price_max < 3000000 
ORDER BY price_min ASC
```

**Bot can respond:** "For under $3M, you have several options: 2-bedroom + study units from $2.13M-$2.25M (861-893 sqft), 3-bedroom units at $2.44M-$2.48M (980 sqft), and 3-bedroom deluxe at $2.50M-$2.55M (1023 sqft)."

### 3. **Availability Check**
**Lead asks:** "Are there still units available?"

**Bot can respond:** "Yes! Currently available: 6 out of 9 two-bedroom + study units, 2 out of 4 three-bedroom units, 3 out of 5 three-bedroom deluxe units, and 4 out of 6 four-bedroom units."

### 4. **Size-Based Recommendations**
**Lead asks:** "I need at least 1000 sqft"

**Bot can query:**
```sql
SELECT * FROM property_unit_mix 
WHERE project_id = ? AND size_min_sqft >= 1000 
ORDER BY price_min ASC
```

### 5. **Price Per Square Foot Analysis**
**Bot can calculate:** "The 3-bedroom units offer excellent value at approximately $2,490 per sqft, while the 4-bedroom units are $2,470 per sqft."

## 📈 Advanced Bot Intelligence

### Calculated Metrics Available:
- **Price per sqft**: `price_min / size_min_sqft`
- **Average price**: `(price_min + price_max) / 2`
- **Average size**: `(size_min + size_max) / 2`
- **Availability percentage**: `(units_available / units_total) * 100`

### Smart Recommendations:
1. **Best Value**: Units with lowest price per sqft
2. **High Availability**: Units with >50% availability
3. **Premium Options**: Largest units or those with "Deluxe/Premium" in name
4. **Budget Friendly**: Lowest priced options with good availability

## 🔄 Data Freshness

- **Dynamic Updates**: Unit mix data is refreshed on each scraping run
- **Availability Tracking**: Real-time availability status
- **Price Changes**: Captures price adjustments and promotions
- **Sold Out Detection**: Automatically skips floor plan extraction for sold-out projects

## 💡 Bot Conversation Examples

### Example 1: Detailed Unit Information
```
Lead: "Tell me about the 3-bedroom units"
Bot: "The 3-bedroom units are 980 sqft and priced from $2.44M to $2.48M. That works out to about $2,490 per sqft. Currently, 2 out of 4 units are still available (50% availability). Would you like to see the floor plans?"
```

### Example 2: Comparative Analysis
```
Lead: "What's the difference between regular and deluxe 3-bedroom?"
Bot: "Great question! The regular 3-bedroom is 980 sqft ($2.44M-$2.48M), while the 3-bedroom deluxe is 1023 sqft ($2.50M-$2.55M). The deluxe gives you 43 sqft more space for about $60K-$70K more. The deluxe also has better availability with 3 out of 5 units still available."
```

### Example 3: Budget Optimization
```
Lead: "I have a $2.5M budget"
Bot: "Perfect! With $2.5M, you can get the 3-bedroom deluxe units (1023 sqft) starting from exactly $2.50M. You could also consider the regular 3-bedroom (980 sqft) from $2.44M-$2.48M, which would save you some budget. Both have good availability right now."
```

This comprehensive unit mix data enables the bot to have intelligent, detailed conversations about pricing, sizing, and availability - exactly what serious property buyers need to make informed decisions.
