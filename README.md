# In Time — Chrome themes (dark + light) and an animated new tab

Two Chrome themes — **dark** and **light** — and a new-tab page with a glowing **countdown to your next birthday** that
drains one second at a time, inspired by the forearm clocks in the film *In Time*.

Chrome themes can only hold colours and static images (no JavaScript, no animation, no automatic light/dark switching),
so this is three small packages:

| Folder | What it is | What it does |
| --- | --- | --- |
| `theme/` | The **dark** theme, "In Time — Dark" | Black-green night: frame, tabs, toolbar and omnibox, plus a skyline behind Chrome's own New Tab page. |
| `theme-light/` | The **light** theme, "In Time — Light" | Sun-bleached porcelain and pale mint with jade accents. |
| `newtab/` | An extension that replaces the New Tab page | The animated clock, in dark or light. Asks for your birthday once. |

Chrome wears one theme at a time, so load **one** of `theme/` or `theme-light/`.

## Install locally (about a minute)

1. Open `chrome://extensions` and switch on **Developer mode** (top right).
2. **Load unpacked** → pick `theme` (dark) **or** `theme-light` (light). The browser changes colour.
3. **Load unpacked** again → pick `newtab`.
4. Open a new tab and enter your date of birth.

To switch themes later, load the other folder (it replaces the first; remove the unused one from `chrome://extensions`).
*Settings → Appearance → Reset to default* removes whichever theme is active; removing the extension brings back Chrome's
own New Tab page. If you update these files, press the reload arrow on the extension's card.

The extension replaces Chrome's New Tab page, so the Google search box and shortcut tiles are gone from it. The address bar
still does everything. If your Chrome is managed and blocks *Load unpacked*, `newtab/newtab.html` also works as a plain page
from disk — set `file:///…/newtab/newtab.html` as your home page.

## Privacy

The birth date you enter and your light/dark choice are stored in the extension's `localStorage` on your device. Nothing is
sent anywhere: no network requests, no analytics, no permissions. The full policy is `newtab/privacy.html`; it ships inside the
extension (**Settings → Privacy policy**), and `node tools/pack.mjs` copies it to `dist/privacy-policy.html` for hosting.

## Publishing to the Chrome Web Store

```sh
node tools/pack.mjs        # checks the packages, then writes dist/in-time-*.zip and dist/privacy-policy.html
tools/render-store.sh      # (re)generates the screenshots and promo tiles in store/
```

`pack.mjs` builds one ZIP per package, each with `manifest.json` at its root, which is what the store wants (not a `.crx`:
Google signs the package itself). It refuses to build if a manifest breaks the store's limits (name ≤ 75 characters,
description ≤ 132, icons that exist at their real pixel sizes, referenced files present, no inline scripts) or if the privacy page
is missing, and it leaves out stray files such as Chrome's `Cached Theme.pak`.

`store/listing.md` has the text for every dashboard field (including the privacy answers, reviewer instructions and how to host the
policy), and `store/` holds the screenshots and 440×280 promo tiles. The two theme listings need screenshots of the real browser
wearing the theme; `store/listing.md` shows how to take them.

**The name.** "In Time" is also a film title. The store forbids implying affiliation with someone else's brand and can reduce the
visibility of items it thinks infringe, so the listings use no film art, characters, quotes or locations and end with a "not
affiliated" line. If the store flags the name, change `name` in the three manifests and upload again.

To release an update: raise `version` in the package's `manifest.json`, run `node tools/pack.mjs`, and upload the new ZIP in the
dashboard's Package tab.

## Light, dark, or automatic

The new-tab page has its own **Appearance** setting (*Settings*, bottom right): **Auto** follows your system's light/dark
setting live, **Dark** and **Light** force one. A theme can't follow the system, so to keep the two matching either pick
the same on both, or leave the page on Auto and load the theme that suits how you usually run your system.

Light isn't an inverted dark. Dark adds light: grains and ring are drawn with additive blending and the digits glow. A pale
sky can't be brightened, so light paints the same shapes as deep-green ink with ordinary blending, the glow becomes a tinted
bloom, new digits arrive as dark wet ink and dry to jade (dark: white-hot, cooling to green), and the skyline turns to sage
and white glints.

