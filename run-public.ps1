# Launch all UpdatePilot services + Cloudflare Public HTTPS Tunnel
# Zero credit card, zero cloud configuration, 100% free

$rootDir = $PSScriptRoot
if (-not $rootDir) { $rootDir = "D:\projects\UpdatePilot_Project" }

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Starting UpdatePilot with Public Cloudflare Tunnel   " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Start Server
Write-Host "1/4 Launching UpdatePilot Server (Port 4000)..." -ForegroundColor Green
Start-Process powershell -WorkingDirectory $rootDir -ArgumentList "-NoExit", "-Command", "Write-Host '=== UpdatePilot Server ===' -ForegroundColor Green; npm run dev:server"

# Wait for API server to bind to port 4000
Start-Sleep -Seconds 4

# 2. Start Web Dashboard
Write-Host "2/4 Launching Web Dashboard (Port 3000)..." -ForegroundColor Blue
Start-Process powershell -WorkingDirectory $rootDir -ArgumentList "-NoExit", "-Command", "Write-Host '=== UpdatePilot Web Dashboard ===' -ForegroundColor Blue; npm run dev:web"

Start-Sleep -Seconds 3

# 3. Start Windows Agent
Write-Host "3/4 Launching Windows Host Agent..." -ForegroundColor Yellow
Start-Process powershell -WorkingDirectory $rootDir -ArgumentList "-NoExit", "-Command", "Write-Host '=== UpdatePilot Windows Agent ===' -ForegroundColor Yellow; npm run dev:agent"

Start-Sleep -Seconds 2

# 4. Start Cloudflare Tunnel for live public HTTPS URL
Write-Host "4/4 Launching Cloudflare Public HTTPS Tunnel..." -ForegroundColor Magenta
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
if (-not (Test-Path $cloudflared)) {
    $cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
}

if ($cloudflared -and (Test-Path $cloudflared)) {
    Start-Process powershell -WorkingDirectory $rootDir -ArgumentList "-NoExit", "-Command", "Write-Host '=== UpdatePilot Cloudflare Public Tunnel ===' -ForegroundColor Magenta; do { Write-Host 'Connecting to Cloudflare edge network... Requesting your public https://...trycloudflare.com link...' -ForegroundColor Yellow; & '$cloudflared' tunnel --url http://localhost:3000; Write-Host 'Cloudflare connection timed out or closed. Retrying in 3 seconds...' -ForegroundColor Red; Start-Sleep -Seconds 3 } while (`$true)"
} else {
    Write-Host "Could not find cloudflared.exe. Please install via: winget install --id Cloudflare.cloudflared" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "   All 4 services launched in separate windows!         " -ForegroundColor Green
Write-Host "   Check the Magenta window for your live HTTPS link.   " -ForegroundColor Green
Write-Host "   Login Password: adminpassword123                    " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green
