-- Database Schema Alignment Migration
-- Fixes critical mismatches between schema and code usage
-- Removes unused columns and adds missing ones

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CRITICAL FIX 1: MESSAGES TABLE ALIGNMENT
-- =====================================================

-- The code uses 'sender' and 'message' columns, but schema has 'direction' and 'message_text'
-- We need to align the schema with the actual code usage

-- Check if messages table exists and has the wrong columns
DO $$
BEGIN
    -- Add 'sender' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'sender') THEN
        ALTER TABLE messages ADD COLUMN sender VARCHAR(20) NOT NULL DEFAULT 'lead';
        RAISE NOTICE 'Added sender column to messages table';
    END IF;

    -- Add 'message' column if it doesn't exist  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message') THEN
        ALTER TABLE messages ADD COLUMN message TEXT NOT NULL DEFAULT '';
        RAISE NOTICE 'Added message column to messages table';
    END IF;

    -- Migrate data from old columns to new columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_text') THEN
        -- Copy data from message_text to message
        UPDATE messages SET message = COALESCE(message_text, '') WHERE message = '';
        RAISE NOTICE 'Migrated data from message_text to message column';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'direction') THEN
        -- Convert direction to sender format
        UPDATE messages SET sender = CASE 
            WHEN direction = 'inbound' THEN 'lead'
            WHEN direction = 'outbound' THEN 'assistant'
            ELSE 'lead'
        END WHERE sender = 'lead';
        RAISE NOTICE 'Migrated data from direction to sender column';
    END IF;
END $$;

-- =====================================================
-- CRITICAL FIX 2: TEMPLATE_USAGE_LOG MISSING COLUMNS
-- =====================================================

-- Add missing columns that are used in templateService.js
DO $$
BEGIN
    -- Add template_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_usage_log' AND column_name = 'template_id') THEN
        ALTER TABLE template_usage_log ADD COLUMN template_id VARCHAR(255);
        RAISE NOTICE 'Added template_id column to template_usage_log table';
    END IF;

    -- Add template_category column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_usage_log' AND column_name = 'template_category') THEN
        ALTER TABLE template_usage_log ADD COLUMN template_category VARCHAR(100);
        RAISE NOTICE 'Added template_category column to template_usage_log table';
    END IF;

    -- Add template_params column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_usage_log' AND column_name = 'template_params') THEN
        ALTER TABLE template_usage_log ADD COLUMN template_params JSONB;
        RAISE NOTICE 'Added template_params column to template_usage_log table';
    END IF;

    -- Add message_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_usage_log' AND column_name = 'message_id') THEN
        ALTER TABLE template_usage_log ADD COLUMN message_id VARCHAR(255);
        RAISE NOTICE 'Added message_id column to template_usage_log table';
    END IF;

    -- Add sent_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_usage_log' AND column_name = 'sent_at') THEN
        ALTER TABLE template_usage_log ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added sent_at column to template_usage_log table';
    END IF;
END $$;

-- =====================================================
-- CRITICAL FIX 3: APPOINTMENTS MISSING RESCHEDULE_REASON
-- =====================================================

-- Add reschedule_reason column that is referenced in appointmentService.js
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'reschedule_reason') THEN
        ALTER TABLE appointments ADD COLUMN reschedule_reason TEXT;
        RAISE NOTICE 'Added reschedule_reason column to appointments table';
    END IF;
END $$;

-- =====================================================
-- CLEANUP: REMOVE UNUSED COLUMNS (Optional - Commented Out)
-- =====================================================

-- Uncomment these if you want to remove unused columns
-- WARNING: This will permanently delete data in these columns