The light theme has **no New Tab image on purpose**. When a theme has one, Chrome draws its logo and shortcut labels in
white — perfect over the dark skyline, unreadable over a pale one. Without an image, Chrome keeps its colour logo and uses
the theme's dark text.

## The clock

- `YY : MM : DD : HH : MM : SS` until **midnight at the start of your next birthday**, in your local time. It never holds
  more than a year, like the one year the film hands you at 25.
- On your birthday it reads `01:00:00:00:00:00` and says **Time granted**; grains of time rise into the clock instead of
  falling out of it. If the tab is open at midnight you watch the year land.
- Every second the old digit un-draws along its stroke and sheds grains that fall; the new digit draws on and settles. Bigger
  units shed more, so a new minute, hour or day is felt. The ring behind the clock steps a tick per second with a fading
  beam, and every so often the readout slips in a short signal tear.
- Feb 29 birthdays are celebrated on Mar 1 in common years.
- Your birth date is kept in this extension's `localStorage` and never leaves your machine. *Settings* edits it.
- `prefers-reduced-motion` turns off the grains, glitch and easing.

## Files

```
theme/                  dark theme:  manifest.json + images/ (frame, toolbar, tab and New Tab skyline) + icons/
theme-light/            light theme: manifest.json + images/ (frame, toolbar, tab) + icons/
newtab/
  manifest.json         overrides the new tab page, asks for no permissions
  newtab.html/.css/.js  the page: skyline, clock, settings card, animation loop
  privacy.html          the privacy policy (self-contained; linked from Settings, and hosted from dist/)
  scheme.js             picks light or dark before first paint, so there is no flash of the wrong palette
  core.js               countdown maths (pure, unit-tested)
  glyphs.js             the chamfered single-stroke digits
  fx.js                 canvas layers: the ring, and the falling / rising grains (one palette per scheme)
tools/
  pack.mjs              validates the packages and builds the Web Store ZIPs into dist/
  render.mjs            dependency-free page -> PNG with headless Chrome (DevTools protocol)
  render-assets.sh      regenerates every PNG in theme/, theme-light/ and newtab/icons/
  render-store.sh       regenerates the store screenshots and promo tiles in store/
  theme-assets.html     the frame / toolbar / tab textures      icon.html   the icon      store-tile.html   the promo tiles
  test-core.js          date-maths checks
store/                  listing.md (dashboard copy) and the listing images
dist/                   the ZIPs to upload and the privacy page to host (generated by tools/pack.mjs)
```

Chrome writes a `Cached Theme.pak` next to a theme's manifest when it applies it. It's a regenerable cache and safe to delete;
the packer never includes it.

## Debugging the page

Open `newtab/newtab.html` directly and add query parameters:

| Parameter | Effect |
| --- | --- |
| `?dob=1990-10-21` | Use this birthday without saving it |
| `?now=2026-10-20T23:59:57` | Pretend it is this local time (the clock keeps running from there) |
| `?scheme=light` or `dark` | Force a colour scheme without saving it |
| `?calm` | Behave as if `prefers-reduced-motion` were on |
| `?still=bg` | Backdrop only, frozen — the dark theme's New Tab image and the store tiles come from this |
| `?nograin` | With `?still=bg`, leave out the film grain |
| `?debug` | Exposes `window.__intime` (`glitch()`, `grant()`, `fx`) |

## Regenerating the images

```sh
tools/render-assets.sh      # theme textures, New Tab image, icons   (needs Node 22+ and Google Chrome)
tools/render-store.sh       # store screenshots and promo tiles
```

## Tests

The countdown is calendar maths in local time, so run the checks under a few zones (DST, half-hour DST, odd offsets):

```sh
for tz in UTC America/New_York Europe/London Asia/Kolkata Asia/Kathmandu Pacific/Auckland Australia/Lord_Howe; do
  TZ=$tz node tools/test-core.js
done
```

They sweep the readout second by second across month ends, leap days, year end, DST changes and every birthday rollover,
and require it to strictly decrease. Counting months forwards from now fails this at month ends (Jan 31 + 1 month = Feb 28
makes the clock jump *up* by a day), so `core.js` counts backwards from the target instead.
