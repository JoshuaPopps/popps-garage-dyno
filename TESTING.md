# Test notes — popps-garage-dyno v1.0.0

Tested 2026-11-11. The app is plain JavaScript — `index.html` +
`dyno.js` (engine + catalogs) + `app.js` (UI) + `styles.css` +
service worker. No dependencies, no runtime download, no network.

## Why plain JavaScript (not PyScript)

The app was first built on PyScript (Python in the browser), the
same pattern as the spec. That version could not be proven: in the
test sandbox, headless Chromium could not tunnel to the PyScript CDN
(`ERR_TUNNEL_CONNECTION_FAILED` on `pyscript.net/releases/2024.1.1/
core.js`, while curl fetched the same URL fine) — the app sat on its
loading note for 90 seconds and never rendered. A garage tool that
needs a CDN runtime on first visit is also the wrong shape for its
job: it should work in the garage with no signal, from the first
visit, not the second.

So the engine and UI were ported 1:1 to plain JavaScript and the
PyScript build was deleted. The port was verified, not assumed: the
Python and JS engines were run side by side on all 18 stock
baselines, all 3 presets, and 3 hot combos (96ci Evo, TC103 with
S&S 585, M8 114 with Comp Mega 8) — 24/24 identical on peak HP, peak
HP rpm, peak torque, peak torque rpm, redline, and curve length
(peak values within 0.15 of each other; the only differences are
trailing-zero formatting, e.g. 71.0 vs 71).

## Engine tests — `node test.js` (33 passed, 0 failed)

Run from the app directory; no dependencies, Node 18+:

- **Catalog validation** — `validateData()` clean: all 18 baselines
  sourced and cross-referenced, every carb/cam sourced, no VM42
  (Mikuni makes no VM42 — 38 → 44), S&S flow correctly flagged
  unsourced (not faked).
- **Stock calibration** — every baseline's bone-stock combo reproduces
  its published stock HP within 2% and stock torque within 1%, and
  peak-HP rpm within 400 rpm. Worst case: Panhead 74 FL (peak HP at
  5,000 vs published 4,800).
- **Curve physics** — HP == torque × rpm / 5252 at every point; curves
  rise to peak torque then fall; curves span 1200 rpm to redline.
- **Mod behavior** — Super E beats CV40; HSR48 beats HSR42; 2-into-1
  beats stock pipes; drag pipes cost peak torque; big bore and higher
  compression gain; a hotter cam moves peak torque rpm up; rev limit
  caps the curve. High compression on pump gas warns about
  detonation.
- **SAE correction** — 77°F sea-level day corrects to 0.973 (SAE
  reference is 29.234 inHg dry air, thinner than sea-level standard);
  Phoenix summer (110°F, 1,100 ft) corrects to 1.056; altitude alone
  costs power.
- **Compare math** — deltas and percentages check against the two
  estimates.
- **Unsupported handling** — unknown baseline/carb/cam raise
  `UnsupportedError`; zero displacement raises `Error`.
- **Presets** — all three example bikes estimate cleanly.

### Three real bugs the tests caught (fixed, not waived)

1. **Super E lost to the CV40.** The model compared venturi areas
   (39.6 vs 40 mm) and the Super E came out behind. Reality: the CV's
   slide restricts flow more than its venturi suggests — Carb Shoot 3
   flow-bench data (CV40 159, HSR42 187 CFM @ 10 in H2O) and the
   Sudco table (CV40 185, HSR42 213 CFM) agree the HSR flows ~15–18%
   more. Fix: the model now prefers published CFM when both carbs
   have it, and the CV40 bore was corrected to its *measured* venturi
   (39.0 mm, Carb Shoot 3) instead of its nominal 40 mm.
2. **Peak HP always landed at redline.** The single-parameter fall-off
   couldn't put the HP peak where the factory says it is. Fix: the
   fall-off is now calibrated in two dimensions (rate + shape) so a
   stock combo reproduces both the published HP *and* its rpm.
