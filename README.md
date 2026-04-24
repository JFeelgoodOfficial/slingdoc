# SlingDoc — landing site

Accessible, SMS-first payroll time clock & document processing.

A production-ready landing page with a custom **Three.js** animation showing
the SlingDoc flow end-to-end:

> **Phone → photo of a badge → text "clock-in" → "It's that easy!"**

This repo is a **zero-build static site** — just HTML, CSS, and JS modules
loaded from a CDN. Works anywhere that serves static files (Vercel, Netlify,
GitHub Pages, Cloudflare Pages, plain nginx).

---

## What's inside

```
slingdoc/
├── index.html        # semantic HTML for every section
├── styles.css        # design system + section styles
├── main.js           # Three.js scene + animation timeline
├── README.md         # this file
└── vercel.json       # (optional) clean URLs on Vercel
```

**Dependencies:** none. `main.js` uses an import map in `index.html` to load
`three@0.163.0` directly from `cdn.jsdelivr.net`. Fonts load from Google
Fonts.

---

## Run locally

Any static file server works. Because `main.js` uses `type="module"`, you
can't just open `index.html` via `file://` — you need a server. Pick one:

```bash
# Option A — Python (comes with macOS/Linux)
python3 -m http.server 5173

# Option B — Node, no install
npx serve .

# Option C — VS Code "Live Server" extension
```

Then visit <http://localhost:5173>.

---

## Deploy to Vercel

### Option 1 — GitHub + Vercel (recommended)

1. Create a GitHub repo and push these files:
   ```bash
   git init
   git add .
   git commit -m "SlingDoc landing site"
   git branch -M main
   git remote add origin git@github.com:YOUR_ORG/slingdoc-site.git
   git push -u origin main
   ```
2. On <https://vercel.com>, click **Add New → Project**, import your repo.
3. **Framework Preset:** "Other" (it's a static site).
   Leave Build Command and Output Directory **empty**.
4. Click **Deploy**. Done — you'll get a `*.vercel.app` URL in ~30 seconds.

### Option 2 — Vercel CLI (no GitHub required)

```bash
npm i -g vercel
cd slingdoc
vercel           # first time — answers yes to everything
vercel --prod    # publishes to production
```

---

## Deploy elsewhere

- **Netlify** — drag-and-drop the folder onto <https://app.netlify.com/drop>
- **GitHub Pages** — push to `main`, then enable Pages on `/ (root)`
- **Cloudflare Pages** — connect your repo, no build command

---

## Accessibility

- Skip-to-content link
- Full keyboard operability, visible focus rings
- Semantic landmarks (`header`, `nav`, `main`, sections with `aria-labelledby`,
  `footer`)
- Live region (`aria-live="polite"`) narrates each animation phase
- `prefers-reduced-motion` is respected automatically, and a **Reduce motion**
  toggle in the header lets any visitor switch to a static HTML alternative
  of the 3D stage
- All essential information in the 3D canvas is **also present in HTML** —
  the canvas is an illustration, never a barrier

Tested against NVDA, VoiceOver, and keyboard-only navigation.

---

## Animation phases

The 3D stage loops through these phases. Each phase has a matching screen-
reader label and a human-readable caption on-screen:

| # | Phase          | What happens                                        |
|---|----------------|-----------------------------------------------------|
| 0 | `intro`        | Phone rotates into view, screen dark                 |
| 1 | `camera-on`    | Phone screen lights up — camera viewfinder appears   |
| 2 | `badge-enter`  | Employee badge floats in from the right              |
| 3 | `flash`        | Shutter flash, "Captured ✓" appears on screen         |
| 4 | `to-sms`       | Badge fades down, screen transitions to Messages     |
| 5 | `typing`       | `clock-in` types out letter by letter                |
| 6 | `sending`      | Send button activates, message bubble flies up       |
| 7 | `confirm`      | HTML "It's that easy!" card fades in over the canvas |
| 8 | `fade`         | Brief hold, screen fades, loop                       |

Total loop: ~11 seconds.

---

## Customizing

- **Brand colors:** edit the CSS variables at the top of `styles.css`
  (`--ink`, `--accent`, `--paper`, etc).
- **Copy:** everything visible on the page lives in `index.html`. No
  templating — just edit and save.
- **Animation timing:** change the `TIMELINE` array near the top of
  `main.js`. Each entry has `{ id, label, start, end }` in milliseconds.
- **Badge content:** tweak `drawBadge()` in `main.js` to change the name,
  role, ID number, or add your own photo (use `new Image()` + `drawImage`).

---

## Browser support

Works in any evergreen browser with WebGL and ES modules: Chrome/Edge 90+,
Firefox 90+, Safari 15+. On unsupported browsers, the page still renders —
only the 3D canvas is empty (the page is still completely usable and
informative without it).

---

## Credits

Design & build: for the SlingDoc team — Core Goals Consulting.
Inspired by Alejandro Argüello's campaign to make time and document
workflows simple, accessible, and fair.

> "We design for the people software usually forgets."
