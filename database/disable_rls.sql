-- Disable RLS on all tables in the real estate bot database
-- This will allow your backend service to insert/update records without RLS restrictions

-- Disable RLS on agents table
ALTER TABLE agents DISABLE ROW LEVEL SECURITY;

-- Disable RLS on leads table  
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- Disable RLS on messages table
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Disable RLS on appointments table
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;

-- Disable RLS on template_usage_log table
ALTER TABLE template_usage_log DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies to clean up

-- Drop policies on agents table
DROP POLICY IF EXISTS "Service role full access" ON agents;
DROP POLICY IF EXISTS "Agents can view own data" ON agents;
DROP POLICY IF EXISTS "Agents can update own data" ON agents;
DROP POLICY IF EXISTS "Allow all for service role" ON agents;

-- Drop policies on leads table
DROP POLICY IF EXISTS "Service role full access" ON leads;
DROP POLICY IF EXISTS "Agents can view assigned leads" ON leads;
DROP POLICY IF EXISTS "Agents can update assigned leads" ON leads;
DROP POLICY IF EXISTS "Allow all for service role" ON leads;

-- Drop policies on messages table
DROP POLICY IF EXISTS "Service role full access" ON messages;
DROP POLICY IF EXISTS "Agents can view messages for their leads" ON messages;
DROP POLICY IF EXISTS "Allow all for service role" ON messages;

-- Drop policies on appointments table
DROP POLICY IF EXISTS "Service role full access" ON appointments;
DROP POLICY IF EXISTS "Agents can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Agents can update own appointments" ON appointments;
DROP POLICY IF EXISTS "Allow all for service role" ON appointments;
DROP POLICY IF EXISTS "Agents can view their appointments" ON appointments;

-- Drop policies on template_usage_log table
DROP POLICY IF EXISTS "Service role full access" ON template_usage_log;
DROP POLICY IF EXISTS "Allow all for service role" ON template_usage_log;

-- Verify RLS is disabled (this query will show 'f' for all tables if RLS is disabled)
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('agents', 'leads', 'messages', 'appointments', 'template_usage_log')
ORDER BY tablename;
