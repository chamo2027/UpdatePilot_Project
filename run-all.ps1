# Launch all 3 UpdatePilot processes in separate windows

$rootDir = $PSScriptRoot
if (-not $rootDir) { $rootDir = "D:\projects\UpdatePilot_Project" }

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Starting UpdatePilot Services...      " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Start Server
Write-Host "Launching Server on port 4000..." -ForegroundColor Green
Start-Process powershell -WorkingDirectory $rootDir -ArgumentList "-NoExit", "-Command", "Write-Host '=== UpdatePilot Server ===' -ForegroundColor Green; npm run dev:server"

# Wait for the API server to compile and bind to port 4000
Start-Sleep -Seconds 5

# 2. Start Web Dashboard
Write-Host "Launching Web Dashboard on port 3000..." -ForegroundColor Blue
Start-Process powershell -WorkingDirectory $rootDir -ArgumentList "-NoExit", "-Command", "Write-Host '=== UpdatePilot Web Dashboard ===' -ForegroundColor Blue; npm run dev:web"

Start-Sleep -Seconds 2

# 3. Start Agent
Write-Host "Launching Windows Host Agent..." -ForegroundColor Yellow
Start-Process powershell -WorkingDirectory $rootDir -ArgumentList "-NoExit", "-Command", "Write-Host '=== UpdatePilot Windows Agent ===' -ForegroundColor Yellow; npm run dev:agent"

Write-Host ""
Write-Host "All components have been launched in separate terminal windows." -ForegroundColor Green
Write-Host "Local URL:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Public URL: https://chains-accommodate-rely-earrings.trycloudflare.com" -ForegroundColor Magenta
Write-Host "Password:   adminpassword123" -ForegroundColor Yellow
