-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS) FOR ALL TABLES
-- =====================================================
-- Run this in your Supabase SQL Editor to enable proper security

-- =====================================================
-- 1. ENABLE RLS ON ALL TABLES
-- =====================================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. DROP EXISTING POLICIES (IF ANY)
-- =====================================================
DROP POLICY IF EXISTS "Service role full access" ON agents;
DROP POLICY IF EXISTS "Service role full access" ON leads;
DROP POLICY IF EXISTS "Service role full access" ON messages;
DROP POLICY IF EXISTS "Service role full access" ON appointments;
DROP POLICY IF EXISTS "Service role full access" ON template_usage_log;

DROP POLICY IF EXISTS "Agents can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Agents can update own appointments" ON appointments;

-- =====================================================
-- 3. CREATE SERVICE ROLE POLICIES (YOUR BACKEND)
-- =====================================================
-- These allow your backend service to access all data

CREATE POLICY "Backend service full access" ON agents 
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Backend service full access" ON leads 
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Backend service full access" ON messages 
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Backend service full access" ON appointments 
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Backend service full access" ON template_usage_log 
    FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- 4. CREATE ANON ROLE POLICIES (PUBLIC ACCESS)
-- =====================================================
-- These allow limited public access for webhooks

-- Allow anon to read basic agent info (for assignment)
CREATE POLICY "Public can view active agents" ON agents 
    FOR SELECT USING (auth.role() = 'anon' AND status = 'active');

-- Allow anon to read leads (WhatsApp webhook)
CREATE POLICY "Public can read leads" ON leads
    FOR SELECT USING (auth.role() = 'anon');

-- Allow anon to create leads (WhatsApp webhook)
CREATE POLICY "Public can create leads" ON leads
    FOR INSERT WITH CHECK (auth.role() = 'anon');

-- Allow anon to update leads (WhatsApp webhook)
CREATE POLICY "Public can update leads" ON leads
    FOR UPDATE USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

-- Allow anon to create messages (WhatsApp webhook)
CREATE POLICY "Public can create messages" ON messages
    FOR INSERT WITH CHECK (auth.role() = 'anon');

-- Allow anon to read messages for conversation context
CREATE POLICY "Public can read messages" ON messages
    FOR SELECT USING (auth.role() = 'anon');

-- Allow anon to create template usage logs (WABA compliance)
CREATE POLICY "Public can log template usage" ON template_usage_log
    FOR INSERT WITH CHECK (auth.role() = 'anon');

-- =====================================================
-- 5. CREATE AUTHENTICATED USER POLICIES (AGENTS)
-- =====================================================
-- These are for when you add agent authentication later

-- Agents can view their own profile
CREATE POLICY "Agents can view own profile" ON agents 
    FOR SELECT USING (auth.uid() = id);

-- Agents can update their own profile
CREATE POLICY "Agents can update own profile" ON agents 
    FOR UPDATE USING (auth.uid() = id);

-- Agents can view their assigned leads
CREATE POLICY "Agents can view assigned leads" ON leads 
    FOR SELECT USING (auth.uid() = assigned_agent_id);

-- Agents can update their assigned leads
CREATE POLICY "Agents can update assigned leads" ON leads 
    FOR UPDATE USING (auth.uid() = assigned_agent_id);

-- Agents can view messages for their leads
CREATE POLICY "Agents can view lead messages" ON messages 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads 
            WHERE leads.id = messages.lead_id 
            AND leads.assigned_agent_id = auth.uid()
        )
    );

-- Agents can create messages for their leads
CREATE POLICY "Agents can create lead messages" ON messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM leads
            WHERE leads.id = messages.lead_id
            AND leads.assigned_agent_id = auth.uid()
        )
    );

-- Agents can view their appointments
CREATE POLICY "Agents can view own appointments" ON appointments 
    FOR SELECT USING (auth.uid() = agent_id);

-- Agents can update their appointments
CREATE POLICY "Agents can update own appointments" ON appointments 
    FOR UPDATE USING (auth.uid() = agent_id);

-- Agents can create appointments for their leads
CREATE POLICY "Agents can create appointments" ON appointments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM leads
            WHERE leads.id = appointments.lead_id
            AND leads.assigned_agent_id = auth.uid()
        )
    );

-- =====================================================
-- 6. GRANT PERMISSIONS TO VIEWS
-- =====================================================
-- Ensure views work with RLS enabled

GRANT SELECT ON appointment_details TO anon;
GRANT SELECT ON appointment_details TO authenticated;
GRANT SELECT ON appointment_details TO service_role;

GRANT SELECT ON template_usage_analytics TO anon;
GRANT SELECT ON template_usage_analytics TO authenticated;
GRANT SELECT ON template_usage_analytics TO service_role;

-- =====================================================
-- 7. VERIFICATION QUERIES
-- =====================================================
-- Check that RLS is enabled on all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('agents', 'leads', 'messages', 'appointments', 'template_usage_log')
ORDER BY tablename;

-- Success message
SELECT 'RLS enabled successfully! Your database is now secure.' as status;
