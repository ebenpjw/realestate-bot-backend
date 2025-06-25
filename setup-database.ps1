# Supabase Database Setup Script
# Real Estate WhatsApp Bot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "SUPABASE DATABASE SETUP - REAL ESTATE BOT" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Your Supabase Project Details:" -ForegroundColor Green
Write-Host "  Project ID: kirudrpypiawrbhdjjzj" -ForegroundColor Yellow
Write-Host "  Project URL: https://kirudrpypiawrbhdjjzj.supabase.co" -ForegroundColor Yellow
Write-Host "  Region: ap-southeast-1" -ForegroundColor Yellow
Write-Host ""

Write-Host "To complete the setup, you need to get your API keys from Supabase:" -ForegroundColor White
Write-Host ""
Write-Host "1. Go to: https://supabase.com/dashboard/project/kirudrpypiawrbhdjjzj/settings/api" -ForegroundColor Cyan
Write-Host "2. Copy your 'anon public' key" -ForegroundColor Cyan
Write-Host "3. Paste it below when prompted" -ForegroundColor Cyan
Write-Host ""

# Open Supabase dashboard in browser
Write-Host "Opening Supabase dashboard in your browser..." -ForegroundColor Green
Start-Process "https://supabase.com/dashboard/project/kirudrpypiawrbhdjjzj/settings/api"

Write-Host ""
$supabaseKey = Read-Host "Enter your Supabase ANON key"

if ([string]::IsNullOrWhiteSpace($supabaseKey)) {
    Write-Host "Error: Supabase key is required!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Setting up environment variables..." -ForegroundColor Green
$env:SUPABASE_URL = "https://kirudrpypiawrbhdjjzj.supabase.co"
$env:SUPABASE_KEY = $supabaseKey

Write-Host ""
Write-Host "Running database setup..." -ForegroundColor Green
Write-Host ""

try {
    node scripts/setup-supabase.js
    Write-Host ""
    Write-Host "✅ Database setup completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Add these environment variables to Railway:" -ForegroundColor White
    Write-Host "   SUPABASE_URL=https://kirudrpypiawrbhdjjzj.supabase.co" -ForegroundColor Cyan
    Write-Host "   SUPABASE_KEY=$supabaseKey" -ForegroundColor Cyan
    Write-Host "2. Deploy your application to Railway" -ForegroundColor White
    Write-Host "3. Test the /health endpoint" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "❌ Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "You can also run the migration manually:" -ForegroundColor Yellow
    Write-Host "1. Go to your Supabase SQL Editor" -ForegroundColor White
    Write-Host "2. Copy and paste the content from: supabase/migrations/001_complete_schema_setup.sql" -ForegroundColor White
    Write-Host "3. Run the SQL script" -ForegroundColor White
}

Write-Host ""
Read-Host "Press Enter to continue"
