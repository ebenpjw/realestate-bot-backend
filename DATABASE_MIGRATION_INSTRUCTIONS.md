# 🗄️ CRITICAL DATABASE MIGRATION REQUIRED

## 🚨 **BEFORE DEPLOYMENT - MANDATORY STEP**

Your database schema has critical mismatches with the code. **You must run this migration before deploying** or the application will fail.

## 📋 **STEP-BY-STEP MIGRATION INSTRUCTIONS**

### **Option 1: Supabase Dashboard (Recommended)**

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project: `re-bot-db`

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste the Migration SQL**
   - Copy the entire contents of: `supabase/migrations/002_fix_schema_alignment.sql`
   - Paste it into the SQL Editor

4. **Execute the Migration**
   - Click "Run" button
   - Wait for completion (should take 10-30 seconds)
   - Check for any error messages

5. **Verify Success**
   - You should see "Migration completed" messages
   - No error messages should appear

### **Option 2: Command Line (Alternative)**

If you have Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref kirudrpypiawrbhdjjzj

# Run the migration
supabase db push
```

## 🔍 **WHAT THIS MIGRATION FIXES**

### **Critical Issues Being Resolved:**

1. **Messages Table Mismatch** 🚨
   - **Problem**: Code uses `sender` and `message` columns
   - **Schema**: Has `direction` and `message_text` columns
   - **Fix**: Adds correct columns and migrates data

2. **Template Usage Log Missing Columns** 🚨
   - **Problem**: Code tries to insert into non-existent columns
   - **Missing**: `template_id`, `template_category`, `template_params`, `message_id`, `sent_at`
   - **Fix**: Adds all missing columns

3. **Appointments Missing Reschedule Reason** ⚠️
   - **Problem**: Code references `reschedule_reason` column
   - **Schema**: Column doesn't exist
   - **Fix**: Adds the missing column

### **Performance Improvements:**
- Adds indexes for better query performance
- Optimizes column types and constraints

## ✅ **VERIFICATION STEPS**

After running the migration, verify it worked:

1. **Check Messages Table**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'messages' 
   ORDER BY ordinal_position;
   ```
   Should include: `sender`, `message`

2. **Check Template Usage Log**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'template_usage_log' 
   ORDER BY ordinal_position;
   ```
   Should include: `template_id`, `template_category`, `template_params`, `message_id`, `sent_at`

3. **Check Appointments Table**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'appointments' 
   ORDER BY ordinal_position;
   ```
   Should include: `reschedule_reason`

## 🚨 **DEPLOYMENT BLOCKER**

**DO NOT DEPLOY WITHOUT RUNNING THIS MIGRATION**

If you deploy without this migration:
- ❌ Messages won't save correctly
- ❌ Template logging will fail
- ❌ Appointment rescheduling won't work
- ❌ Application may crash with database errors

## 📞 **TROUBLESHOOTING**

### **If Migration Fails:**

1. **Check Error Messages**
   - Look for specific SQL errors
   - Note which part of the migration failed

2. **Common Issues:**
   - **Permission Error**: Ensure you're using the service role key
   - **Column Already Exists**: Some columns might already exist (this is OK)
   - **Syntax Error**: Copy the SQL exactly as provided

3. **Manual Column Addition**
   If the full migration fails, you can add columns individually:

   ```sql
   -- Add missing message columns
   ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender VARCHAR(20) DEFAULT 'lead';
   ALTER TABLE messages ADD COLUMN IF NOT EXISTS message TEXT DEFAULT '';

   -- Add missing template log columns
   ALTER TABLE template_usage_log ADD COLUMN IF NOT EXISTS template_id VARCHAR(255);
   ALTER TABLE template_usage_log ADD COLUMN IF NOT EXISTS template_category VARCHAR(100);
   ALTER TABLE template_usage_log ADD COLUMN IF NOT EXISTS template_params JSONB;
   ALTER TABLE template_usage_log ADD COLUMN IF NOT EXISTS message_id VARCHAR(255);
   ALTER TABLE template_usage_log ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

   -- Add missing appointment column
   ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;
   ```

### **Need Help?**

If you encounter issues:
1. Check the Supabase dashboard logs
2. Verify your service role key has proper permissions
3. Try running individual SQL statements instead of the full migration

## ✅ **READY TO DEPLOY**

Once the migration is complete and verified:
1. ✅ Database schema is aligned with code
2. ✅ All critical columns exist
3. ✅ Performance indexes are in place
4. ✅ Ready for application deployment

**Proceed with the normal deployment process after completing this migration.**
