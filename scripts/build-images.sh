#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
source_dir="$repo_dir/photos/original"
output_dir="$repo_dir/photos/optimized"

for tool in cwebp ffmpeg sips; do
  command -v "$tool" >/dev/null || {
    echo "FAIL: required tool not found: $tool" >&2
    exit 1
  }
done

mkdir -p "$output_dir"

make_variant() {
  local source="$1"
  local stem="$2"
  local width="$3"
  local jpeg_quality="${4:-5}"
  local jpeg="$output_dir/${stem}-${width}.jpg"
  local webp="$output_dir/${stem}-${width}.webp"

  ffmpeg -hide_banner -loglevel error -y -i "$source" \
    -vf "scale='min(${width},iw)':-2:flags=lanczos" \
    -frames:v 1 -q:v "$jpeg_quality" -map_metadata -1 "$jpeg"
  cwebp -quiet -mt -m 6 -q 72 -resize "$width" 0 "$source" -o "$webp"
}

for source in "$source_dir"/*.jpg; do
  stem="$(basename "$source" .jpg)"
  make_variant "$source" "$stem" 480
  make_variant "$source" "$stem" 960
  make_variant "$source" "$stem" 1600
done

# A 1920px hero variant serves large, high-density viewports without making every
# gallery image carry that extra derivative.
make_variant "$source_dir/hero-lanai-lake.jpg" "hero-lanai-lake" 1920 8

echo "PASS: responsive JPEG and WebP variants generated in $output_dir"
