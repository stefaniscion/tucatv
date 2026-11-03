"""Copy the current web build into the local desktop host."""

from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
source, target = root / "dist", root / "desktop/web"
if not (source / "index.html").is_file():
    raise SystemExit("Run npm run build first.")
if target.exists():
    shutil.rmtree(target)
shutil.copytree(source, target)
print("Desktop web assets prepared.")
