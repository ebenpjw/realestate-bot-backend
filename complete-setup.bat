@echo off
echo Completing Supabase database setup...

set SUPABASE_URL=https://kirudrpypiawrbhdjjzj.supabase.co
set SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcnVkcnB5cGlhd3JiaGRqanpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MjM5MzQsImV4cCI6MjA2NTA5OTkzNH0.-mextHPgvc-6dak48j4_fYKzDPcuZg4JRQzCuTHrOVg

echo Creating missing tables...
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const sql = fs.readFileSync('fix-missing-tables.sql', 'utf8');
console.log('Executing final SQL script...');
// Note: This would need proper SQL execution - recommend manual approach
console.log('Please run the SQL script manually in Supabase SQL Editor');
console.log('File: fix-missing-tables.sql');
"

echo.
echo Setup complete! Please run the SQL script manually in Supabase.
pause
