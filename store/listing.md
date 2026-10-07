# Chrome Web Store listing copy

Three separate listings, one per ZIP in `dist/` (build them with `node tools/pack.mjs`). In the
[Developer Dashboard](https://chrome.google.com/webstore/devconsole) choose **Add new item**, upload the ZIP, then fill in the
tabs below. Listing images are in `store/` (rebuild them with `tools/render-store.sh`).

> **About the name.** "In Time" is also the title of a film. The Web Store's policy says not to "represent that your product is
> authorized by, endorsed by, or produced by another company or organization", and warns that an item's visibility can be reduced
> if it may infringe someone's IP. Keeping the name is a risk you've chosen to take. What lowers it: the listings use no film art,
> characters, quotes or locations, and every description ends with a "not affiliated" line. If the store flags the name, change
> `name` in the three manifests, run `node tools/pack.mjs` and upload again.

Before you start: register at the Developer Dashboard (one-time fee, about US$5; check the dashboard for the current amount) and turn
on 2-Step Verification, which the store requires before you can publish. The dashboard may also ask you to declare trader /
non-trader status for EU listings; answer honestly for your situation. The "two published extensions" cap on new publishers does
not apply to themes, so all three can go up.

---

## 1. In Time — Birthday Countdown New Tab

ZIP: `dist/in-time-newtab-<version>.zip`

**Store listing**

| Field | Value |
| --- | --- |
| Summary | taken from the manifest: *A glowing countdown to your next birthday, drained one second at a time. Replaces the New Tab page; dark or light.* |
| Category | Productivity (Fun also fits) |
| Language | English |
| Screenshots | `store/extension/screenshot-1-dark.png`, `-2-light.png`, `-3-birthday.png`, `-4-settings.png` (1280×800) |
| Small promo tile | `store/extension/small-tile.png` (440×280) |
| Store icon | comes from the package (`icons/icon128.png`, 96 px of art with 16 px padding) |
| Support URL | fill this in: the privacy policy sends people to the listing's Support link. The repository's Issues page works: `https://github.com/roma-glushko/intime-chrome-theme/issues` |
| Promo video | optional; leave blank |

Detailed description:

```text
Turn every new tab into a glowing countdown to your next birthday.

Enter your date of birth once. The clock counts down — years, months, days, hours, minutes and seconds — to midnight at the start of your next birthday. Every second the old digit drains away along its stroke, shedding grains of time that fall, while the new digit draws itself on. On your birthday the clock is topped up with a fresh year.

• Light, dark or automatic: follows your system, or choose in Settings
• A ring that ticks once a second, a slow-moving skyline, and an occasional glitch
• Gentle on motion: honours your system's reduced-motion setting
• Private by design: your birth date stays in your browser. No accounts, no analytics, no network requests, no permissions. The privacy policy is linked from Settings.

Pairs with the free In Time — Dark and In Time — Light themes for a matching browser.

Note: this extension replaces Chrome's New Tab page, so the Google search box and shortcut tiles are not shown on it. The address bar works as usual.

Inspired by the film In Time. Not affiliated with, or endorsed by, its makers.
```

**Privacy practices**

| Field | Answer |
| --- | --- |
| Single purpose | Replaces the New Tab page with a countdown clock to the user's next birthday. |
| Permission justification | None needed: the extension requests no permissions. |
| Remote code | No, I am not using remote code. |
| Data usage | Tick **Personally identifiable information**: the date of birth the user types in. It is stored only in the browser's local storage and never transmitted. Then certify the three Limited Use statements (no selling or transferring, nothing unrelated to the single purpose, nothing for creditworthiness). |
| Privacy policy URL | `https://github.com/roma-glushko/intime-chrome-theme/blob/main/privacy.md` (see below) |

**Distribution**: free; all regions. Start with **Unlisted** if you want to share a link and check the listing page first, then
switch to **Public**.

**Test instructions** (for the reviewer): *No account or setup needed. Open a new tab, enter any date of birth and press Start
clock. "Settings" at the bottom right changes the date, switches between Light and Dark, and links to the privacy policy.*

### The privacy policy URL

The policy exists as two identical copies: `privacy.md` at the repository root (the hosted page) and `newtab/privacy.html` (shipped
inside the extension and linked from Settings → *Privacy policy*). `node tools/pack.mjs` fails if they ever differ.

The dashboard needs a link anyone can open. The repository is public and GitHub renders Markdown, so once `privacy.md` is pushed
the URL is simply:

```text
https://github.com/roma-glushko/intime-chrome-theme/blob/main/privacy.md
```

Paste it into the Privacy practices tab. The policy names no person and no email address: its Contact line points to the listing's
Support link, so set the Support URL (for example the repository's Issues page).

If you would rather have a styled standalone page: GitHub Pages (*Settings → Pages → Deploy from a branch → `main`, `/ (root)`*)
serves the HTML copy at `https://roma-glushko.github.io/intime-chrome-theme/newtab/privacy.html`, and `dist/privacy-policy.html`
can go on any static host (Netlify Drop, Cloudflare Pages). Edit both copies together, then run `node tools/pack.mjs`.

---

## 2. In Time — Dark (theme)

ZIP: `dist/in-time-dark-theme-<version>.zip`

| Field | Value |
| --- | --- |
| Summary | from the manifest: *Black-green night with neon clock light. Pairs with the In Time new-tab extension for the birthday countdown.* |
| Category | the dashboard asks for a theme category; pick the closest (dark) |
| Small promo tile | `store/theme-dark/small-tile.png` |
| Screenshots | **capture the real browser wearing the theme** (see below) |

Detailed description:

```text
A black-green theme with neon accents. The frame, tabs, toolbar and address bar are deep green-black, text and icons are soft mint, and Chrome's own New Tab page gets a night skyline.

Pairs with the free In Time birthday-countdown new-tab extension for a clock that glows to match. Chrome wears one theme at a time; for the light look, install In Time — Light.

Inspired by the film In Time. Not affiliated with, or endorsed by, its makers.
```

Privacy: a theme contains only colours and images and collects nothing. If the dashboard asks for a privacy policy URL, reuse the same page.

## 3. In Time — Light (theme)

ZIP: `dist/in-time-light-theme-<version>.zip`

| Field | Value |
| --- | --- |
| Summary | from the manifest: *Porcelain white and pale mint with jade accents. Pairs with the In Time new-tab extension for the birthday countdown.* |
| Category | closest light category |
| Small promo tile | `store/theme-light/small-tile.png` |
| Screenshots | **capture the real browser wearing the theme** (see below) |

Detailed description:

```text
A calm, bright theme: porcelain white and pale mint with jade accents. The frame, tabs, toolbar and address bar are soft and light, with dark green text and icons that stay easy to read.

Pairs with the free In Time birthday-countdown new-tab extension, which has a matching light mode. Chrome wears one theme at a time; for the dark look, install In Time — Dark.

Inspired by the film In Time. Not affiliated with, or endorsed by, its makers.
```

---

## Screenshots of the themes

The store wants 1–5 screenshots, exactly 1280×800 (or 640×400), showing the real experience, and a theme's experience is the
browser frame. On a Mac:

1. Load the theme (`chrome://extensions` → Load unpacked), open a few tabs, and put a couple of bookmarks in the bar.
2. Size the window (adjust the numbers if your screen is small): `osascript -e 'tell application "Google Chrome" to set bounds of front window to {0, 40, 1280, 840}'`
3. Capture it: **Cmd-Shift-4**, press **Space**, then **Option-click** the window (Option leaves out the drop shadow).
4. On a Retina display that file is 2560×1600. Shrink it: `sips -z 800 1280 ~/Desktop/shot.png`

Capture the dark theme's New Tab page too (it shows the skyline), and an ordinary page for the light theme.

## Updating later

Raise `version` in the package's `manifest.json` (each upload must be higher than the live one), run `node tools/pack.mjs`, then in
the dashboard open the item → **Package** → **Upload new package** → **Submit for review**. Updates get the same review as new
items; the live version stays available meanwhile.
