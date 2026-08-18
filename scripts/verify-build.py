#!/usr/bin/env python3
"""Deterministic compliance and asset gate for the Bellerive listing redesign."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"
ORIGINALS = ROOT / "photos" / "original"
OPTIMIZED = ROOT / "photos" / "optimized"
EMOJI = "🌊✨🏊📶🚪🔒⛳🧺🛡️✉️📍🏠📞"


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def normalized_text(node) -> str:
    text = node.get_text(" ", strip=True)
    for glyph in EMOJI:
        text = text.replace(glyph, "")
    text = text.replace("️", "")
    return re.sub(r"\s+", " ", text).strip()


current_source = HTML.read_text(encoding="utf-8")
baseline_source = subprocess.check_output(
    ["git", "show", "main:index.html"], cwd=ROOT, text=True
)
current = BeautifulSoup(current_source, "html.parser")
baseline = BeautifulSoup(baseline_source, "html.parser")

# Exact section-level text equality covers all terms, fees, approval language,
# agent contacts, MLS details, fair-housing copy, and listing disclaimers.
for selector in ("#included", "#details", "#terms", "#contact", "footer"):
    before = baseline.select_one(selector)
    after = current.select_one(selector)
    if before is None or after is None:
        fail(f"missing protected selector {selector}")
    if normalized_text(before) != normalized_text(after):
        print(f"PROTECTED TEXT DIFF: {selector}")
        print(f"BEFORE: {normalized_text(before)}")
        print(f"AFTER:  {normalized_text(after)}")
        raise SystemExit(1)
    print(f"PASS: protected visible text unchanged for {selector}")

for required in (
    "MLS# 226029254",
    "DeShawn Robinson",
    "Aimee Rodriguez",
    "All information contained herein is deemed reliable but is not guaranteed",
    "This property is offered for lease without regard to race, color, religion, sex, handicap, familial status, national origin, or any other protected class.",
    'Any photograph labeled "Virtually Staged" depicts digitally added furnishings for illustration only',
):
    if required not in normalized_text(current):
        fail(f"required frozen text missing: {required}")
print("PASS: named frozen content present")

originals = sorted(ORIGINALS.glob("*.jpg"))
if len(originals) != 15:
    fail(f"expected 15 retained originals, found {len(originals)}")
print("PASS: 15 original JPEGs retained")

for original in originals:
    stem = original.stem
    for width in (480, 960, 1600):
        for extension in ("jpg", "webp"):
            candidate = OPTIMIZED / f"{stem}-{width}.{extension}"
            if not candidate.is_file():
                fail(f"missing derivative {candidate.relative_to(ROOT)}")
            ceiling = 120_000 if width == 480 else 400_000
            if candidate.stat().st_size > ceiling:
                fail(f"{candidate.name} is {candidate.stat().st_size} bytes, ceiling {ceiling}")
for extension in ("jpg", "webp"):
    hero = OPTIMIZED / f"hero-lanai-lake-1920.{extension}"
    if not hero.is_file() or hero.stat().st_size > 400_000:
        fail(f"hero 1920 {extension} missing or over 400KB")
print("PASS: responsive JPEG/WebP derivatives meet 120KB thumbnail and 400KB full ceilings")

gallery_images = current.select("#gallery img")
if len(gallery_images) != 15:
    fail(f"expected 15 gallery images, found {len(gallery_images)}")
for image in gallery_images:
    for attr in ("width", "height", "loading", "srcset", "sizes", "alt"):
        if not image.get(attr):
            fail(f"gallery image missing {attr}: {image}")
    if image["loading"] != "lazy":
        fail("below-fold gallery image is not lazy loaded")
hero_image = current.select_one("#hero img")
if hero_image is None or hero_image.get("loading") == "lazy" or hero_image.get("fetchpriority") != "high":
    fail("hero must be eager/high priority")
if current.select_one('link[rel="preload"][as="image"]') is None:
    fail("hero image preload missing")
print("PASS: image loading priority, responsive sources, dimensions, and alt text")

if any(glyph in current_source for glyph in ("🌊", "✨", "🏊", "📶", "🚪", "🔒", "⛳", "🧺", "🛡", "✉", "📍", "🏠", "📞")):
    fail("emoji icon remains in source")
if len(current.find_all("h1")) != 1:
    fail("document must contain exactly one h1")
if current.select_one("#stickyCta") is None or "prefers-reduced-motion" not in (ROOT / "assets/site.css").read_text():
    fail("sticky CTA or reduced-motion gate missing")
if "IntersectionObserver" not in (ROOT / "assets/site.js").read_text():
    fail("IntersectionObserver implementation missing")
if "YOUR_FORM_ID" not in current_source or "YOUR_PLAUSIBLE_DOMAIN" not in current_source:
    fail("integration placeholders missing")
print("PASS: SVG icon, semantic h1, sticky CTA, motion, and placeholder integration gates")
print("VERDICT: PASS")
