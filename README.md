# Popps's Garage Dyno

A Desktop-Dyno-style horsepower and torque estimator for Harleys — as
a phone app you install from the browser. No app store, no account, no
server.

Pick a stock Harley baseline, bolt on the mods — carb, cam, exhaust,
heads, big bore, compression — and the dyno estimates crank horsepower
and torque across the rev range and draws the curves. Compare two
combos side by side. See what the same motor makes in Phoenix summer
heat versus a standard day (SAE J1349 correction).

Every number is labeled **ESTIMATE** throughout. This is not a dyno
sheet — a real dyno measures; this estimates. It's for comparing two
combos before spending money, not for bragging rights.

> All bikes, names, and numbers below are examples only.

## What it does

- **Dyno tab** — build a combo: baseline (18 stock Harleys, Flathead
  45 to V-Rod 1250), displacement, compression, carburetor or
  throttle body (21 cataloged), camshaft (127 cataloged, stock grinds
  plus Andrews, S&S, Wood, Feuling, Zippers, Screamin' Eagle, Crane,
  Leinweber, JIMS, Cycle-Rama, V-Thunder, Comp Cams), exhaust, heads,
  air cleaner, fuel, rev limit. Three one-tap presets for example
  bikes (1995 Fat Boy, 1990 Softail, 1947 Knucklehead). Results show
  peak HP and torque with rpm, the full HP/torque curves as a chart,
  the curve table every 100 rpm, what each mod contributed, and what
  the motor makes in the air you set (temperature + altitude).
- **Compare tab** — combo A (whatever is on the Dyno tab) versus a
  combo B you build here: same baseline with a different cam, stock
  pipes versus 2-into-1, whatever you want to settle. Dual curves and
  a delta table.
- **Catalog tab** — every baseline, carb, and cam in the dyno with its
  published source. If a number isn't here, the dyno says so instead
  of guessing.
- **About tab** — the method, the limits, and the spec policy.
- **Installable & offline** — open it in Chrome (Android) or Safari
  (iPhone), "Add to Home Screen," and it works in the garage with no
  signal. Plain JavaScript, zero dependencies — no runtime download,
  no network at all. A service worker caches the app shell after the
  first load.

## Install

No build step for the app itself. Any static host works — GitHub
Pages, a folder on your home server, or just the files on disk:

```bash
# Local preview
python3 -m http.server 8000
# then open http://localhost:8000/ on your phone or desktop
```

On your phone, open the hosted URL and use **Add to Home Screen**
(Android Chrome: menu → Add to Home Screen; iPhone Safari: Share →
Add to Home Screen). It then launches full-screen like a native app
and works offline from the first visit — there is no runtime to
download and nothing to fetch from the network.

To test after editing the engine:

```bash
node test.js            # 33 engine tests, no dependencies
python3 test_ui.py      # real-browser UI test (Playwright, see TESTING.md)
```

## Try it

Open the app and tap a preset — the dyno runs immediately:

```
1995 Fat Boy (1340) — S&S Super E, stock cam, drag pipes, high-flow air
  ESTIMATE: 71.6 hp @ 5,200 rpm / 81.7 ft-lb @ 3,600 rpm (crank)
  Stock 1340: 71 hp @ 5,000 / 82.5 ft-lb @ 3,600
  What moved it: Super E, drag pipes (cost low-end torque), high-flow air

1990 Softail (1340) — stock CV40, stock cam, drag pipes
  ESTIMATE: 70.0 hp @ 5,100 rpm / 80.0 ft-lb @ 3,600 rpm (crank)
  Drag pipes alone cost a little low-end with nothing else added.

1947 Knucklehead (74) — stock Linkert M74B, stock cam
  ESTIMATE: 48.0 hp @ 5,000 rpm / 58.0 ft-lb @ 3,100 rpm (crank)
  (Peak torque estimated from published HP — see "On specs".)
```

Or build a Stage 1 Evo by hand — 1340, HSR42, Andrews EV27,
2-into-1, pocket-ported heads, high-flow air cleaner:

```
  ESTIMATE: 89.7 hp @ 5,400 rpm / 97.5 ft-lb @ 3,900 rpm (crank)
  In Phoenix summer air (110°F, 1,100 ft): 84.9 hp / 92.3 ft-lb observed
  (SAE correction factor 1.056 — the heat costs about 5 hp.)
```

## How the math works

1. **Start from a published stock baseline** — displacement,
   compression, factory HP and torque, redline. Each baseline cites
   its source in the Catalog tab.
2. **Mods multiply peak torque** by documented factors: displacement
   (~proportional), compression (~2.8% per point), carb flow or
   venturi area, cam duration and lift, exhaust, heads, air cleaner.
   These are heuristics from published dyno lore, not physics — the
   exact factors are listed under each result.
