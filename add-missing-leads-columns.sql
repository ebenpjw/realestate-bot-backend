-- =====================================================
-- ADD MISSING COLUMNS TO LEADS TABLE
-- =====================================================
-- Run this FIRST before enabling RLS

-- Add missing columns to leads table if they don't exist
DO $$
BEGIN
    -- Lead qualification columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'intent') THEN
        ALTER TABLE leads ADD COLUMN intent TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'budget') THEN
        ALTER TABLE leads ADD COLUMN budget VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'location_preference') THEN
        ALTER TABLE leads ADD COLUMN location_preference TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'property_type') THEN
        ALTER TABLE leads ADD COLUMN property_type VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'timeline') THEN
        ALTER TABLE leads ADD COLUMN timeline VARCHAR(100);
    END IF;
    
    -- Lead management columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'status') THEN
        ALTER TABLE leads ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'new';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'source') THEN
        ALTER TABLE leads ADD COLUMN source VARCHAR(100) NOT NULL DEFAULT 'WA Direct';
    END IF;
    
    -- CRITICAL: Add assigned_agent_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'assigned_agent_id') THEN
        ALTER TABLE leads ADD COLUMN assigned_agent_id UUID REFERENCES agents(id);
    END IF;
    
    -- AI conversation memory
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'conversation_summary') THEN
        ALTER TABLE leads ADD COLUMN conversation_summary TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'last_interaction_at') THEN
        ALTER TABLE leads ADD COLUMN last_interaction_at TIMESTAMPTZ;
    END IF;
    
    -- Lead scoring
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'lead_score') THEN
        ALTER TABLE leads ADD COLUMN lead_score INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'notes') THEN
        ALTER TABLE leads ADD COLUMN notes TEXT;
    END IF;
    
    -- Timestamps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'updated_at') THEN
        ALTER TABLE leads ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- =====================================================
-- ADD CONSTRAINTS TO LEADS TABLE
-- =====================================================

-- Add status constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'leads_status_check') THEN
        ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN ('new', 'qualified', 'booked', 'needs_human_handoff', 'converted', 'lost'));
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Constraint might already exist, continue
        NULL;
END $$;

-- Add lead_score constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'leads_lead_score_check') THEN
        ALTER TABLE leads ADD CONSTRAINT leads_lead_score_check CHECK (lead_score >= 0 AND lead_score <= 100);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Constraint might already exist, continue
        NULL;
END $$;

-- =====================================================
-- CREATE INDEXES FOR LEADS TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent_id ON leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_last_interaction_at ON leads(last_interaction_at);

-- =====================================================
-- CREATE UPDATED_AT TRIGGER FOR LEADS
-- =====================================================
-- Drop trigger if it exists, then recreate it
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'Missing leads columns added successfully! Now you can enable RLS.' as status;