/*
-- Remove unused columns from agents table
DO $$
BEGIN
    -- Remove phone_number (unused)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'phone_number') THEN
        ALTER TABLE agents DROP COLUMN phone_number;
        RAISE NOTICE 'Removed unused phone_number column from agents table';
    END IF;

    -- Remove google_refresh_token_encrypted (OAuth not implemented)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'google_refresh_token_encrypted') THEN
        ALTER TABLE agents DROP COLUMN google_refresh_token_encrypted;
        RAISE NOTICE 'Removed unused google_refresh_token_encrypted column from agents table';
    END IF;

    -- Remove zoom_personal_meeting_id (unused)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'zoom_personal_meeting_id') THEN
        ALTER TABLE agents DROP COLUMN zoom_personal_meeting_id;
        RAISE NOTICE 'Removed unused zoom_personal_meeting_id column from agents table';
    END IF;

    -- Remove working_hours (never queried)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'working_hours') THEN
        ALTER TABLE agents DROP COLUMN working_hours;
        RAISE NOTICE 'Removed unused working_hours column from agents table';
    END IF;

    -- Remove timezone (hardcoded to Singapore)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'timezone') THEN
        ALTER TABLE agents DROP COLUMN timezone;
        RAISE NOTICE 'Removed unused timezone column from agents table';
    END IF;
END $$;

-- Remove unused columns from leads table
DO $$
BEGIN
    -- Remove location_preference (never referenced)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'location_preference') THEN
        ALTER TABLE leads DROP COLUMN location_preference;
        RAISE NOTICE 'Removed unused location_preference column from leads table';
    END IF;

    -- Remove property_type (never referenced)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'property_type') THEN
        ALTER TABLE leads DROP COLUMN property_type;
        RAISE NOTICE 'Removed unused property_type column from leads table';
    END IF;

    -- Remove timeline (never referenced)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'timeline') THEN
        ALTER TABLE leads DROP COLUMN timeline;
        RAISE NOTICE 'Removed unused timeline column from leads table';
    END IF;

    -- Remove additional_notes (never referenced)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'additional_notes') THEN
        ALTER TABLE leads DROP COLUMN additional_notes;
        RAISE NOTICE 'Removed unused additional_notes column from leads table';
    END IF;

    -- Remove last_interaction (never updated or queried)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'last_interaction') THEN
        ALTER TABLE leads DROP COLUMN last_interaction;
        RAISE NOTICE 'Removed unused last_interaction column from leads table';
    END IF;
END $$;

-- Remove unused columns from messages table (after data migration)
DO $$
BEGIN
    -- Remove old message_text column (replaced by message)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_text') THEN
        ALTER TABLE messages DROP COLUMN message_text;
        RAISE NOTICE 'Removed old message_text column from messages table';
    END IF;

    -- Remove direction column (replaced by sender)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'direction') THEN
        ALTER TABLE messages DROP COLUMN direction;
        RAISE NOTICE 'Removed old direction column from messages table';
    END IF;

    -- Remove unused columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'agent_id') THEN
        ALTER TABLE messages DROP COLUMN agent_id;
        RAISE NOTICE 'Removed unused agent_id column from messages table';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type') THEN
        ALTER TABLE messages DROP COLUMN message_type;
        RAISE NOTICE 'Removed unused message_type column from messages table';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'gupshup_message_id') THEN
        ALTER TABLE messages DROP COLUMN gupshup_message_id;
        RAISE NOTICE 'Removed unused gupshup_message_id column from messages table';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'status') THEN
        ALTER TABLE messages DROP COLUMN status;
        RAISE NOTICE 'Removed unused status column from messages table';
    END IF;
END $$;
*/

-- =====================================================
-- UPDATE CONSTRAINTS AND INDEXES
-- =====================================================

-- Update constraints for new columns
DO $$
BEGIN
    -- Add constraint for sender column
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'messages_sender_check') THEN
        ALTER TABLE messages ADD CONSTRAINT messages_sender_check CHECK (sender IN ('lead', 'assistant', 'agent'));
        RAISE NOTICE 'Added sender constraint to messages table';
    END IF;
END $$;

-- Add indexes for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
CREATE INDEX IF NOT EXISTS idx_template_usage_template_id ON template_usage_log(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_sent_at ON template_usage_log(sent_at);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify the changes
DO $$
DECLARE
    table_info RECORD;
BEGIN
    RAISE NOTICE '=== SCHEMA VERIFICATION ===';
    
    -- Check messages table structure
    RAISE NOTICE 'Messages table columns:';
    FOR table_info IN 
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  - %: %', table_info.column_name, table_info.data_type;
    END LOOP;
    
    -- Check template_usage_log table structure
    RAISE NOTICE 'Template usage log columns:';
    FOR table_info IN 
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'template_usage_log' 
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  - %: %', table_info.column_name, table_info.data_type;
    END LOOP;
    
    RAISE NOTICE '=== MIGRATION COMPLETED ===';
END $$;
