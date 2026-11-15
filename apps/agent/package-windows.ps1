$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$bundle = Join-Path $PSScriptRoot 'dist/windows'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '.env.example') -Destination (Join-Path $bundle 'agent.env.example')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'PACKAGE-README.txt') -Destination (Join-Path $bundle 'README.txt')
$dotenvPackage = node -p "require.resolve('dotenv/package.json')"
if ($LASTEXITCODE -ne 0) { throw 'Could not locate the bundled dotenv license.' }
Copy-Item -LiteralPath (Join-Path (Split-Path $dotenvPackage) 'LICENSE') -Destination (Join-Path $bundle 'dotenv-LICENSE.txt')
$files = @('updatepilot-agent.cjs', 'agent.env.example', 'README.txt', 'dotenv-LICENSE.txt') | ForEach-Object { Join-Path $bundle $_ }
Compress-Archive -LiteralPath $files -DestinationPath (Join-Path $PSScriptRoot 'dist/UpdatePilot-Windows-Agent.zip') -Force
