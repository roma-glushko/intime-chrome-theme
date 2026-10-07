#!/usr/bin/env bash
# Regenerates the Chrome Web Store listing images into store/ from the new-tab page itself, using headless Chrome.
#   tools/render-store.sh
#   - store/extension/screenshot-*.png   1280x800 screenshots of the new-tab page (the store wants 1-5)
#   - store/*/small-tile.png             440x280 promo tiles (mandatory), one per listing
# The two theme listings also need screenshots of the real browser wearing the theme; see store/listing.md.
# Needs Node and Google Chrome (set CHROME=/path/to/chrome to use another build).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$here")"
render() { node "$here/render.mjs" "$@" > /dev/null; }

page="file://$root/newtab/newtab.html"
tile="file://$here/store-tile.html"
mkdir -p "$root/store/extension" "$root/store/theme-dark" "$root/store/theme-light"

# A fixed birthday and clock so the screenshots read the same every time.
sample="dob=1990-10-21&now=2026-10-07T15:30:00"
shot=(--width 1280 --height 800)

render "$page?scheme=dark&$sample"  "$root/store/extension/screenshot-1-dark.png"  "${shot[@]}" --wait 2600
render "$page?scheme=light&$sample" "$root/store/extension/screenshot-2-light.png" "${shot[@]}" --wait 2600
# Two seconds before midnight on the birthday: the clock is granted a fresh year ("01:00:00:00:00:00") and flashes.
render "$page?scheme=dark&dob=1990-10-21&now=2026-10-20T23:59:59" "$root/store/extension/screenshot-3-birthday.png" "${shot[@]}" --wait 1400
render "$page?scheme=light&$sample" "$root/store/extension/screenshot-4-settings.png" "${shot[@]}" --wait 2200 \
  --eval "document.getElementById('edit').click()"

tilesize=(--width 440 --height 280 --wait 1800)
render "$tile?scheme=split" "$root/store/extension/small-tile.png"   "${tilesize[@]}"
render "$tile?scheme=dark"  "$root/store/theme-dark/small-tile.png"  "${tilesize[@]}"
render "$tile?scheme=light" "$root/store/theme-light/small-tile.png" "${tilesize[@]}"

echo "done"