3. **Twin Cam 96 couldn't calibrate at all.** The commonly cited
   68 hp is inconsistent with the 92.6 lb-ft torque figure and the
   published 71 rwhp stock dyno — the model hit its fall-off ceiling
   trying to reconcile them. Fix: the baseline now uses 83 hp derived
   from the published 71 rwhp, and the source field says exactly that
   (the 68 hp figure is named and rejected, not silently replaced).

## UI test — real browser (Playwright) — PASSED

`python3 test_ui.py` drives the app in headless Chromium (Playwright,
`pip install playwright` + `playwright install chromium` — one-time
setup, not shipped). Run 2026-11-11 20:26 MST, passed in ~4 seconds
(the app renders synchronously on load; no runtime download):

1. Default run renders: Evo 1340 stock, 69.1 hp @ 5,000 / 82 ft-lb,
   chart SVG present.
2. Baseline info shows stock torque and source.
3. Preset "1995 Fat Boy (1340)" → 69.6 hp, factor list names the
   Super E.
4. Phoenix summer SAE card: 110°F / 1,100 ft shown, results re-run.
5. Compare tab: combo B with HSR48 + 2-into-1 beats combo A, delta
   table and dual-curve chart render.
6. Catalog tab: all three tables render — 100+ rows, Knucklehead and
   Milwaukee-Eight baselines, Super E / HSR42 carbs, EV27 / SE-211
   cams, NOT PUBLISHED flags shown.
7. About tab renders (SAE J1349).
8. Cam select follows the baseline family: M8-107 shows M8 cams
   (Mega 8) and no Evo cams (EV27).

Zero page errors, zero console errors, zero failed requests. The
test server log shows only local 200s — the page fetches nothing
external.

Two test bugs found by the run itself (fixed, not waived): the HP
label assertion was case-sensitive while the stylesheet uppercases
labels, and the SAE card formats altitude with a thousands separator
("1,100"), which the UI now does too.

## Static-server check (all 200)

`python3 -m http.server` from the app directory; every shipped asset
returned 200 with a sane size: `index.html`, `dyno.js` (79,112),
`app.js` (20,401), `styles.css`, `sw.js`, `manifest.webmanifest`,
`icons/icon-192.png`, `icons/icon-512.png`, `icons/icon.svg`,
`test.js`, `test_ui.py`, `README.md`. (`TESTING.md` 404s until this
file is written — it is documentation, not an app asset.)

## OPSEC scrub

Before staging, the whole directory was grepped for IPs (LAN,
tailnet, public), hostnames, usernames, real file paths, credentials,
tokens, network names, phone numbers, and street addresses. Clean:
all bikes, names, and numbers are labeled examples; the only external
references are published sources (manuals, spec tables, flow-bench
docs) cited in the catalog. "Popps" appears only in the app name.
No personal or system information ships in the app.

## Known limits (also in README)

- Estimates are crank figures; expect ~12–15% less at the rear wheel.
- The model is a heuristic, not a simulation — big-bore + hot-cam
  combos extrapolate furthest from the calibrated baselines.
- Installability (Add to Home Screen) and the offline cache were
  verified by code inspection (manifest + sw.js asset list matches
  the shipped files) plus the static-server check, not by an
  on-device install test — that step is for the owner on their own
  phone after approval.
- Tested on Node 24 (engine tests + Playwright harness); the app
  itself is HTML + CSS + plain JavaScript, no dependencies.

## v1.0.1 — readability (2026-11-11)

Joshua's word after installing it: make it easier to read. What changed:

- **Chart was the worst of it.** The SVG used an 800-wide viewBox with
  13px grey axis labels — on a phone that renders at ~6px. Now a
  560-wide viewBox with 17px dark-ink axis labels (16px rpm labels),
  thicker curves (3.5px) and bigger peak dots. Roughly double the
  effective label size on a phone.
- **The chart had no width rule at all.** The stylesheet sized
  `canvas.chart`, but the chart is an SVG — the rule never matched, so
  the chart rendered at the browser's 300px default on desktop. Now
  `.chart` gets `width: 100%`.