3. **A torque curve is built** around the estimated peak: rising from
   idle to the peak-torque rpm, then falling toward redline. The
   fall-off (rate + shape) is **calibrated per baseline** so a
   bone-stock combo reproduces its published stock HP *and* the rpm it
   peaks at. Every baseline in the test suite reproduces stock HP
   within 2% and peak-HP rpm within 400 rpm.
4. **Horsepower = torque × rpm / 5252** at every point. Peak HP is
   read off the curve, never typed in.
5. **SAE J1349 correction** converts corrected power to what the
   motor makes in real air. SAE reference is 77°F and 29.234 inHg dry
   air (99 kPa) — slightly thinner than sea-level standard pressure,
   so a 77°F sea-level day corrects to 0.973, not 1.000.

## On specs: real numbers or nothing

This tool will never invent a torque, clearance, or spec value. The
rules it follows:

- **Stock baselines carry their published source.** Where Harley
  never published a figure, the dyno says so:
  - Harley published **no factory HP** for the Evo Big Twin, any Twin
    Cam, or any Milwaukee-Eight — only torque. HP for those is a
    clearly-labeled third-party or rear-wheel-derived figure, never
    presented as factory.
  - Harley published **no torque figure at all** for the Flathead 45,
    Knucklehead 61/74, and other pre-1966 engines. For those three
    baselines the peak torque is *estimated from the published HP*
    (peak = 1.15 × HP × 5252 / HP-rpm) and flagged everywhere it
    appears — including a warning on every result.
  - Where sources conflict (Twin Cam 88 HP: 67 vs 80; Ironhead 1000
    torque: 52 vs ~70 lb-ft), the dyno picks one value, cites it, and
    notes the conflict in the source field.
  - Where an HP rpm was never published (Twin Cam 96/103/110,
    Milwaukee-Eight), the rpm used is stated in the source field.
- **Carbs use the flow-limiting diameter** — the venturi for S&S and
  Linkert (their model names quote the bigger throttle bore), the bore
  for Mikuni/Keihin. Published flow (CFM) is used when both carbs in
  a comparison have it; otherwise venturi area. S&S publishes no
  absolute CFM for the Super B/E/G/D — the dyno says so and uses
  venturi area. The Mikuni VM42 does not exist (the VM line runs
  38 → 44); it is not in the catalog.
- **Cams use the Harley duration convention** — Evo/Twin Cam figures
  are @ .053" lift, M8 @ .050", and the basis is shown on every row.
  Never relabeled. Cams with no published duration (Wood 22XE,
  Zippers RS468/472, Feuling Reaper 525, Star M28) are not in the
  catalog — the dyno can't model a swap it has no numbers for.
- **Stock cams for Flathead, Knucklehead, Panhead, Shovelhead, and
  V-Rod** have no published specs on file; those families model with
  the stock cam only (no aftermarket cam swaps offered).

## What's not in the dyno (yet)

- **Revolution Max 1250/1250T, Street 500/750, Shovelhead 80,
  Ironhead 1000, Flathead 74/80** — baselines exist in the research
  notes but each is missing one sourced piece (stock throttle-body
  size, stock carb, or any HP figure). They stay out until that piece
  is sourced; the dyno refuses the family instead of guessing.
- **Lectron carbs** — Lectron publishes no bore list for the Harley
  kits; excluded for the same reason.
- **Twin Cam 88 injected (B) cam** — the carb (A) cam is the stock
  reference; the injected variant differs only in LSA/intake close.
- **No airflow simulation** — no port-flow numbers, no VE map. The
  factors are heuristics; two combos close together are a coin toss,
  and the dyno says so.

## Files

| File | What it is |
|---|---|
| `index.html` | App shell (Dyno / Compare / Catalog / About) |
| `dyno.js` | Engine + all catalogs (source of truth) |
| `app.js` | UI — forms, charts, catalog tables, wiring |
| `test.js` | 33 engine tests — `node test.js` |
| `test_ui.py` | Real-browser UI test (Playwright) — see TESTING.md |
| `styles.css` | Shop-manual styling, big touch targets |
| `sw.js` | Service worker — caches the app for offline use |
| `manifest.webmanifest` | Install metadata (name, icons, colors) |
| `icons/` | App icons (192/512 PNG + SVG) |
| `make_icons.py` | Renders the PNG icons from the gauge design |

## Testing

See [TESTING.md](TESTING.md) for the full test log: 33 engine tests
(`node test.js`), a real-browser UI test that drives the
actual app in headless Chromium (presets, run, compare, catalog,
offline cache), and a static-server check that every asset serves.

## Known limits

- Estimates are crank figures. Expect roughly 12–15% less at the
  rear wheel through the primary, gearbox, and belt/chain.
- The model is a heuristic, not a simulation. Big-bore + hot-cam
  combos extrapolate furthest from the calibrated stock baselines —
  treat those numbers as the roughest.
- One device, one browser: no saved combos yet — a combo lives only
  until you navigate away. Save/export is a future upgrade.

## License

MIT. Do whatever you want with it — it's a garage tool.
