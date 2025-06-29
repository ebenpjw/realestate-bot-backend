# 🗄️ DATABASE SCHEMA ANALYSIS & CLEANUP

## 📊 CURRENT SCHEMA vs CODE USAGE ANALYSIS

### **AGENTS TABLE**
**Schema Columns:**
- ✅ `id` - Used (Primary key, referenced everywhere)
- ✅ `full_name` - Used (leadManager.js, databaseService.js)
- ✅ `email` - Used (setup scripts, agent queries)
- ❌ `phone_number` - **UNUSED** (defined but never referenced)
- ✅ `status` - Used (leadManager.js for active agent lookup)
- ✅ `google_email` - Used (appointmentService.js for calendar events)
- ❌ `google_refresh_token_encrypted` - **UNUSED** (OAuth not implemented)
- ✅ `zoom_user_id` - Used (appointmentService.js for Zoom meetings)
- ❌ `zoom_personal_meeting_id` - **UNUSED** (not referenced in code)
- ❌ `working_hours` - **UNUSED** (defined but never queried)
- ❌ `timezone` - **UNUSED** (hardcoded to Singapore everywhere)
- ✅ `created_at` - Used (standard timestamp)
- ✅ `updated_at` - Used (standard timestamp)

**Missing Columns:**
- ❌ `zoom_email` - Referenced in migration but missing from main schema
- ❌ `zoom_connected_at` - Referenced in migration but missing from main schema

### **LEADS TABLE**
**Schema Columns:**
- ✅ `id` - Used (Primary key, referenced everywhere)
- ✅ `phone_number` - Used (Primary lookup field)
- ✅ `full_name` - Used (Display and calendar events)
- ✅ `source` - Used (Lead tracking)
- ✅ `status` - Used (State management, critical field)
- ✅ `assigned_agent_id` - Used (Agent assignment)
- ✅ `intent` - Used (Qualification data)
- ✅ `budget` - Used (Qualification data)
- ❌ `location_preference` - **UNUSED** (never referenced)
- ❌ `property_type` - **UNUSED** (never referenced)
- ❌ `timeline` - **UNUSED** (never referenced)
- ❌ `additional_notes` - **UNUSED** (never referenced)
- ✅ `booking_alternatives` - Used (Alternative time slots)
- ❌ `last_interaction` - **UNUSED** (never updated or queried)
- ✅ `created_at` - Used (Standard timestamp)
- ✅ `updated_at` - Used (Updated in botService.js)

### **MESSAGES TABLE**
**Schema vs Code Mismatch:**
- ✅ `id` - Used
- ✅ `lead_id` - Used
- ❌ `agent_id` - **UNUSED** (defined but never set)
- ❌ `message_text` - **SCHEMA NAME** vs `message` - **CODE NAME** ⚠️
- ❌ `direction` - **UNUSED** (defined but never set)
- ❌ `message_type` - **UNUSED** (defined but never set)
- ❌ `gupshup_message_id` - **UNUSED** (defined but never set)
- ❌ `status` - **UNUSED** (defined but never set)
- ✅ `created_at` - Used

**Code References:**
- `sender` - Used in code but not in schema ⚠️
- `message` - Used in code but schema has `message_text` ⚠️

### **APPOINTMENTS TABLE**
**Schema Columns:**
- ✅ `id` - Used
- ✅ `lead_id` - Used
- ✅ `agent_id` - Used
- ✅ `appointment_time` - Used
- ✅ `duration_minutes` - Used
- ✅ `zoom_meeting_id` - Used
- ✅ `zoom_join_url` - Used
- ✅ `zoom_password` - Used
- ✅ `calendar_event_id` - Used
- ✅ `consultation_notes` - Used
- ✅ `status` - Used
- ✅ `created_at` - Used
- ✅ `updated_at` - Used

**Missing Columns:**
- ❌ `reschedule_reason` - Referenced in appointmentService.js but missing from schema

### **TEMPLATE_USAGE_LOG TABLE**
**Schema vs Code Mismatch:**
- ✅ `id` - Used
- ✅ `template_name` - Used
- ✅ `lead_id` - Used
- ✅ `agent_id` - Used
- ✅ `phone_number` - Used
- ✅ `status` - Used
- ✅ `gupshup_response` - Used
- ✅ `created_at` - Used

**Missing Columns (from templateService.js):**
- ❌ `template_id` - Used in code but missing from schema
- ❌ `template_category` - Used in code but missing from schema
- ❌ `template_params` - Used in code but missing from schema
- ❌ `message_id` - Used in code but missing from schema
- ❌ `sent_at` - Used in code but missing from schema

## 🚨 CRITICAL ISSUES FOUND

### **1. MESSAGES TABLE MISMATCH**
**Problem**: Code uses `sender` and `message` columns, but schema defines `direction` and `message_text`
**Impact**: HIGH - Messages may not be saving correctly
**Fix Required**: Align schema with code usage

### **2. TEMPLATE_USAGE_LOG INCOMPLETE**
**Problem**: Code tries to insert columns that don't exist in schema
**Impact**: MEDIUM - Template logging may fail silently
**Fix Required**: Add missing columns

### **3. APPOINTMENTS MISSING RESCHEDULE_REASON**
**Problem**: Code references `reschedule_reason` column that doesn't exist
**Impact**: LOW - Reschedule reason not being saved
**Fix Required**: Add missing column

### **4. UNUSED COLUMNS BLOAT**
**Problem**: Many columns defined but never used
**Impact**: LOW - Database bloat, confusion
**Fix Required**: Remove unused columns

## 📋 RECOMMENDED ACTIONS

### **IMMEDIATE FIXES (Critical)**
1. Fix messages table column mismatch
2. Add missing template_usage_log columns
3. Add missing appointments.reschedule_reason column

### **CLEANUP (Optional)**
1. Remove unused columns from agents table
2. Remove unused columns from leads table
3. Standardize column naming conventions

### **VALIDATION**
1. Test all database operations after changes
2. Verify no code breaks due to column removals
3. Update any remaining references