- **Base type 17px/1.45 → 18px/1.55**, headings up a step (h1 1.75rem,
  h2 1.45rem), form labels and tables to full 1rem, table padding
  7px → 10px, badges 0.8 → 0.88rem, bottom-nav buttons 0.95 → 1.05rem.
- **Muted text darkened** — the grey inside cards went from #6f6a5e
  (~4.6:1 on paper) to #57524a (~7:1), and muted copy is no longer
  set smaller than body text.
- **Service-worker cache bumped v2 → v3** so installed copies pick up
  the new styles instead of serving the old cached shell.
- Engine untouched; `node test.js` still 33/33 and the Playwright UI
  test still passes (re-run after the change, see above).

## v1.0.2 — fieldset text was light-on-light (2026-11-11)

Caught by a screenshot check after v1.0.1: inside the Engine card the
"Baseline (stock bike)" label and the "Stock: 71 hp…" source note
rendered almost invisible — pale text on the cream fieldset. Root
cause, proven with computed styles: the fieldsets sit OUTSIDE `.card`,
so they inherited the light page text color (rgb 244,239,228) while
sitting on a near-white background (rgb 251,248,239), and the `.muted`
notes inside them got the light-on-dark muted color (#c9c2b2) because
`.card .muted` never applied. The selects looked fine only because
they set their own ink color explicitly.

Fix: `fieldset` now sets `color: var(--ink)` and a new
`fieldset .muted` rule gives those notes the dark muted ink. Same bug
hit every fieldset on both the Dyno and Compare tabs, so one rule
fixes them all. The `legend` also gets the fieldset background now —
it straddles the border, and without it the top half of the word sat
on the dark page. Cache bumped v3 → v4 so installed copies pick this
up. Engine tests still 33/33, UI test still passes, screenshot
verified dark-on-cream in the Engine card.

## v1.0.3 — knowledge-base fixes (2026-11-11)

Sourced from the 1997–98 Softail Factory Service Manual #99482-98,
S&S 510-0245, and the 1940–47 Knucklehead Service Manual — no
invented numbers:

- **Evo 1340 baseline corrected: 71 hp / 82.5 lb-ft → 69 hp @ 5,000 /
  82 lb-ft @ 3,600** (factory figures, #99482-98 §1 spec table; bore
  3.498 in., stroke 4.250 in., 80 ci / 1340 cc, 8.5:1). The old
  figure was a spec-database number (MotorcycleSpecs 1984 FLHTC).
  Preset outputs move with it: 1995 Fat Boy 71.6 @ 5,200 / 81.7 →
  **69.6 @ 5,100 / 81.2**; 1990 Softail 70.0 / 80.0 →
  **68.1 @ 5,100 / 79.5**. Stock fall-off recalibrates automatically
  (decline 0.1995 → 0.2193, exponent 2.4 → 2.1).
- **"H-D published NO factory hp for the Evo Big Twin" struck** —
  directly contradicted by the manual. The claim now covers only
  Twin Cam and Milwaukee-Eight (the parts the catalog's sources
  support); the Evo cites the factory figure.
- **Knucklehead displacement corrected** to the manual's nominal
  figures: 61 → **61 Cu. In. (1000 c.c.)**, 74 → **74 Cu. In.
  (1200 c.c.)** (was 60.3/989 and 73.7/1208). HP/torque untouched;
  stock Knucklehead output unchanged (48.0 hp / 58.0 lb-ft).
- **Catalog additions:** CV40 factory jetting + float (main 170 /
  slow 42, 49-state; float 0.413–0.453 in.; idle 1000–1050 rpm) and
  Super E baseline (.0295/.072, 1¼ turns, 950–1050 rpm), plus the
  fuel octane floor — factory minimum **87 pump octane or higher**,
  stated alongside the app's 91-octane baseline.
- `test_ui.py` expectations updated to the new numbers (69 hp
  default, 82 lb-ft baseline info, 69.6 hp Fat Boy preset). Engine
  tests needed no changes — the calibration tests are generic and
  still pass 33/33. Cache bumped v4 → v5 so installed copies pick
  up the corrected engine.
