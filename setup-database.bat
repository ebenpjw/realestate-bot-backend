@echo off
echo ============================================================
echo SUPABASE DATABASE SETUP - REAL ESTATE BOT
echo ============================================================
echo.

echo Your Supabase Project Details:
echo   Project ID: kirudrpypiawrbhdjjzj
echo   Project URL: https://kirudrpypiawrbhdjjzj.supabase.co
echo   Region: ap-southeast-1
echo.

echo To complete the setup, you need to get your API keys from Supabase:
echo.
echo 1. Go to: https://supabase.com/dashboard/project/kirudrpypiawrbhdjjzj/settings/api
echo 2. Copy your "anon public" key
echo 3. Paste it below when prompted
echo.

set /p SUPABASE_KEY="Enter your Supabase ANON key: "

if "%SUPABASE_KEY%"=="" (
    echo Error: Supabase key is required!
    pause
    exit /b 1
)

echo.
echo Setting up environment variables...
set SUPABASE_URL=https://kirudrpypiawrbhdjjzj.supabase.co

echo.
echo Running database setup...
node scripts/setup-supabase.js

echo.
echo Setup complete! Press any key to continue...
pause
