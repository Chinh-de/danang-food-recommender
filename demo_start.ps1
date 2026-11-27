# Tạo lại database demo sạch (data/foodgo_demo.db) rồi chạy backend. Không đụng data/foodgo.db.
# Chạy trong thư mục foodgo:   .\demo_start.ps1
# Giữ nguyên dữ liệu đang có:  .\demo_start.ps1 -GiuDuLieu
param([switch]$GiuDuLieu)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "Cổng 8000 đang có backend chạy. Tắt nó trước (Ctrl+C ở cửa sổ đang chạy), rồi chạy lại." -ForegroundColor Yellow
  exit 1
}
$env:FOODGO_DB = Join-Path $PSScriptRoot "data\foodgo_demo.db"
$env:PYTHONIOENCODING = "utf-8"
Push-Location (Join-Path $PSScriptRoot "backend")
try {
  if (-not $GiuDuLieu -or -not (Test-Path $env:FOODGO_DB)) {
    uv run scripts/prepare_data.py
    if ($LASTEXITCODE -ne 0) { exit 1 }
  }
  uv run uvicorn app.main:app --port 8000
} finally { Pop-Location }
