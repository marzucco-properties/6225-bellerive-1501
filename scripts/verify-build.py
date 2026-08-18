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
# MLS details, fair-housing copy, virtual-staging language, and disclaimers.
# The contact layout intentionally adds brand/identity text, so its protected
# facts are verified individually below instead of requiring byte equality.
for selector in ("#included", "#details", "#terms", "footer"):
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

required_categories = {
    "lease terms": ("$3,100 Per Month", "$2,500 Security Deposit", "60 Day Minimum Lease", "2 Max Leases Per Year"),
    "fee disclosures": ("$50 rental office application fee", "$25 credit application fee", "$50 per applicant", "$250 departure/cleaning fee"),
    "association approval": ("Association approval is mandatory", "approval period runs approximately 20 days"),
    "fair housing / equal housing opportunity": ("This property is offered for lease without regard to race, color, religion, sex, handicap, familial status, national origin, or any other protected class.", "Equal Housing Opportunity."),
    "virtual staging": ('Any photograph labeled "Virtually Staged" depicts digitally added furnishings for illustration only',),
    "deemed-reliable disclaimer": ("All information contained herein is deemed reliable but is not guaranteed",),
    "listing agents": ("DeShawn Robinson", "Aimee Rodriguez", "(239) 776-5194", "(239) 238-6358", "dluxnaples@gmail.com"),
    "MLS number": ("MLS# 226029254",),
}
all_text = normalized_text(current)
for category, required_strings in required_categories.items():
    for required in required_strings:
        if required not in all_text:
            fail(f"{category} content missing: {required}")
    print(f"PASS: {category}")
print("PASS: disclosure/contact fact matrix complete")

portrait = current.select_one(".agent-portrait")
if portrait is None or portrait.get("src") != "assets/brand/deshawn-headshot-beach-352x394.png":
    fail("DeShawn portrait asset missing")
if portrait.get("width") != "352" or portrait.get("height") != "394" or not portrait.get("alt"):
    fail("DeShawn portrait dimensions or alt text missing")
if "BK3335121" not in all_text:
    fail("DeShawn broker license missing")
if len(current.select(".brand img, .footer-logo")) != 2:
    fail("official Marzucco wordmark must appear in navigation and footer")
print("PASS: portrait identity, license, alt text, and two official wordmarks")

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
feedback_form = current.select_one("#feedbackForm")
feedback_submit = current.select_one('#feedbackForm button[type="submit"]')
if feedback_form is None or feedback_form.has_attr("action"):
    fail("feedback form must be handled by first-party JavaScript")
if feedback_submit is None or feedback_submit.has_attr("disabled"):
    fail("feedback form submit must be enabled")
site_js = (ROOT / "assets/site.js").read_text()
if "mailto:dluxnaples@gmail.com" not in site_js or "r.aimee%40ymail.com" not in site_js:
    fail("feedback form mail composer is missing listing-agent recipients")
if "plausible" in current_source.lower() or "formspree" in current_source.lower():
    fail("third-party analytics/form dependency remains")
if 'data-analytics-event="gallery_open"' not in current_source or 'data-analytics-scroll-event="scroll_75"' not in current_source:
    fail("first-party gallery/scroll analytics hooks missing")
print("PASS: SVG icon, semantic h1, sticky CTA, motion, and first-party email-composer gates")
print("VERDICT: PASS")
