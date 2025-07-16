-- ============================================================================
-- PARTNER API WABA COLUMNS MIGRATION
-- Version: 003
-- Date: 2025-07-15
-- Purpose: Add missing WABA columns for Partner API multi-tenant architecture
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. ADD MISSING WABA COLUMNS TO AGENTS TABLE
-- These columns are referenced in the code but missing from main schema
-- ============================================================================

DO $$
BEGIN
    -- Add WABA phone number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'waba_phone_number') THEN
        ALTER TABLE agents ADD COLUMN waba_phone_number VARCHAR(20);
    END IF;

    -- Add encrypted Gupshup API key
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'gupshup_api_key_encrypted') THEN
        ALTER TABLE agents ADD COLUMN gupshup_api_key_encrypted TEXT;
    END IF;

    -- Add Gupshup app ID (from Partner API)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'gupshup_app_id') THEN
        ALTER TABLE agents ADD COLUMN gupshup_app_id VARCHAR(255);
    END IF;

    -- Add WABA display name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'waba_display_name') THEN
        ALTER TABLE agents ADD COLUMN waba_display_name VARCHAR(255);
    END IF;

    -- Add bot name (customizable per agent)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'bot_name') THEN
        ALTER TABLE agents ADD COLUMN bot_name VARCHAR(100) DEFAULT 'Doro';
    END IF;

    -- Add password hash for agent authentication
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'password_hash') THEN
        ALTER TABLE agents ADD COLUMN password_hash TEXT;
    END IF;

    -- Add role for agent permissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'role') THEN
        ALTER TABLE agents ADD COLUMN role VARCHAR(50) DEFAULT 'agent';
    END IF;

    -- Add organization ID for multi-org support
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'organization_id') THEN
        ALTER TABLE agents ADD COLUMN organization_id UUID;
    END IF;

    -- Add Partner API specific fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'partner_app_created') THEN
        ALTER TABLE agents ADD COLUMN partner_app_created BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'partner_app_created_at') THEN
        ALTER TABLE agents ADD COLUMN partner_app_created_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'waba_status') THEN
        ALTER TABLE agents ADD COLUMN waba_status VARCHAR(50) DEFAULT 'pending' CHECK (waba_status IN ('pending', 'active', 'suspended', 'error'));
    END IF;
END $$;

-- ============================================================================
-- 2. CREATE WABA TEMPLATES TABLE FOR AGENT-SPECIFIC TEMPLATES
-- Replace hardcoded template system with dynamic per-agent templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS waba_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    template_id VARCHAR(255), -- Gupshup template ID after approval
    template_category VARCHAR(50) DEFAULT 'UTILITY' CHECK (template_category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
    template_content TEXT NOT NULL,
    template_params JSONB DEFAULT '[]'::jsonb,
    language_code VARCHAR(10) DEFAULT 'en',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'submitted')),
    
    -- Approval tracking
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Template metadata
    template_type VARCHAR(50) DEFAULT 'standard', -- standard, welcome, followup, reminder
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(agent_id, template_name)
);

-- ============================================================================
-- 3. CREATE PARTNER API TOKENS TABLE FOR TOKEN MANAGEMENT
-- Store Partner API tokens securely with expiry tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_encrypted TEXT NOT NULL,
    token_iv VARCHAR(255) NOT NULL,
    token_tag VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. CREATE TEMPLATE USAGE LOG TABLE FOR COMPLIANCE TRACKING
-- Track template usage for WABA compliance and analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS template_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    gupshup_response JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. CREATE ORGANIZATIONS TABLE FOR MULTI-ORG SUPPORT
-- Support multiple organizations under Partner API
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    
    -- Partner API settings
    partner_settings JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- WABA templates indexes
CREATE INDEX IF NOT EXISTS idx_waba_templates_agent_id ON waba_templates(agent_id);
CREATE INDEX IF NOT EXISTS idx_waba_templates_status ON waba_templates(status);
CREATE INDEX IF NOT EXISTS idx_waba_templates_type ON waba_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_waba_templates_category ON waba_templates(template_category);

-- Template usage log indexes
CREATE INDEX IF NOT EXISTS idx_template_usage_log_phone ON template_usage_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_template_usage_log_agent ON template_usage_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_log_status ON template_usage_log(status);
CREATE INDEX IF NOT EXISTS idx_template_usage_log_created ON template_usage_log(created_at);

-- Agents WABA indexes
CREATE INDEX IF NOT EXISTS idx_agents_waba_phone ON agents(waba_phone_number);
CREATE INDEX IF NOT EXISTS idx_agents_app_id ON agents(gupshup_app_id);
CREATE INDEX IF NOT EXISTS idx_agents_waba_status ON agents(waba_status);
CREATE INDEX IF NOT EXISTS idx_agents_organization ON agents(organization_id);

-- Organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- ============================================================================
-- 6. ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Add organization foreign key if organizations table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
        -- Add foreign key constraint for organization_id if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'agents_organization_id_fkey' 
            AND table_name = 'agents'
        ) THEN
            ALTER TABLE agents ADD CONSTRAINT agents_organization_id_fkey 
            FOREIGN KEY (organization_id) REFERENCES organizations(id);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 7. CREATE TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Update triggers for new tables
CREATE TRIGGER update_waba_templates_updated_at
    BEFORE UPDATE ON waba_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_usage_log_updated_at
    BEFORE UPDATE ON template_usage_log
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. INSERT DEFAULT ORGANIZATION IF NONE EXISTS
-- ============================================================================

INSERT INTO organizations (id, name, status)
SELECT 'dba41bdd-2a1c-4c83-9fc6-0f2e758f026a'::uuid, 'Default Organization', 'active'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE id = 'dba41bdd-2a1c-4c83-9fc6-0f2e758f026a'::uuid);

-- ============================================================================
-- 9. UPDATE EXISTING AGENTS WITH DEFAULT VALUES
-- ============================================================================

-- Set default organization for existing agents without one
UPDATE agents 
SET organization_id = 'dba41bdd-2a1c-4c83-9fc6-0f2e758f026a'::uuid
WHERE organization_id IS NULL;

-- Set default bot names for existing agents
UPDATE agents 
SET bot_name = 'Doro'
WHERE bot_name IS NULL;

-- Set default role for existing agents
UPDATE agents 
SET role = 'agent'
WHERE role IS NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- Database schema now supports Partner API multi-tenant architecture
-- ============================================================================
