#!/usr/bin/env bash
# =============================================================================
# capture.sh — App Store screenshots for Politick, without Xcode.
#
# frames.html lays out each screen at 428 × 926 CSS px. Rendered by headless
# Chrome at --force-device-scale-factor=3 that is exactly 1284 × 2778 — the
# 6.7" iPhone size.
#
# Not 6.9". App Store Connect rejects 1320 × 2868 with "Screenshots dimensions
# should be: 1242 × 2688px, 2688 × 1242px, 1284 × 2778px or 2778 × 1284px".
# Set CAPTURE_65=1 for the 6.5" size (1242 × 2688) instead.
#
# The alternative is xcrun simctl, which needs a full Xcode install. This does
# not, which is the entire reason it exists.
#
# Usage:  bash assets/screenshots/capture.sh
# Output: ~/Desktop/rotunda-screenshots/
# =============================================================================
set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"
PAGE="file://$HERE/frames.html"
# 6.7" by default; CAPTURE_65=1 renders the 6.5" size instead. Both are on
# App Store Connect's accepted list.
if [ "${CAPTURE_65:-0}" = "1" ]; then
  CSS_W=414; CSS_H=896; LABEL="1242x2688 (6.5\")"
else
  CSS_W=428; CSS_H=926; LABEL="1284x2778 (6.7\")"
fi
OUT="$HOME/Desktop/rotunda-screenshots"

if [ ! -x "$CHROME" ]; then
  echo "ERROR: Google Chrome not found at:"
  echo "  $CHROME"
  echo "Install Chrome, or point CHROME at another Chromium build."
  exit 1
fi

mkdir -p "$OUT"

# Names are numbered because App Store Connect orders screenshots by upload
# order, and the first two or three are the only ones seen in search results.
shoot () {
  local n="$1" name="$2"
  "$CHROME" \
    --headless \
    --disable-gpu \
    --hide-scrollbars \
    --force-device-scale-factor=3 \
    --window-size=$CSS_W,$CSS_H \
    --screenshot="$OUT/$n-$name.png" \
    "$PAGE?solo=$n" >/dev/null 2>&1
  local dims
  dims=$(sips -g pixelWidth -g pixelHeight "$OUT/$n-$name.png" 2>/dev/null \
          | awk '/pixel/{printf "%s ", $2}')
  echo "  $n-$name.png    ${dims}"
}

echo "==> Rendering at ${CSS_W}x${CSS_H} @3x -> $LABEL"
shoot 1 today
shoot 2 votes
shoot 3 election-center
shoot 4 what-the-office-does
shoot 5 sources

echo ""
echo "==> Saved to $OUT"
echo "    Upload in this order. Apple shows the first two or three in search."
