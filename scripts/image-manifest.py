#!/usr/bin/env python3
"""Print a machine-readable before/after image byte manifest."""

from __future__ import annotations

import json
from pathlib import Path


root = Path(__file__).resolve().parent.parent
original_dir = root / "photos" / "original"
optimized_dir = root / "photos" / "optimized"
images = []

for original in sorted(original_dir.glob("*.jpg")):
    stem = original.stem
    variants = {}
    for width in (480, 960, 1600):
        variants[str(width)] = {
            extension: (optimized_dir / f"{stem}-{width}.{extension}").stat().st_size
            for extension in ("jpg", "webp")
        }
    if stem == "hero-lanai-lake":
        variants["1920"] = {
            extension: (optimized_dir / f"{stem}-1920.{extension}").stat().st_size
            for extension in ("jpg", "webp")
        }
    images.append({
        "name": original.name,
        "before_original_jpeg_bytes": original.stat().st_size,
        "after_variant_bytes": variants,
    })

before_total = sum(item["before_original_jpeg_bytes"] for item in images)
optimized_total = sum(path.stat().st_size for path in optimized_dir.iterdir() if path.is_file())
manifest = {
    "ceilings_bytes": {"thumbnail_480": 120_000, "full_1600_or_1920": 400_000},
    "before_original_total_bytes": before_total,
    "generated_variant_total_bytes": optimized_total,
    "hero_before_bytes": next(item["before_original_jpeg_bytes"] for item in images if item["name"] == "hero-lanai-lake.jpg"),
    "hero_after_primary_1920_webp_bytes": (optimized_dir / "hero-lanai-lake-1920.webp").stat().st_size,
    "images": images,
}
print(json.dumps(manifest, indent=2, sort_keys=True))
