@echo off
echo Setting up Supabase environment variables...

set SUPABASE_URL=https://kirudrpypiawrbhdjjzj.supabase.co
set SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcnVkcnB5cGlhd3JiaGRqanpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MjM5MzQsImV4cCI6MjA2NTA5OTkzNH0.-mextHPgvc-6dak48j4_fYKzDPcuZg4JRQzCuTHrOVg

echo Running Supabase database setup...
node scripts/setup-supabase.js

pause
