# PowerShell script to create Netlify deployment package
# Marketing with Doro - Meta App Review Website

Write-Host "Creating Netlify deployment package..." -ForegroundColor Green

# Create deployment directory
$deployDir = "netlify-deployment"
if (Test-Path $deployDir) {
    Remove-Item $deployDir -Recurse -Force
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

# Copy all website files
Write-Host "Copying website files..." -ForegroundColor Yellow
Copy-Item "website\*" -Destination $deployDir -Recurse

# Create zip file
$zipPath = "marketing-with-doro-website.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Write-Host "Creating zip package..." -ForegroundColor Yellow
Compress-Archive -Path "$deployDir\*" -DestinationPath $zipPath -Force

# Cleanup
Remove-Item $deployDir -Recurse -Force

Write-Host "Deployment package created: $zipPath" -ForegroundColor Green
Write-Host ""
Write-Host "Package Contents:" -ForegroundColor Cyan
Write-Host "  - index.html (Homepage)" -ForegroundColor White
Write-Host "  - privacy.html (Privacy Policy - Meta required)" -ForegroundColor White
Write-Host "  - terms.html (Terms of Service - Meta required)" -ForegroundColor White
Write-Host "  - styles.css (Stylesheet)" -ForegroundColor White
Write-Host "  - app-icon.svg (1024x1024 Meta app icon)" -ForegroundColor White
Write-Host "  - contact-photo.svg (Contact image)" -ForegroundColor White
Write-Host "  - _redirects (Netlify routing)" -ForegroundColor White
Write-Host "  - netlify.toml (Netlify configuration)" -ForegroundColor White
Write-Host ""
Write-Host "Ready for Netlify deployment!" -ForegroundColor Green
