#!/usr/bin/env bash
# Regenerates every image in theme/ (dark), theme-light/ and newtab/icons/ from the HTML in this repo, using headless Chrome.
#   tools/render-assets.sh
# Needs Node and Google Chrome (set CHROME=/path/to/chrome to use another build).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$here")"
render() { node "$here/render.mjs" "$@" > /dev/null; }

for variant in dark light; do
  out="$root/theme"
  [ "$variant" = light ] && out="$root/theme-light"
  mkdir -p "$out/images" "$out/icons"

  # Browser chrome textures (tile horizontally).
  render "file://$here/theme-assets.html?asset=frame&scheme=$variant"   "$out/images/theme_frame.png"          --width 512 --height 80
  render "file://$here/theme-assets.html?asset=toolbar&scheme=$variant" "$out/images/theme_toolbar.png"        --width 256 --height 120
  render "file://$here/theme-assets.html?asset=tab&scheme=$variant"     "$out/images/theme_tab_background.png" --width 256 --height 64

  # The dark theme's New Tab image is the new-tab page itself with the clock hidden and everything frozen.
  # The light theme deliberately has none: with any background image Chrome draws its logo and shortcut labels in
  # white, which is unreadable on a pale image. Without one it honours the theme's dark ntp_text and colour logo.
  if [ "$variant" = dark ]; then
    render "file://$root/newtab/newtab.html?still=bg&scheme=$variant" "$out/images/theme_ntp_background.png" --width 2560 --height 1440 --wait 800
  fi

  for size in 16 32 48 128; do
    render "file://$here/icon.html?size=$size&scheme=$variant" "$out/icons/icon$size.png" --width "$size" --height "$size" --transparent --wait 200
  done
done

# The new-tab extension works in both schemes, so it carries the dark icon.
cp "$root"/theme/icons/icon*.png "$root/newtab/icons/"

echo "done"
