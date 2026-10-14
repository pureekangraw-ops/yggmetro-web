#!/usr/bin/env python3
"""Validate public storefront image assets stored in GitHub."""
from pathlib import Path
import json, struct, sys

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets" / "shop"
MANIFEST = ASSETS / "manifest.json"
MAX_BYTES = 8 * 1024 * 1024

def main():
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert isinstance(data.get("assets"), list), "assets must be a list"
    seen = set()
    for item in data["assets"]:
        name = item["file"]
        assert name == Path(name).name and name not in seen, "invalid or duplicate filename"
        seen.add(name)
        assert name.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".svg")), "unsupported extension"
        file = ASSETS / name
        assert file.is_file(), f"missing image: {name}"
        assert 0 < file.stat().st_size <= MAX_BYTES, f"invalid size: {name}"
        blob = file.read_bytes()
        if name.lower().endswith(".png"):
            assert blob[:8] == b"\x89PNG\r\n\x1a\n", f"invalid PNG: {name}"
            w, h = struct.unpack(">II", blob[16:24])
            assert 1 <= w <= 8192 and 1 <= h <= 8192, f"invalid dimensions: {name}"
        elif name.lower().endswith((".jpg", ".jpeg")):
            assert blob.startswith(b"\xff\xd8\xff"), f"invalid JPEG: {name}"
        elif name.lower().endswith(".webp"):
            assert blob.startswith(b"RIFF") and blob[8:12] == b"WEBP", f"invalid WebP: {name}"
        elif name.lower().endswith(".svg"):
            assert b"<svg" in blob[:2048] and b"<script" not in blob.lower(), f"unsafe SVG: {name}"
    print(f"Validated {len(seen)} GitHub-first shop images")

if __name__ == "__main__":
    try:
        main()
    except (AssertionError, KeyError, OSError, ValueError) as e:
        print(f"Asset validation failed: {e}", file=sys.stderr)
        sys.exit(1)
