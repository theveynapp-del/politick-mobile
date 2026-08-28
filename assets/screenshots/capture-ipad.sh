#!/usr/bin/env bash
# =============================================================================
# capture-ipad.sh — 13" iPad App Store screenshots for Politick.
#
# 1032 × 1376 CSS px at --force-device-scale-factor=2 is 2064 × 2752, the size
# App Store Connect requires when an app runs on iPad.
#
# Only needed if the app declares iPad support. Build 16 sets
# supportsTablet: false, so once that build is processed the iPad screenshot
# slot should disappear and these become unnecessary. They exist so a stale
# app record can't block a submission.
#
# What these show is the phone layout at tablet width, because that is what
# the app actually renders — there is no iPad design. That is the honest
# screenshot, and it is also the argument for shipping iPhone-only.
#
# Usage:  bash assets/screenshots/capture-ipad.sh
# Output: ~/Desktop/politick-screenshots-ipad/
# =============================================================================
set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"
PAGE="file://$HERE/frames.html"
OUT="$HOME/Desktop/politick-screenshots-ipad"

if [ ! -x "$CHROME" ]; then
  echo "ERROR: Google Chrome not found at:"
  echo "  $CHROME"
  exit 1
fi

mkdir -p "$OUT"

shoot () {
  local n="$1" name="$2"
  "$CHROME" \
    --headless \
    --disable-gpu \
    --hide-scrollbars \
    --force-device-scale-factor=2 \
    --window-size=1032,1376 \
    --screenshot="$OUT/$n-$name.png" \
    "$PAGE?ipad=1&solo=$n" >/dev/null 2>&1
  local dims
  dims=$(sips -g pixelWidth -g pixelHeight "$OUT/$n-$name.png" 2>/dev/null \
          | awk '/pixel/{printf "%s ", $2}')
  echo "  $n-$name.png    ${dims}"
}

echo "==> Rendering at 1032x1376 @2x -> 2064x2752 (13\" iPad)"
shoot 1 today
shoot 2 votes
shoot 3 election-center
shoot 4 what-the-office-does
shoot 5 sources

echo ""
echo "==> Saved to $OUT"
