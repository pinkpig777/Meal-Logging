"""Write the OpenAPI schema to api/openapi.json (the frontend generates types from it).

Usage: cd api && uv run python scripts/export_openapi.py
"""

import json
import os
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))

# The schema does not depend on secrets or modes; use safe local defaults so this runs anywhere.
os.environ.setdefault("APP_ENV", "local")
os.environ.setdefault("LLM_MODE", "fixture")

from app.main import create_app  # noqa: E402


def main() -> None:
    schema = create_app().openapi()
    out = API_DIR / "openapi.json"
    out.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {out.relative_to(API_DIR.parent)} ({len(schema['paths'])} paths)")


if __name__ == "__main__":
    main()
