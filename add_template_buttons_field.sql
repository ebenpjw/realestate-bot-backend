-- Add template_buttons field to waba_templates table
-- This field will store button configuration as JSONB for interactive templates

-- Add the template_buttons column if it doesn't exist
ALTER TABLE waba_templates 
ADD COLUMN IF NOT EXISTS template_buttons JSONB DEFAULT NULL;

-- Add comment to document the field
COMMENT ON COLUMN waba_templates.template_buttons IS 'Button configuration for interactive templates (JSONB array)';

-- Update template_type constraint to include INTERACTIVE
ALTER TABLE waba_templates DROP CONSTRAINT IF EXISTS waba_templates_template_type_check;
ALTER TABLE waba_templates ADD CONSTRAINT waba_templates_template_type_check 
CHECK (template_type IN ('TEXT', 'INTERACTIVE', 'standard', 'welcome', 'followup', 'reminder', 'appointment'));

-- Create index for template_buttons for better query performance
CREATE INDEX IF NOT EXISTS idx_waba_templates_buttons ON waba_templates USING GIN (template_buttons);

-- Example of button data structure:
-- [
--   {
--     "id": "btn_1",
--     "type": "QUICK_REPLY",
--     "text": "Book Appointment"
--   },
--   {
--     "id": "btn_2", 
--     "type": "URL",
--     "text": "View Property",
--     "url": "https://example.com/property/123"
--   },
--   {
--     "id": "btn_3",
--     "type": "PHONE_NUMBER", 
--     "text": "Call Agent",
--     "phoneNumber": "+6512345678"
--   }
-- ]
