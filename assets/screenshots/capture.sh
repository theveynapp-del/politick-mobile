#!/usr/bin/env bash
# =============================================================================
# capture.sh — App Store screenshots for Politick, without Xcode.
#
# frames.html lays out each screen at 440 × 956 CSS px. Rendered by headless
# Chrome at --force-device-scale-factor=3 that is exactly 1320 × 2868, which is
# Apple's 6.9" iPhone size. Every smaller size is scaled down from it, so this
# one set covers the whole iPhone range.
#
# The alternative is xcrun simctl, which needs a full Xcode install. This does
# not, which is the entire reason it exists.
#
# Usage:  bash assets/screenshots/capture.sh
# Output: ~/Desktop/politick-screenshots/
# =============================================================================
set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"
PAGE="file://$HERE/frames.html"
OUT="$HOME/Desktop/politick-screenshots"

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
    --window-size=440,956 \
    --screenshot="$OUT/$n-$name.png" \
    "$PAGE?solo=$n" >/dev/null 2>&1
  local dims
  dims=$(sips -g pixelWidth -g pixelHeight "$OUT/$n-$name.png" 2>/dev/null \
          | awk '/pixel/{printf "%s ", $2}')
  echo "  $n-$name.png    ${dims}"
}

echo "==> Rendering at 440x956 @3x -> 1320x2868"
shoot 1 today
shoot 2 votes
shoot 3 election-center
shoot 4 what-the-office-does
shoot 5 sources

echo ""
echo "==> Saved to $OUT"
echo "    Upload in this order. Apple shows the first two or three in search."
