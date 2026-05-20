# Mata processos node existentes e sobe tudo via pnpm dev (turbo)
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Set-Location $PSScriptRoot
pnpm dev
