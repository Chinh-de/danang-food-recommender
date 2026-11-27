#!/usr/bin/env bash
# Tạo lại database demo sạch (data/foodgo_demo.db) rồi chạy backend. Không đụng data/foodgo.db.
# Chạy:                ./demo_start.sh      (hoặc: bash demo_start.sh)
# Giữ dữ liệu đang có: ./demo_start.sh --giu-du-lieu
set -euo pipefail

keep=0
case "${1:-}" in
  "") ;;
  --giu-du-lieu) keep=1 ;;
  *) echo "Tham số không hợp lệ: $1 (chỉ nhận --giu-du-lieu)" >&2; exit 2 ;;
esac

if (exec 3<>/dev/tcp/127.0.0.1/8000) 2>/dev/null; then
  echo "Cổng 8000 đang có backend chạy. Tắt nó trước (Ctrl+C ở cửa sổ đang chạy), rồi chạy lại." >&2
  exit 1
fi

cd "$(dirname "$0")/backend"
# đường dẫn tương đối so với backend/: dùng được cả trên Linux, macOS và Git Bash (Windows)
export FOODGO_DB="../data/foodgo_demo.db"
export PYTHONIOENCODING=utf-8

if [ "$keep" -eq 0 ] || [ ! -f "$FOODGO_DB" ]; then
  uv run scripts/prepare_data.py
fi
exec uv run uvicorn app.main:app --port 8000
