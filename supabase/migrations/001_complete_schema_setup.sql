-- Complete Database Schema Setup for Real Estate WhatsApp Bot
-- This migration creates all necessary tables and adds missing columns

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create agents table if it doesn't exist
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'busy')),
    google_email VARCHAR(255),
    google_refresh_token_encrypted TEXT,
    zoom_user_id VARCHAR(255),
    zoom_personal_meeting_id VARCHAR(255),
    working_hours JSONB DEFAULT '{"start": 9, "end": 18, "days": [1, 2, 3, 4, 5]}',
    timezone VARCHAR(100) DEFAULT 'Asia/Singapore',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to agents table if they don't exist
DO $$ 
BEGIN
    -- Add working_hours column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'working_hours') THEN
        ALTER TABLE agents ADD COLUMN working_hours JSONB DEFAULT '{"start": 9, "end": 18, "days": [1, 2, 3, 4, 5]}';
    END IF;
    
    -- Add timezone column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'timezone') THEN
        ALTER TABLE agents ADD COLUMN timezone VARCHAR(100) DEFAULT 'Asia/Singapore';
    END IF;
    
    -- Add zoom_user_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'zoom_user_id') THEN
        ALTER TABLE agents ADD COLUMN zoom_user_id VARCHAR(255);
    END IF;
    
    -- Add zoom_personal_meeting_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'zoom_personal_meeting_id') THEN
        ALTER TABLE agents ADD COLUMN zoom_personal_meeting_id VARCHAR(255);
    END IF;
END $$;

-- Create leads table if it doesn't exist
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) NOT NULL,
    full_name VARCHAR(255),
    source VARCHAR(100) DEFAULT 'WA Direct',
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'booked', 'booking_alternatives_offered', 'appointment_cancelled', 'needs_human_handoff', 'converted', 'lost')),
    assigned_agent_id UUID REFERENCES agents(id),
    intent VARCHAR(100),
    budget VARCHAR(255),
    location_preference VARCHAR(255),
    property_type VARCHAR(100),
    timeline VARCHAR(100),
    additional_notes TEXT,
    booking_alternatives JSONB,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id),
    message_text TEXT NOT NULL,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type VARCHAR(50) DEFAULT 'text',
    gupshup_message_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create appointments table if it doesn't exist
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id),
    appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    zoom_meeting_id VARCHAR(255),
    zoom_join_url TEXT,
    zoom_password VARCHAR(50),
    calendar_event_id VARCHAR(255),
    consultation_notes TEXT,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create template_usage_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS template_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(255) NOT NULL,
    lead_id UUID REFERENCES leads(id),
    agent_id UUID REFERENCES agents(id),
    phone_number VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    gupshup_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_phone_number ON leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent ON leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_agent_id ON appointments(agent_id);
CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(appointment_time);
CREATE INDEX IF NOT EXISTS idx_template_usage_phone ON template_usage_log(phone_number);

-- Update existing agents with default working hours if they don't have them
UPDATE agents 
SET working_hours = '{"start": 9, "end": 18, "days": [1, 2, 3, 4, 5]}'::jsonb,
    timezone = 'Asia/Singapore'
WHERE working_hours IS NULL OR timezone IS NULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust as needed for your setup)
-- These are basic permissions - you may need to adjust based on your RLS policies
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
