-- Migration: Add tentative booking functionality to leads table
-- Date: 2025-06-30
-- Description: Adds tentative_booking_time column and updates status constraint

-- Add tentative_booking_time column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tentative_booking_time TIMESTAMP WITH TIME ZONE;

-- Update the status constraint to include the new tentative_booking_offered status
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN (
    'new', 
    'qualified', 
    'booked', 
    'booking_alternatives_offered', 
    'tentative_booking_offered',
    'appointment_cancelled', 
    'needs_human_handoff', 
    'converted', 
    'lost'
));

-- Add index for the new column for better performance
CREATE INDEX IF NOT EXISTS idx_leads_tentative_booking_time ON leads(tentative_booking_time);

-- Add comment to document the new column
COMMENT ON COLUMN leads.tentative_booking_time IS 'Timestamp for tentatively held booking slots when user wants to get back to us';

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'leads' 
AND column_name IN ('tentative_booking_time', 'status')
ORDER BY column_name;

-- Show the updated constraint
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name = 'leads_status_check';
