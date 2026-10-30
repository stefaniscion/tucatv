#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"
npm ci
npm run build
python3 -m venv .desktop-venv
.desktop-venv/bin/pip install -r desktop/requirements.txt
.desktop-venv/bin/pyinstaller --noconfirm --clean --name tucatv --windowed --add-data "$repo/dist:web" --distpath "$repo/desktop-output" --workpath "$repo/desktop-work" --specpath "$repo/desktop-work" desktop/main.py
python3 desktop/package-linux.py desktop-output/tucatv desktop-output
