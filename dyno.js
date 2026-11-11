"use strict";
/* Popps's Garage Dyno — engine (JavaScript).
 *
 * Ported 1:1 from the Python reference implementation (dyno.py), which
 * was retired once this port was verified against it on every baseline
 * and preset (see TESTING.md). Stdlib only, no dependencies, no
 * network. Runs in the browser and under Node (see the
 * module.exports guard at the bottom).
 *
 * Model (documented, so anyone can check the math):
 *   - Start from a published stock baseline: displacement, compression,
 *     stock peak HP @ rpm, stock peak torque @ rpm, redline.
 *   - Mods multiply peak torque by documented factors (displacement,
 *     compression, carb flow or venturi area, cam duration and lift,
 *     exhaust, heads, air cleaner, fuel). Factors are heuristics from
 *     published dyno lore, labeled ESTIMATE in the output.
 *   - A torque curve is built around the estimated peak torque:
 *     rises from idle to the peak-torque rpm, then falls toward
 *     redline. The fall-off (rate + shape) is calibrated per baseline
 *     so a bone-stock combo reproduces its published stock HP and the
 *     rpm it peaks at.
 *   - Horsepower at every rpm is exactly torque * rpm / 5252.
 *   - SAE J1349 correction converts between observed power at ambient
 *     conditions and corrected power at standard conditions.
 *
 * DATA (baselines, carbs, cams, exhausts, heads, air, fuel, presets)
 * is generated into this file — edit the DATA block directly; every
 * entry carries its published source.
 */

const DATA = {
 "BASELINES": {
  "flathead-45": {
   "family": "Flathead",
   "variant": "45 (WLA)",
   "years": "1941–1952",
   "disp_ci": 45.1,
   "disp_cc": 739,
   "compression": 4.75,
   "stock_hp": 23.5,
   "stock_hp_rpm": 4600,
   "stock_tq": 31,
   "stock_tq_rpm": 2850,
   "tq_estimated": true,
   "redline": 4800,
   "stock_carb": "linkert-m88",
   "stock_cam": "stock-flathead-45",
   "source": "WLA ~23.5 hp @ 4,600 (WebBikeWorld 1942 WLA; Classic Motorcycle Build). No torque figure was ever published — peak torque estimated from HP (see tq_estimated)."
  },
  "knuckle-61": {
   "family": "Knucklehead",
   "variant": "61 (EL)",
   "years": "1936–1947",
   "disp_ci": 60.3,
   "disp_cc": 989,
   "compression": 7.0,
   "stock_hp": 40,
   "stock_hp_rpm": 4800,
   "stock_tq": 50,
   "stock_tq_rpm": 3000,
   "tq_estimated": true,
   "redline": 5500,
   "stock_carb": "linkert-m74b",
   "stock_cam": "stock-knuckle",
   "source": "EL 40 hp @ 4,800 (Bobber Brothers; Wikipedia / Knucklehead engine). No torque figure was ever published — peak torque estimated from HP (see tq_estimated)."
  },
  "knuckle-74": {
   "family": "Knucklehead",
   "variant": "74 (FL)",
   "years": "1941–1947",
   "disp_ci": 73.7,
   "disp_cc": 1208,
   "compression": 7.0,
   "stock_hp": 48,
   "stock_hp_rpm": 5000,
   "stock_tq": 58,
   "stock_tq_rpm": 3100,
   "tq_estimated": true,
   "redline": 5500,
   "stock_carb": "linkert-m74b",
   "stock_cam": "stock-knuckle",
   "source": "FL 48 hp @ 5,000 (Bobber Brothers; J3 Helmets 1940 specs). No torque figure was ever published — peak torque estimated from HP (see tq_estimated)."
  },
  "panhead-74-fl": {
   "family": "Panhead",
   "variant": "74 (FL)",
   "years": "1948–1965",
   "disp_ci": 73.7,
   "disp_cc": 1207,
   "compression": 7.0,
   "stock_hp": 55,
   "stock_hp_rpm": 4800,
   "stock_tq": 62,
   "stock_tq_rpm": 3200,
   "redline": 5800,
   "stock_carb": "linkert-m74b",
   "stock_cam": "stock-panhead",
   "source": "FL 55 hp @ 4,800, 62 lb-ft @ 3,200 (WebBikeWorld Panhead specs)."
  },
  "panhead-74-flh": {
   "family": "Panhead",
   "variant": "74 (FLH)",
   "years": "1955–1965",
   "disp_ci": 73.7,
   "disp_cc": 1207,
   "compression": 8.0,
   "stock_hp": 60,
   "stock_hp_rpm": 5400,
   "stock_tq": 65,
   "stock_tq_rpm": 3200,
   "redline": 5800,
   "stock_carb": "linkert-m74b",
   "stock_cam": "stock-panhead",
   "source": "FLH 60 hp @ 5,400, 65 lb-ft (Motorcycle Classics 1961 FLH; It Still Runs — torque rpm not stated in source, 3,200 used)."
  },
  "shovel-74": {
   "family": "Shovelhead",
   "variant": "74 (FL/FLH)",
   "years": "1966–1977",
   "disp_ci": 74,
   "disp_cc": 1212,
   "compression": 8.0,
   "stock_hp": 60,
   "stock_hp_rpm": 5400,
   "stock_tq": 70,
   "stock_tq_rpm": 3200,
   "redline": 5800,
   "stock_carb": "bendix-38",
   "stock_cam": "stock-shovel",
   "source": "FLH 60 hp @ 5,400 (Bonhams 1966 FLH); ~70 lb-ft (AutoEvolution — torque rpm not stated, 3,200 used)."
  },
  "evo-1340": {
   "family": "Evolution Big Twin",
   "variant": "1340 (80 ci)",
   "years": "1984–1999",
   "disp_ci": 81.6,
   "disp_cc": 1337,
   "compression": 8.5,
   "stock_hp": 71,
   "stock_hp_rpm": 5000,
   "stock_tq": 82.5,
   "stock_tq_rpm": 3600,
   "redline": 5500,
   "stock_carb": "cv40",
   "stock_cam": "stock-evo",
   "source": "71 hp @ 5,000 is a spec-database figure (MotorcycleSpecs 1984 FLHTC) — H-D published NO factory hp for the Evo Big Twin. Torque 82.5 lb-ft @ 3,600 (FLHTC)."
  },
  "evo-sport-883": {
   "family": "Evolution Sportster",
   "variant": "883",
   "years": "2004–2006",
   "disp_ci": 53.9,
   "disp_cc": 883,
   "compression": 9.0,
   "stock_hp": 53,
   "stock_hp_rpm": 6000,
   "stock_tq": 51,
   "stock_tq_rpm": 4300,
   "redline": 6500,
   "stock_carb": "cv40",
   "stock_cam": "stock-sport",
   "source": "53 hp @ 6,000, 51 lb-ft @ 4,300 — 2004 H-D press release (via HDForums)."
  },
  "evo-sport-1200": {
   "family": "Evolution Sportster",
   "variant": "1200",
   "years": "2004–2006",
   "disp_ci": 73.3,
   "disp_cc": 1200,
   "compression": 9.7,
   "stock_hp": 70,
   "stock_hp_rpm": 6000,
   "stock_tq": 79,
   "stock_tq_rpm": 3500,
   "redline": 6500,
   "stock_carb": "cv40",
   "stock_cam": "stock-sport",
   "source": "70 hp @ 6,000, 79 lb-ft @ 3,500 — 2004 H-D press release (via HDForums). Pre-2004 1200s were ~58 hp / 68 lb-ft."
  },
  "tc-88": {
   "family": "Twin Cam",
   "variant": "88",
   "years": "1999–2006",
   "disp_ci": 88.4,
   "disp_cc": 1449,
   "compression": 8.9,
   "stock_hp": 67,
   "stock_hp_rpm": 5200,
   "stock_tq": 86,
   "stock_tq_rpm": 3500,
   "redline": 5800,
   "stock_carb": "cv40",
   "stock_cam": "stock-tc88",
   "source": "67 hp @ 5,200, 86 lb-ft @ 3,500 — Cycle World data via CycleChaos (FLSTF/I Fat Boy). Rear-wheel stock ~55 hp. One conflicting source claims 80 hp. H-D published no factory hp for Twin Cams."
  },
  "tc-96": {
   "family": "Twin Cam",
   "variant": "96",
   "years": "2007–2011",
   "disp_ci": 96,
   "disp_cc": 1584,
   "compression": 9.2,
   "stock_hp": 83,
   "stock_hp_rpm": 5200,
   "stock_tq": 92.6,
   "stock_tq_rpm": 3500,
   "redline": 5800,
   "stock_carb": "tb-tc-46",
   "stock_cam": "stock-tc96",
   "source": "92.6 lb-ft @ 3,500 (ThrottlePack). HP derived: 71 rwhp stock (Nightrider SE dyno) → ~83 crank at ~15% drivetrain loss. The commonly cited 68 hp conflicts with both the torque figure and the rear-wheel data, so it is NOT used."
  },
  "tc-103": {
   "family": "Twin Cam",
   "variant": "103",
   "years": "2012–2017",
   "disp_ci": 103,
   "disp_cc": 1688,
   "compression": 9.6,
   "stock_hp": 83,
   "stock_hp_rpm": 5200,
   "stock_tq": 100,
   "stock_tq_rpm": 3500,
   "redline": 6000,
   "stock_carb": "tb-tc-46",
   "stock_cam": "stock-tc103",
   "source": "Torque up to 100 lb-ft (2012 H-D rollout; Motorcycle.com 2014 reveal: 104.7 air-cooled). HP derived: 71 rwhp @ 5,200 (TwinCamDyno) → ~83 crank. No factory hp exists."
  },
  "tc-110": {
   "family": "Twin Cam",
   "variant": "110 (CVO)",
   "years": "2012–2017",
   "disp_ci": 110,
   "disp_cc": 1803,
   "compression": 9.2,
   "stock_hp": 115,
   "stock_hp_rpm": 5500,
   "stock_tq": 116.5,
   "stock_tq_rpm": 3750,
   "redline": 6000,
   "stock_carb": "tb-tc-46",
   "stock_cam": "stock-tc110",
   "source": "116.5 lb-ft air-cooled (Motorcycle.com 2014 reveal). 115 hp is a spec-database estimate, NOT factory. HP rpm not stated — 5,500 used (a 116 lb-ft motor cannot peak at 5,200)."
  },
  "m8-107": {
   "family": "Milwaukee-Eight",
   "variant": "107",
   "years": "2017–",
   "disp_ci": 107,
   "disp_cc": 1746,
   "compression": 10.0,
   "stock_hp": 92.5,
   "stock_hp_rpm": 5000,
   "stock_tq": 111.4,
   "stock_tq_rpm": 3250,
   "redline": 6000,
   "stock_carb": "tb-m8-55",
   "stock_cam": "stock-m8",
   "source": "111.4 lb-ft @ 3,250 SAE J1349 (factory). ~92.5 hp crank estimate (Seasoned Wrench; rear-wheel ~81 hp). H-D publishes no hp. HP rpm not stated — 5,000 used."
  },
  "m8-114": {
   "family": "Milwaukee-Eight",
   "variant": "114",
   "years": "2017–",
   "disp_ci": 114,
   "disp_cc": 1868,
   "compression": 10.5,
   "stock_hp": 100.5,
   "stock_hp_rpm": 5000,
   "stock_tq": 119,
   "stock_tq_rpm": 3250,
   "redline": 6000,
   "stock_carb": "tb-m8-55",
   "stock_cam": "stock-m8",
   "source": "119 lb-ft @ 3,250, Softail (factory). ~100.5 hp crank estimate (rear-wheel ~86 hp). H-D publishes no hp. HP rpm not stated — 5,000 used."
  },
  "m8-117": {
   "family": "Milwaukee-Eight",
   "variant": "117",
   "years": "2017–",
   "disp_ci": 117,
   "disp_cc": 1923,
   "compression": 10.2,
   "stock_hp": 103,
   "stock_hp_rpm": 5000,
   "stock_tq": 123,
   "stock_tq_rpm": 3500,
   "redline": 6000,
   "stock_carb": "tb-m8-55",
   "stock_cam": "stock-m8",
   "source": "123 lb-ft @ 3,500 (2024 Breakout, factory). ~103 hp crank estimate (spec-database; rear-wheel 93.75 hp @ 4,870). HP rpm not stated — 5,000 used."
  },
  "rev-1130": {
   "family": "Revolution (V-Rod)",
   "variant": "1130",
   "years": "2002–2007",
   "disp_ci": 69,
   "disp_cc": 1131,
   "compression": 11.3,
   "stock_hp": 115,
   "stock_hp_rpm": 8250,
   "stock_tq": 74,
   "stock_tq_rpm": 7300,
   "redline": 9000,
   "stock_carb": "tb-vrod-53",
   "stock_cam": "stock-rev",
   "source": "115 hp @ 8,250, 74 lb-ft @ 7,300 — claimed crank (Wikipedia / VRSC; MotorcycleSpecifications VRSCA). Rear-wheel 103.2 hp / 72 lb-ft."
  },
  "rev-1250": {
   "family": "Revolution (V-Rod)",
   "variant": "1250",
   "years": "2008–2017",
   "disp_ci": 76.1,
   "disp_cc": 1247,
   "compression": 11.3,
   "stock_hp": 123,
   "stock_hp_rpm": 8000,
   "stock_tq": 86,
   "stock_tq_rpm": 7000,
   "redline": 9000,
   "stock_carb": "tb-vrod-53",
   "stock_cam": "stock-rev",
   "source": "123 hp @ 8,000, 86 lb-ft @ 7,000 — VRSCAW (MotorcycleSpecs). Compression listed 11.5:1 in some sources."
  }
 },
 "CARBS": {
  "linkert-m88": {
   "name": "Linkert M88",
   "bore_mm": 23.8,
   "flow_cfm": null,
   "fits": [
    "Flathead 45"
   ],
   "bore_note": "Venturi 15/16 in; body 1-1/4 in.",
   "source": "V-Twin Mfg Classic catalog p. 237."
  },
  "linkert-m74b": {
   "name": "Linkert M74B",
   "bore_mm": 33.3,
   "flow_cfm": null,
   "fits": [
    "Knucklehead",
    "Panhead"
   ],
   "bore_note": "Venturi 1-5/16 in; body 1-1/2 in.",
   "source": "V-Twin Mfg Classic catalog pp. 237, 240."
  },
  "tillotson-hd": {
   "name": "Tillotson HD",
   "bore_mm": 42,
   "flow_cfm": null,
   "fits": [
    "Ironhead Sportster",
    "Shovelhead"
   ],
   "bore_note": "Venturi 42 mm — single forum report, UNCONFIRMED.",
   "source": "Sportsterpedia (application); venturi figure: Forestry Forum post — treat as low-confidence."
  },
  "bendix-38": {
   "name": "Zenith-Bendix 16P12",
   "bore_mm": 38,
   "flow_cfm": null,
   "fits": [
    "Shovelhead",
    "Ironhead Sportster"
   ],
   "bore_note": "Venturi 38 mm (Shovelhead stock); throttle bore 42 mm.",
   "source": "Sportsterpedia (throttle bore 1.653 in, venturi 38–40 mm)."
  },
  "cv40": {
   "name": "Keihin CV40",
   "bore_mm": 39.0,
   "flow_cfm": 185,
   "fits": [
    "Evolution Big Twin",
    "Evolution Sportster",
    "Twin Cam 88"
   ],
   "bore_note": "Measured venturi 1.535 in (39.0 mm); nominal 40 mm.",
   "source": "Nightrider CV mods page; flow 185 CFM: Mikuni/Sudco tuning manual, 4th ed. Venturi measured: Carb Shoot 3 (bwoltz, 2008)."
  },
  "cv44": {
   "name": "Keihin CV44 (Screamin' Eagle)",
   "bore_mm": 42.0,
   "flow_cfm": null,
   "fits": [
    "Evolution Big Twin",
    "Twin Cam"
   ],
   "bore_note": "Measured venturi 1.652 in (42.0 mm). Flow 190 CFM @ 10 in H2O on the Carb Shoot 3 bench — not directly comparable to 28 in figures.",
   "source": "Carb Shoot 3 (bwoltz, 2008): measured venturi + flow bench."
  },
  "vm38": {
   "name": "Mikuni VM38",
   "bore_mm": 38,
   "flow_cfm": null,
   "fits": [
    "Ironhead Sportster",
    "Shovelhead"
   ],
   "bore_note": "38 mm round-slide.",
   "source": "Sportsterpedia; Sudco VM catalog."
  },
  "tm40": {
   "name": "Mikuni TM40",
   "bore_mm": 40,
   "flow_cfm": null,
   "fits": [
    "Aftermarket"
   ],
   "bore_note": "40 mm flat-slide (TM40-6).",
   "source": "Mikuni size chart via cartipsdaily.com."
  },
  "hsr42": {
   "name": "Mikuni HSR42",
   "bore_mm": 42,
   "flow_cfm": 213,
   "fits": [
    "Evolution Big Twin",
    "Evolution Sportster",
    "Twin Cam"
   ],
   "bore_note": "42 mm.",
   "source": "Mikuni/Sudco tuning manual, 4th ed. (213 CFM)."
  },
  "hsr45": {
   "name": "Mikuni HSR45",
   "bore_mm": 45,
   "flow_cfm": 237,
   "fits": [
    "Evolution Big Twin",
    "Twin Cam"
   ],
   "bore_note": "45 mm.",
   "source": "Mikuni/Sudco tuning manual, 4th ed. (237 CFM)."
  },
  "hsr48": {
   "name": "Mikuni HSR48",
   "bore_mm": 48,
   "flow_cfm": 270,
   "fits": [
    "Evolution Big Twin",
    "Twin Cam"
   ],
   "bore_note": "48 mm.",
   "source": "Mikuni/Sudco tuning manual, 4th ed. (270 CFM)."
  },
  "ss-b": {
   "name": "S&S Super B",
   "bore_mm": 39.6,
   "flow_cfm": null,
   "fits": [
    "Evolution Big Twin",
    "Evolution Sportster"
   ],
   "bore_note": "Venturi 1-9/16 in; throat 1-7/8 in. No accel pump.",
   "source": "S&S Instruction 51-1006."
  },
  "ss-e": {
   "name": "S&S Super E",
   "bore_mm": 39.6,
   "flow_cfm": null,
   "fits": [
    "Evolution Big Twin",
    "Evolution Sportster",
    "Twin Cam"
   ],
   "bore_note": "Venturi 1-9/16 in; bore 1-7/8 in.",
   "source": "S&S Instruction 51-1012 (no absolute CFM published)."
  },
  "ss-g": {
   "name": "S&S Super G",
   "bore_mm": 44.5,
   "flow_cfm": null,
   "fits": [
    "Evolution Big Twin",
    "Twin Cam"
   ],
   "bore_note": "Venturi 1-3/4 in; bore 2-1/16 in.",
   "source": "S&S Instruction 51-1012 (no absolute CFM published)."
  },
  "ss-d": {
   "name": "S&S Super D (Two Throat)",
   "bore_mm": 58.4,
   "flow_cfm": null,
   "fits": [
    "Evolution Big Twin"
   ],
   "bore_note": "Two 41.3 mm throats; 58.4 mm is the equal-area single bore. Carb Shoot 3 measured a 1.950 in venturi on their sample — figures differ by sample.",
   "source": "S&S Two Throat manual."
  },
  "tb-tc-46": {
   "name": "Twin Cam EFI throttle body (stock)",
   "bore_mm": 46,
   "flow_cfm": 219,
   "fits": [
    "Twin Cam 96",
    "Twin Cam 103",
    "Twin Cam 110"
   ],
   "bore_note": "46 mm single bore, 2006-up Big Twin.",
   "source": "Johnson Engine Technology flow bench, 219 CFM @ 28 in (via HarleyTechTalk)."
  },
  "tb-tc-52": {
   "name": "S&S Single Bore throttle body 52 mm",
   "bore_mm": 52,
   "flow_cfm": null,
   "fits": [
    "Twin Cam"
   ],
   "bore_note": "52 mm single bore.",
   "source": "S&S Instruction 51-1270 (kit 17-5070)."
  },
  "tb-tc-58": {
   "name": "S&S Single Bore throttle body 58 mm",
   "bore_mm": 58,
   "flow_cfm": null,
   "fits": [
    "Twin Cam"
   ],
   "bore_note": "58 mm single bore.",
   "source": "S&S Instruction 51-1270 (kit 106-4408)."
  },
  "tb-m8-55": {
   "name": "Milwaukee-Eight EFI throttle body (stock)",
   "bore_mm": 55,
   "flow_cfm": null,
   "fits": [
    "Milwaukee-Eight"
   ],
   "bore_note": "55 mm — widely repeated, single weak source; needs service-manual confirmation.",
   "source": "JustAnswer thread (weak — flagged)."
  },
  "tb-vrod-53": {
   "name": "V-Rod EFI throttle bodies (stock)",
   "bore_mm": 53,
   "flow_cfm": null,
   "fits": [
    "Revolution (V-Rod)"
   ],
   "bore_note": "Twin 53 mm bodies, one per cylinder; modeled as a 53 mm single bore — swaps are approximate.",
   "source": "MotorcycleSpecifications VRSCA/VRSCB; MotorcycleSpecs.co.za."
  },
  "tb-sport-41": {
   "name": "EFI Sportster throttle body (stock)",
   "bore_mm": 41,
   "flow_cfm": null,
   "fits": [
    "Evolution Sportster (EFI)"
   ],
   "bore_note": "45 mm plate, necks to 41 mm downstream — 41 mm used.",
   "source": "Hammer Performance XL throttle-body tests."
  }
 },
 "CAMS": {
  "stock-flathead-45": {
   "name": "Stock Flathead 45",
   "families": [
    "Flathead"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": null,
   "dur_e": null,
   "dur_basis": null,
   "lift_i": null,
   "lift_e": null,
   "lsa": null,
   "ic": null,
   "source": "No published stock cam specs found — modeled with the stock cam only.",
   "stock": true,
   "unsourced": true
  },
  "stock-knuckle": {
   "name": "Stock Knucklehead",
   "families": [
    "Knucklehead"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": null,
   "dur_e": null,
   "dur_basis": null,
   "lift_i": null,
   "lift_e": null,
   "lsa": null,
   "ic": null,
   "source": "No published stock cam specs found — modeled with the stock cam only.",
   "stock": true,
   "unsourced": true
  },
  "stock-panhead": {
   "name": "Stock Panhead",
   "families": [
    "Panhead"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": null,
   "dur_e": null,
   "dur_basis": null,
   "lift_i": null,
   "lift_e": null,
   "lsa": null,
   "ic": null,
   "source": "No published stock cam specs found — modeled with the stock cam only.",
   "stock": true,
   "unsourced": true
  },
  "stock-shovel": {
   "name": "Stock Shovelhead",
   "families": [
    "Shovelhead"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": null,
   "dur_e": null,
   "dur_basis": null,
   "lift_i": null,
   "lift_e": null,
   "lsa": null,
   "ic": null,
   "source": "No published stock cam specs found — modeled with the stock cam only.",
   "stock": true,
   "unsourced": true
  },
  "stock-evo": {
   "name": "Stock Evo Big Twin (\"L\" cam)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 218,
   "dur_e": 232,
   "dur_basis": ".053",
   "lift_i": 0.495,
   "lift_e": 0.495,
   "lsa": 112.5,
   "ic": 37,
   "source": "V-Twin catalog BT p.20; Nightrider master cam table (SP Mullen, 1997–2006). Year variants exist — see README.",
   "stock": true,
   "unsourced": false
  },
  "stock-sport": {
   "name": "Stock Evo Sportster (883 & 1200)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": 270,
   "adv_e": 270,
   "dur_i": 223,
   "dur_e": 223,
   "dur_basis": ".053",
   "lift_i": 0.458,
   "lift_e": 0.458,
   "lsa": 109.5,
   "ic": 41,
   "source": "V-Twin XL catalog p.19; Nightrider XLE 'D'. 883 & 1200 share this cam.",
   "stock": true,
   "unsourced": false
  },
  "stock-tc88": {
   "name": "Stock Twin Cam 88 (carb)",
   "families": [
    "Twin Cam"
   ],
   "adv_i": 257,
   "adv_e": 260,
   "dur_i": 216,
   "dur_e": 220,
   "dur_basis": ".053",
   "lift_i": 0.473,
   "lift_e": 0.473,
   "lsa": 108.0,
   "ic": 38,
   "source": "Preston/Yumpu Andrews TC catalog; Nightrider. Carb (A) version.",
   "stock": true,
   "unsourced": false
  },
  "stock-tc96": {
   "name": "Stock Twin Cam 96/103 (2007–13)",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 196,
   "dur_e": 219,
   "dur_basis": "unstated",
   "lift_i": 0.473,
   "lift_e": 0.474,
   "lsa": null,
   "ic": null,
   "source": "HarleyTechTalk / Big Boyz. Duration basis unstated; LSA and intake closing not published.",
   "stock": true,
   "unsourced": false
  },
  "stock-tc103": {
   "name": "Stock Twin Cam 96/103 (2007–13)",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 196,
   "dur_e": 219,
   "dur_basis": "unstated",
   "lift_i": 0.473,
   "lift_e": 0.474,
   "lsa": null,
   "ic": null,
   "source": "HarleyTechTalk / Big Boyz. Duration basis unstated; LSA and intake closing not published.",
   "stock": true,
   "unsourced": false
  },
  "stock-tc110": {
   "name": "Stock Twin Cam 103HO (2014–16 Rushmore)",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 212,
   "dur_e": 233,
   "dur_basis": ".053",
   "lift_i": 0.511,
   "lift_e": 0.511,
   "lsa": null,
   "ic": null,
   "source": "HarleyTechTalk (103HO). Used as the stock reference for the 110 CVO — the 110's own stock cam specs were not found.",
   "stock": true,
   "unsourced": false
  },
  "stock-m8": {
   "name": "Stock Milwaukee-Eight 107/114",
   "families": [
    "Milwaukee-Eight"
   ],
   "adv_i": 212,
   "adv_e": 252,
   "dur_i": 174,
   "dur_e": 199,
   "dur_basis": ".050",
   "lift_i": 0.35,
   "lift_e": 0.37,
   "lsa": 103.75,
   "ic": 1,
   "source": "V-Twin catalog p.20. Exhaust lift .370 in (one source says .374). 2017 107/114 stock cam; the 117 may differ — not separately sourced.",
   "stock": true,
   "unsourced": false
  },
  "stock-rev": {
   "name": "Stock Revolution (V-Rod)",
   "families": [
    "Revolution (V-Rod)"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": null,
   "dur_e": null,
   "dur_basis": null,
   "lift_i": null,
   "lift_e": null,
   "lsa": null,
   "ic": null,
   "source": "No published stock cam specs found — modeled with the stock cam only.",
   "stock": true,
   "unsourced": true
  },
  "andrews-ev13": {
   "name": "Andrews EV13",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 226,
   "dur_e": 238,
   "dur_basis": ".053",
   "lift_i": 0.485,
   "lift_e": 0.495,
   "lsa": 102.0,
   "ic": 31,
   "source": "CCE catalog + Nightrider.",
   "stock": false,
   "unsourced": false
  },
  "andrews-ev27": {
   "name": "Andrews EV27",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 236,
   "dur_e": 240,
   "dur_basis": ".053",
   "lift_i": 0.495,
   "lift_e": 0.495,
   "lsa": 101.0,
   "ic": 36,
   "source": "V-Twin catalog p.20 + Nightrider.",
   "stock": false,
   "unsourced": false
  },
  "andrews-ev46": {
   "name": "Andrews EV46",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 246,
   "dur_e": 246,
   "dur_basis": ".053",
   "lift_i": 0.495,
   "lift_e": 0.495,
   "lsa": 102.0,
   "ic": 41,
   "source": "CCE catalog + Nightrider.",
   "stock": false,
   "unsourced": false
  },
  "andrews-ev59": {
   "name": "Andrews EV59",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 256,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.56,
   "lift_e": 0.56,
   "lsa": 103.0,
   "ic": 48,
   "source": "CCE catalog + Nightrider.",
   "stock": false,
   "unsourced": false
  },
  "andrews-ev3": {
   "name": "Andrews EV3",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 238,
   "dur_e": 238,
   "dur_basis": ".053",
   "lift_i": 0.495,
   "lift_e": 0.495,
   "lsa": 101.0,
   "ic": 37,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-ev5": {
   "name": "Andrews EV5",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 252,
   "dur_e": 252,
   "dur_basis": ".053",
   "lift_i": 0.53,
   "lift_e": 0.53,
   "lsa": 102.0,
   "ic": 44,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-ev23": {
   "name": "Andrews EV23",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 220,
   "dur_e": 228,
   "dur_basis": ".053",
   "lift_i": 0.498,
   "lift_e": 0.498,
   "lsa": 103.0,
   "ic": 30,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-ev38": {
   "name": "Andrews EV38",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 238,
   "dur_e": 252,
   "dur_basis": ".053",
   "lift_i": 0.495,
   "lift_e": 0.5,
   "lsa": 102.0,
   "ic": 37,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-ev7": {
   "name": "Andrews EV7",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 267,
   "dur_e": 266,
   "dur_basis": ".053",
   "lift_i": 0.56,
   "lift_e": 0.56,
   "lsa": 104.3,
   "ic": 56,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-ev81": {
   "name": "Andrews EV81",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 272,
   "dur_e": 276,
   "dur_basis": ".053",
   "lift_i": 0.61,
   "lift_e": 0.61,
   "lsa": 106.0,
   "ic": 60,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "ss-502": {
   "name": "S&S 502 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 248,
   "dur_e": 254,
   "dur_basis": ".053",
   "lift_i": 0.5,
   "lift_e": 0.5,
   "lsa": 99.5,
   "ic": 40,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "ss-520": {
   "name": "S&S 520 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 220,
   "dur_e": 231,
   "dur_basis": ".053",
   "lift_i": 0.52,
   "lift_e": 0.52,
   "lsa": 112.3,
   "ic": 40,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "ss-561": {
   "name": "S&S 561 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 252,
   "dur_e": 256,
   "dur_basis": ".053",
   "lift_i": 0.56,
   "lift_e": 0.56,
   "lsa": 98.0,
   "ic": 40,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "ss-600-evo": {
   "name": "S&S 600 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 255,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.585,
   "lift_e": 0.585,
   "lsa": 108.8,
   "ic": 55,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "ss-631": {
   "name": "S&S 631 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 275,
   "dur_e": 275,
   "dur_basis": ".053",
   "lift_i": 0.63,
   "lift_e": 0.63,
   "lsa": 106.0,
   "ic": 61,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "ss-585-evo": {
   "name": "S&S 585 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 245,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.56,
   "lift_e": 0.56,
   "lsa": 106.3,
   "ic": 45,
   "source": "Nightrider master cam table. Evo 585 lift is .560, NOT .585 (the .585 figure is the Twin Cam version).",
   "stock": false,
   "unsourced": false
  },
  "ss-640-evo": {
   "name": "S&S 640 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 266,
   "dur_e": 265,
   "dur_basis": ".053",
   "lift_i": 0.64,
   "lift_e": 0.64,
   "lsa": 109.8,
   "ic": 60,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-1": {
   "name": "Screamin' Eagle SE-1 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 244,
   "dur_e": 250,
   "dur_basis": ".053",
   "lift_i": 0.495,
   "lift_e": 0.495,
   "lsa": 106.0,
   "ic": 46.5,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-3": {
   "name": "Screamin' Eagle SE-3 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 236,
   "dur_e": 240,
   "dur_basis": ".053",
   "lift_i": 0.503,
   "lift_e": 0.503,
   "lsa": 101.0,
   "ic": 36,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-4": {
   "name": "Screamin' Eagle SE-4 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 236,
   "dur_e": 240,
   "dur_basis": ".053",
   "lift_i": 0.505,
   "lift_e": 0.505,
   "lsa": 102.0,
   "ic": 36,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-11": {
   "name": "Screamin' Eagle SE-11 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 245,
   "dur_e": 250,
   "dur_basis": ".053",
   "lift_i": 0.508,
   "lift_e": 0.508,
   "lsa": 107.8,
   "ic": 47,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-54": {
   "name": "Screamin' Eagle SE-54 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 250,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.546,
   "lift_e": 0.546,
   "lsa": 104.0,
   "ic": 48,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-57": {
   "name": "Screamin' Eagle SE-57 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 252,
   "dur_e": 256,
   "dur_basis": ".053",
   "lift_i": 0.576,
   "lift_e": 0.576,
   "lsa": 106.0,
   "ic": 50,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-60": {
   "name": "Screamin' Eagle SE-60 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 262,
   "dur_e": 265,
   "dur_basis": ".053",
   "lift_i": 0.6,
   "lift_e": 0.6,
   "lsa": 106.8,
   "ic": 56,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-400": {
   "name": "Screamin' Eagle SE-400 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 257,
   "dur_e": 267,
   "dur_basis": ".053",
   "lift_i": 0.5,
   "lift_e": 0.5,
   "lsa": 102.0,
   "ic": 50.5,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-406": {
   "name": "Screamin' Eagle SE-406 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 244,
   "dur_e": 250,
   "dur_basis": ".053",
   "lift_i": 0.48,
   "lift_e": 0.48,
   "lsa": 106.0,
   "ic": 48,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-433": {
   "name": "Screamin' Eagle SE-433 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 250,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.53,
   "lift_e": 0.53,
   "lsa": 104.0,
   "ic": 47,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "jims-1361": {
   "name": "JIMS 1361 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 234,
   "dur_e": 244,
   "dur_basis": ".053",
   "lift_i": 0.5,
   "lift_e": 0.5,
   "lsa": 104.5,
   "ic": 38,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "jims-1362": {
   "name": "JIMS 1362 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 254,
   "dur_e": 258,
   "dur_basis": ".053",
   "lift_i": 0.565,
   "lift_e": 0.565,
   "lsa": 105.0,
   "ic": 50,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "jims-1363": {
   "name": "JIMS 1363 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 264,
   "dur_e": 272,
   "dur_basis": ".053",
   "lift_i": 0.6,
   "lift_e": 0.6,
   "lsa": 108.0,
   "ic": 56,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "jims-1364": {
   "name": "JIMS 1364 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 270,
   "dur_e": 276,
   "dur_basis": ".053",
   "lift_i": 0.66,
   "lift_e": 0.66,
   "lsa": 109.0,
   "ic": 59,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "cyclerama-e617": {
   "name": "Cycle-Rama E617 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 252,
   "dur_e": 252,
   "dur_basis": ".053",
   "lift_i": 0.617,
   "lift_e": 0.617,
   "lsa": 104.0,
   "ic": 50,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "cyclerama-e630": {
   "name": "Cycle-Rama E630 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 258,
   "dur_e": 256,
   "dur_basis": ".053",
   "lift_i": 0.63,
   "lift_e": 0.63,
   "lsa": 113.0,
   "ic": 60,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "cyclerama-e660": {
   "name": "Cycle-Rama E660 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 266,
   "dur_e": 274,
   "dur_basis": ".053",
   "lift_i": 0.66,
   "lift_e": 0.66,
   "lsa": 110.0,
   "ic": 59,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "vthunder-evl2000": {
   "name": "V-Thunder EVL-2000 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 220,
   "dur_e": 216,
   "dur_basis": ".053",
   "lift_i": 0.48,
   "lift_e": 0.456,
   "lsa": 107.5,
   "ic": 38,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "vthunder-evl3000": {
   "name": "V-Thunder EVL-3000 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 224,
   "dur_e": 224,
   "dur_basis": ".053",
   "lift_i": 0.5,
   "lift_e": 0.5,
   "lsa": 102.0,
   "ic": 34,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "vthunder-evl3020": {
   "name": "V-Thunder EVL-3020 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 240,
   "dur_e": 240,
   "dur_basis": ".053",
   "lift_i": 0.5,
   "lift_e": 0.5,
   "lsa": 102.0,
   "ic": 42,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "vthunder-evl3060": {
   "name": "V-Thunder EVL-3060 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 260,
   "dur_e": 270,
   "dur_basis": ".053",
   "lift_i": 0.585,
   "lift_e": 0.585,
   "lsa": 106.0,
   "ic": 56,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "leinweber-e3s": {
   "name": "Leinweber E3S (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": 288,
   "adv_e": 286,
   "dur_i": 250,
   "dur_e": 250,
   "dur_basis": ".050",
   "lift_i": 0.51,
   "lift_e": 0.51,
   "lsa": 106.0,
   "ic": 62,
   "source": "Leinweber Cams PDF (manufacturer).",
   "stock": false,
   "unsourced": false
  },
  "redshift-575": {
   "name": "Red Shift 575 (Evo)",
   "families": [
    "Evolution Big Twin"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 259,
   "dur_e": 261,
   "dur_basis": ".053",
   "lift_i": 0.575,
   "lift_e": 0.575,
   "lsa": 108.5,
   "ic": 54,
   "source": "Nightrider + rbracing.",
   "stock": false,
   "unsourced": false
  },
  "andrews-tw26a": {
   "name": "Andrews TW26A (late chain/gear)",
   "families": [
    "Twin Cam"
   ],
   "adv_i": 262,
   "adv_e": 266,
   "dur_i": 226,
   "dur_e": 230,
   "dur_basis": ".053",
   "lift_i": 0.49,
   "lift_e": 0.49,
   "lsa": 104.0,
   "ic": 35,
   "source": "V-Twin catalog p.21 / Yumpu + Nightrider ('A' variant).",
   "stock": false,
   "unsourced": false
  },
  "andrews-tw37b": {
   "name": "Andrews TW37B (late chain/gear)",
   "families": [
    "Twin Cam"
   ],
   "adv_i": 272,
   "adv_e": 276,
   "dur_i": 236,
   "dur_e": 240,
   "dur_basis": ".053",
   "lift_i": 0.51,
   "lift_e": 0.51,
   "lsa": 106.0,
   "ic": 42,
   "source": "CCE catalog + Nightrider ('B' variant).",
   "stock": false,
   "unsourced": false
  },
  "andrews-tw55": {
   "name": "Andrews TW55",
   "families": [
    "Twin Cam"
   ],
   "adv_i": 283,
   "adv_e": 292,
   "dur_i": 248,
   "dur_e": 252,
   "dur_basis": ".053",
   "lift_i": 0.55,
   "lift_e": 0.55,
   "lsa": 104.0,
   "ic": 46,
   "source": "V-Twin/Yumpu + Nightrider.",
   "stock": false,
   "unsourced": false
  },
  "andrews-57h": {
   "name": "Andrews 57H",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 236,
   "dur_e": 240,
   "dur_basis": ".053",
   "lift_i": 0.56,
   "lift_e": 0.56,
   "lsa": 103.0,
   "ic": 38,
   "source": "Royal Distributing. LSA computed from timing.",
   "stock": false,
   "unsourced": false
  },
  "andrews-tw21": {
   "name": "Andrews TW21",
   "families": [
    "Twin Cam"
   ],
   "adv_i": 255,
   "adv_e": 264,
   "dur_i": 220,
   "dur_e": 228,
   "dur_basis": ".053",
   "lift_i": 0.498,
   "lift_e": 0.498,
   "lsa": 103.0,
   "ic": 30,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-tw31s": {
   "name": "Andrews TW31S",
   "families": [
    "Twin Cam"
   ],
   "adv_i": 272,
   "adv_e": 276,
   "dur_i": 236,
   "dur_e": 240,
   "dur_basis": ".053",
   "lift_i": 0.51,
   "lift_e": 0.51,
   "lsa": 110.0,
   "ic": 46,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-tw44": {
   "name": "Andrews TW44",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 242,
   "dur_e": 246,
   "dur_basis": ".053",
   "lift_i": 0.495,
   "lift_e": 0.495,
   "lsa": 103.0,
   "ic": 41,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-tw50": {
   "name": "Andrews TW50",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 248,
   "dur_e": 252,
   "dur_basis": ".053",
   "lift_i": 0.51,
   "lift_e": 0.51,
   "lsa": 106.0,
   "ic": 48,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-tw59g": {
   "name": "Andrews TW59G",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 266,
   "dur_e": 270,
   "dur_basis": ".053",
   "lift_i": 0.59,
   "lift_e": 0.59,
   "lsa": 106.0,
   "ic": 57,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-tw60": {
   "name": "Andrews TW60",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 260,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.56,
   "lift_e": 0.56,
   "lsa": 107.0,
   "ic": 56,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-tw64g": {
   "name": "Andrews TW64G",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 272,
   "dur_e": 280,
   "dur_basis": ".053",
   "lift_i": 0.64,
   "lift_e": 0.64,
   "lsa": 107.0,
   "ic": 62,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-tw67g": {
   "name": "Andrews TW67G",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 252,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.57,
   "lift_e": 0.57,
   "lsa": 105.0,
   "ic": 48,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "ss-510": {
   "name": "S&S 510",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 238,
   "dur_e": 252,
   "dur_basis": ".053",
   "lift_i": 0.51,
   "lift_e": 0.51,
   "lsa": 102.5,
   "ic": 38,
   "source": "sscycle.com + Nightrider 510C/G.",
   "stock": false,
   "unsourced": false
  },
  "ss-570": {
   "name": "S&S 570",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 240,
   "dur_e": 255,
   "dur_basis": ".053",
   "lift_i": 0.57,
   "lift_e": 0.57,
   "lsa": 103.75,
   "ic": 40,
   "source": "sscycle.com + Nightrider 570G.",
   "stock": false,
   "unsourced": false
  },
  "ss-585": {
   "name": "S&S 585",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 245,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.585,
   "lift_e": 0.585,
   "lsa": 106.25,
   "ic": 45,
   "source": "sscycle.com + Nightrider 585G.",
   "stock": false,
   "unsourced": false
  },
  "ss-640": {
   "name": "S&S 640",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 265,
   "dur_e": 270,
   "dur_basis": ".053",
   "lift_i": 0.64,
   "lift_e": 0.64,
   "lsa": 108.75,
   "ic": 60,
   "source": "sscycle.com + Nightrider 640G.",
   "stock": false,
   "unsourced": false
  },
  "ss-546g": {
   "name": "S&S 546G",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 240,
   "dur_e": 237,
   "dur_basis": ".053",
   "lift_i": 0.546,
   "lift_e": 0.546,
   "lsa": 114.3,
   "ic": 55,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "ss-625g": {
   "name": "S&S 625G",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 255,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.625,
   "lift_e": 0.625,
   "lsa": 108.8,
   "ic": 55,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "ss-675g": {
   "name": "S&S 675G",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 269,
   "dur_e": 275,
   "dur_basis": ".053",
   "lift_i": 0.675,
   "lift_e": 0.675,
   "lsa": 111.0,
   "ic": 64,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "wood-tw6": {
   "name": "Wood TW-6",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 240,
   "dur_e": 240,
   "dur_basis": ".053",
   "lift_i": 0.51,
   "lift_e": 0.51,
   "lsa": 101.0,
   "ic": 40,
   "source": "Wood catalog + Nightrider TW-6G.",
   "stock": false,
   "unsourced": false
  },
  "wood-tw777": {
   "name": "Wood TW-777",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 244,
   "dur_e": 244,
   "dur_basis": ".053",
   "lift_i": 0.575,
   "lift_e": 0.575,
   "lsa": 101.0,
   "ic": 42,
   "source": "Wood catalog. A secondary source claims 255/260, .625 — catalog trusted.",
   "stock": false,
   "unsourced": false
  },
  "wood-tw5g": {
   "name": "Wood TW-5G",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 234,
   "dur_e": 234,
   "dur_basis": ".053",
   "lift_i": 0.575,
   "lift_e": 0.575,
   "lsa": 101.0,
   "ic": 37,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "wood-tw62g": {
   "name": "Wood TW-62G",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 262,
   "dur_e": 262,
   "dur_basis": ".053",
   "lift_i": 0.652,
   "lift_e": 0.652,
   "lsa": 101.0,
   "ic": 51,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "wood-tw68g": {
   "name": "Wood TW-68G",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 268,
   "dur_e": 268,
   "dur_basis": ".053",
   "lift_i": 0.678,
   "lift_e": 0.678,
   "lsa": 106.0,
   "ic": 58,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "wood-tw72g": {
   "name": "Wood TW-72G",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 268,
   "dur_e": 268,
   "dur_basis": ".053",
   "lift_i": 0.72,
   "lift_e": 0.72,
   "lsa": 101.0,
   "ic": 54,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "wood-tw8g": {
   "name": "Wood TW-8G",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 246,
   "dur_e": 246,
   "dur_basis": ".053",
   "lift_i": 0.59,
   "lift_e": 0.59,
   "lsa": 105.0,
   "ic": 47,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "wood-tw9g": {
   "name": "Wood TW-9G",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 252,
   "dur_e": 252,
   "dur_basis": ".053",
   "lift_i": 0.58,
   "lift_e": 0.58,
   "lsa": 105.0,
   "ic": 50,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "wood-tw9bg": {
   "name": "Wood TW-9BG",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 252,
   "dur_e": 252,
   "dur_basis": ".053",
   "lift_i": 0.63,
   "lift_e": 0.63,
   "lsa": 105.0,
   "ic": 50,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "wood-tw9fg": {
   "name": "Wood TW-9FG",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 256,
   "dur_e": 256,
   "dur_basis": ".053",
   "lift_i": 0.65,
   "lift_e": 0.65,
   "lsa": 105.0,
   "ic": 52,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "feuling-543": {
   "name": "Feuling Reaper 543",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 238,
   "dur_e": 248,
   "dur_basis": "unstated (likely .050)",
   "lift_i": 0.543,
   "lift_e": 0.553,
   "lsa": 108.0,
   "ic": 43,
   "source": "HarleyTechTalk (rigidthumper) + HTT comparator. LSA computed.",
   "stock": false,
   "unsourced": false
  },
  "redshift-577": {
   "name": "Zippers Red Shift 577",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 251,
   "dur_e": 255,
   "dur_basis": ".053",
   "lift_i": 0.577,
   "lift_e": 0.577,
   "lsa": 103.0,
   "ic": 46,
   "source": "Nightrider 577TC + rbracing. Zippers' own 2019 matrix lists 252/252, LSA 102 — possible later revision.",
   "stock": false,
   "unsourced": false
  },
  "redshift-557tc": {
   "name": "Zippers Red Shift 557TC",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 242,
   "dur_e": 242,
   "dur_basis": ".053",
   "lift_i": 0.557,
   "lift_e": 0.557,
   "lsa": 106.0,
   "ic": 46,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "redshift-627tc": {
   "name": "Zippers Red Shift 627TC",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 263,
   "dur_e": 266,
   "dur_basis": ".053",
   "lift_i": 0.627,
   "lift_e": 0.627,
   "lsa": 103.8,
   "ic": 54,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "redshift-647tc": {
   "name": "Zippers Red Shift 647TC",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 264,
   "dur_e": 264,
   "dur_basis": ".053",
   "lift_i": 0.647,
   "lift_e": 0.647,
   "lsa": 106.0,
   "ic": 58,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "redshift-657tc": {
   "name": "Zippers Red Shift 657TC",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 253,
   "dur_e": 254,
   "dur_basis": ".053",
   "lift_i": 0.657,
   "lift_e": 0.657,
   "lsa": 108.3,
   "ic": 52,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "redshift-727tc": {
   "name": "Zippers Red Shift 727TC",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 281,
   "dur_e": 282,
   "dur_basis": ".053",
   "lift_i": 0.729,
   "lift_e": 0.729,
   "lsa": 106.3,
   "ic": 65,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-211": {
   "name": "Screamin' Eagle SE-211",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 248,
   "dur_e": 256,
   "dur_basis": ".053",
   "lift_i": 0.508,
   "lift_e": 0.508,
   "lsa": 106.0,
   "ic": 45,
   "source": "Nightrider master cam table (compilation, not an H-D factory sheet) — the only published SE-211 numbers found.",
   "stock": false,
   "unsourced": false
  },
  "se-255": {
   "name": "Screamin' Eagle SE-255",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 211,
   "dur_e": 235,
   "dur_basis": ".053",
   "lift_i": 0.55,
   "lift_e": 0.55,
   "lsa": 105.0,
   "ic": 24,
   "source": "HTT TTS100 measured + forum summary (measured, not factory-published). Lift .550–.556 measured; intake closes ~24–25 deg.",
   "stock": false,
   "unsourced": false
  },
  "se-259e": {
   "name": "Screamin' Eagle SE-259E",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 246,
   "dur_e": 250,
   "dur_basis": ".053",
   "lift_i": 0.579,
   "lift_e": 0.579,
   "lsa": 108.5,
   "ic": 47,
   "source": "JustAnswer quoting H-D + HDForums. Duration computed from timing.",
   "stock": false,
   "unsourced": false
  },
  "se-585": {
   "name": "Screamin' Eagle SE-585",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 234,
   "dur_e": 240,
   "dur_basis": ".053",
   "lift_i": 0.584,
   "lift_e": 0.584,
   "lsa": 103.0,
   "ic": 36,
   "source": "H-D TSB PA-1040 via oemdtc.com.",
   "stock": false,
   "unsourced": false
  },
  "se-251": {
   "name": "Screamin' Eagle SE-251",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 244,
   "dur_e": 250,
   "dur_basis": ".053",
   "lift_i": 0.579,
   "lift_e": 0.579,
   "lsa": 107.5,
   "ic": 46,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-201": {
   "name": "Screamin' Eagle SE-201",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 246,
   "dur_e": 252,
   "dur_basis": ".053",
   "lift_i": 0.511,
   "lift_e": 0.511,
   "lsa": 111.5,
   "ic": 54,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-203": {
   "name": "Screamin' Eagle SE-203",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 234,
   "dur_e": 239,
   "dur_basis": ".053",
   "lift_i": 0.51,
   "lift_e": 0.51,
   "lsa": 100.8,
   "ic": 36,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-204": {
   "name": "Screamin' Eagle SE-204",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 236,
   "dur_e": 240,
   "dur_basis": ".053",
   "lift_i": 0.508,
   "lift_e": 0.508,
   "lsa": 104.0,
   "ic": 34,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-253": {
   "name": "Screamin' Eagle SE-253",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 240,
   "dur_e": 256,
   "dur_basis": ".053",
   "lift_i": 0.538,
   "lift_e": 0.538,
   "lsa": 112.0,
   "ic": 53,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-257": {
   "name": "Screamin' Eagle SE-257",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 252,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.569,
   "lift_e": 0.569,
   "lsa": 105.5,
   "ic": 48,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-258": {
   "name": "Screamin' Eagle SE-258",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 258,
   "dur_e": 268,
   "dur_basis": ".053",
   "lift_i": 0.569,
   "lift_e": 0.569,
   "lsa": 107.0,
   "ic": 52,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-260": {
   "name": "Screamin' Eagle SE-260",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 263,
   "dur_e": 269,
   "dur_basis": ".053",
   "lift_i": 0.609,
   "lift_e": 0.609,
   "lsa": 107.0,
   "ic": 55,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-264": {
   "name": "Screamin' Eagle SE-264",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 264,
   "dur_e": 262,
   "dur_basis": ".053",
   "lift_i": 0.635,
   "lift_e": 0.635,
   "lsa": 108.5,
   "ic": 60,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "crane-htc290": {
   "name": "Crane HTC-290-2",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 240,
   "dur_e": 248,
   "dur_basis": ".053",
   "lift_i": 0.57,
   "lift_e": 0.57,
   "lsa": 102.0,
   "ic": 42,
   "source": "Nightrider + rbracing.",
   "stock": false,
   "unsourced": false
  },
  "crane-htc296": {
   "name": "Crane HTC-296-2",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 246,
   "dur_e": 254,
   "dur_basis": ".053",
   "lift_i": 0.6,
   "lift_e": 0.6,
   "lsa": 104.0,
   "ic": 46,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "crane-htc300": {
   "name": "Crane HTC-300-2",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 226,
   "dur_e": 236,
   "dur_basis": ".053",
   "lift_i": 0.505,
   "lift_e": 0.505,
   "lsa": 102.0,
   "ic": 33,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "crane-htc304": {
   "name": "Crane HTC-304-2",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 254,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.6,
   "lift_e": 0.6,
   "lsa": 104.0,
   "ic": 49,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "crane-htc310": {
   "name": "Crane HTC-310-2",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 236,
   "dur_e": 242,
   "dur_basis": ".053",
   "lift_i": 0.505,
   "lift_e": 0.505,
   "lsa": 102.0,
   "ic": 36,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "crane-htc316": {
   "name": "Crane HTC-316-2",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 242,
   "dur_e": 252,
   "dur_basis": ".053",
   "lift_i": 0.505,
   "lift_e": 0.505,
   "lsa": 102.0,
   "ic": 43,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "leinweber-ret3s": {
   "name": "Leinweber RE-T3S (Twin Cam)",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 238,
   "dur_e": 242,
   "dur_basis": ".053",
   "lift_i": 0.51,
   "lift_e": 0.51,
   "lsa": 106.0,
   "ic": 41,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "leinweber-ret5s": {
   "name": "Leinweber RE-T5S (Twin Cam)",
   "families": [
    "Twin Cam"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 244,
   "dur_e": 248,
   "dur_basis": ".053",
   "lift_i": 0.56,
   "lift_e": 0.56,
   "lsa": 105.0,
   "ic": 40,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "comp-mega8": {
   "name": "Comp Cams Mega 8 246/252 (M8)",
   "families": [
    "Milwaukee-Eight"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 246,
   "dur_e": 252,
   "dur_basis": "unstated",
   "lift_i": 0.472,
   "lift_e": 0.472,
   "lsa": 110.0,
   "ic": null,
   "source": "wulfmoto.com (secondary source — flag). Duration basis unstated; intake closing not published.",
   "stock": false,
   "unsourced": false
  },
  "andrews-v2": {
   "name": "Andrews V2 / N2 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 240,
   "dur_e": 244,
   "dur_basis": ".053",
   "lift_i": 0.465,
   "lift_e": 0.44,
   "lsa": 101.0,
   "ic": 38,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-v4": {
   "name": "Andrews V4 / N4 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 256,
   "dur_e": 256,
   "dur_basis": ".053",
   "lift_i": 0.49,
   "lift_e": 0.49,
   "lsa": 101.0,
   "ic": 46,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-v6": {
   "name": "Andrews V6 / N6 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 264,
   "dur_e": 264,
   "dur_basis": ".053",
   "lift_i": 0.49,
   "lift_e": 0.49,
   "lsa": 101.0,
   "ic": 50,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-v9": {
   "name": "Andrews V9 / N9 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 266,
   "dur_e": 266,
   "dur_basis": ".053",
   "lift_i": 0.555,
   "lift_e": 0.555,
   "lsa": 100.0,
   "ic": 53,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "andrews-bv": {
   "name": "Andrews BV / NV (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 274,
   "dur_e": 274,
   "dur_basis": ".053",
   "lift_i": 0.59,
   "lift_e": 0.59,
   "lsa": 102.0,
   "ic": 59,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "redshift-531v2": {
   "name": "Red Shift 531V2 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 259,
   "dur_e": 259,
   "dur_basis": ".053",
   "lift_i": 0.525,
   "lift_e": 0.525,
   "lsa": 106.0,
   "ic": 51,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "redshift-567v2": {
   "name": "Red Shift 567V2 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 251,
   "dur_e": 251,
   "dur_basis": ".053",
   "lift_i": 0.575,
   "lift_e": 0.575,
   "lsa": 105.0,
   "ic": 48,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "redshift-573v2": {
   "name": "Red Shift 573V2 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 259,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.58,
   "lift_e": 0.58,
   "lsa": 109.8,
   "ic": 56,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "redshift-585v2": {
   "name": "Red Shift 585V2 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 259,
   "dur_e": 259,
   "dur_basis": ".053",
   "lift_i": 0.58,
   "lift_e": 0.58,
   "lsa": 112.5,
   "ic": 58,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "redshift-623v2": {
   "name": "Red Shift 623V2 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 273,
   "dur_e": 273,
   "dur_basis": ".053",
   "lift_i": 0.623,
   "lift_e": 0.623,
   "lsa": 108.0,
   "ic": 62,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "redshift-625v2": {
   "name": "Red Shift 625V2 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 270,
   "dur_e": 271,
   "dur_basis": ".053",
   "lift_i": 0.625,
   "lift_e": 0.625,
   "lsa": 104.8,
   "ic": 58,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "redshift-643v2": {
   "name": "Red Shift 643V2 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 268,
   "dur_e": 268,
   "dur_basis": ".053",
   "lift_i": 0.645,
   "lift_e": 0.645,
   "lsa": 111.5,
   "ic": 61,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "ss-500-xl": {
   "name": "S&S 500 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 264,
   "dur_e": 264,
   "dur_basis": ".053",
   "lift_i": 0.5,
   "lift_e": 0.5,
   "lsa": 101.0,
   "ic": 50,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "ss-555-xl": {
   "name": "S&S 555 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 266,
   "dur_e": 266,
   "dur_basis": ".053",
   "lift_i": 0.555,
   "lift_e": 0.555,
   "lsa": 100.0,
   "ic": 53,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "ss-600-xl": {
   "name": "S&S 600 (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 255,
   "dur_e": 260,
   "dur_basis": ".053",
   "lift_i": 0.6,
   "lift_e": 0.6,
   "lsa": 108.8,
   "ic": 55,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-boltin-xl": {
   "name": "Screamin' Eagle Bolt-In (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 256,
   "dur_e": 256,
   "dur_basis": ".053",
   "lift_i": 0.497,
   "lift_e": 0.497,
   "lsa": 102.0,
   "ic": 48,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  },
  "se-hiperf-xl": {
   "name": "Screamin' Eagle Hi-Performance (Sportster)",
   "families": [
    "Evolution Sportster"
   ],
   "adv_i": null,
   "adv_e": null,
   "dur_i": 256,
   "dur_e": 265,
   "dur_basis": ".053",
   "lift_i": 0.536,
   "lift_e": 0.536,
   "lsa": 102.3,
   "ic": 50,
   "source": "Nightrider master cam table.",
   "stock": false,
   "unsourced": false
  }
 },
 "EXHAUSTS": {
  "stock": {
   "name": "Stock mufflers",
   "hp": 1.0,
   "tq": 1.0,
   "top_end": 0.0,
   "note": "Factory mufflers."
  },
  "slip-ons": {
   "name": "Slip-on mufflers",
   "hp": 1.03,
   "tq": 1.02,
   "top_end": 0.05,
   "note": "Typical Stage 1 slip-ons; small gain everywhere."
  },
  "two-into-1": {
   "name": "2-into-1",
   "hp": 1.07,
   "tq": 1.06,
   "top_end": 0.15,
   "note": "Best all-round pipe for torque; the usual pick."
  },
  "true-duals": {
   "name": "True duals",
   "hp": 1.05,
   "tq": 1.04,
   "top_end": 0.1,
   "note": "Good top end, slightly less midrange than 2-into-1."
  },
  "drag-pipes": {
   "name": "Drag pipes (open)",
   "hp": 1.03,
   "tq": 0.97,
   "top_end": 0.2,
   "note": "Top-end bark, costs low-end torque. No baffles."
  },
  "short-shots": {
   "name": "Short shots",
   "hp": 1.02,
   "tq": 0.98,
   "top_end": 0.1,
   "note": "Short pipes; some low-end loss, mostly noise."
  }
 },
 "HEADS": {
  "stock": {
   "name": "Stock heads",
   "hp": 1.0,
   "tq": 1.0,
   "top_end": 0.0,
   "note": "As cast."
  },
  "pocket-port": {
   "name": "Pocket port / clean-up",
   "hp": 1.04,
   "tq": 1.03,
   "top_end": 0.05,
   "note": "Bowl blend and clean-up, stock valves."
  },
  "full-port": {
   "name": "Fully ported",
   "hp": 1.08,
   "tq": 1.05,
   "top_end": 0.1,
   "note": "Full port job, stock valve sizes."
  },
  "big-valve": {
   "name": "Big valves + full port",
   "hp": 1.11,
   "tq": 1.07,
   "top_end": 0.15,
   "note": "Oversize valves with a full port job."
  }
 },
 "AIR_CLEANERS": {
  "stock": {
   "name": "Stock air cleaner",
   "hp": 1.0,
   "tq": 1.0,
   "note": "Factory airbox."
  },
  "high-flow": {
   "name": "High-flow air cleaner",
   "hp": 1.02,
   "tq": 1.01,
   "note": "Big Sucker / Stealth / K&N style. Worth ~2% with a freer pipe."
  }
 },
 "FUELS": {
  "pump": {
   "name": "Pump gas (91 octane)",
   "hp": 1.0,
   "tq": 1.0,
   "note": "Baseline fuel."
  },
  "race": {
   "name": "Race gas (100+ octane)",
   "hp": 1.0,
   "tq": 1.0,
   "note": "No gain on its own — it only lets high compression / aggressive timing run without detonation."
  }
 },
 "PRESETS": {
  "fatboy": {
   "label": "1995 Fat Boy (1340)",
   "combo": {
    "baseline": "evo-1340",
    "displacement_ci": null,
    "compression": null,
    "carb": "ss-e",
    "cam": "stock-evo",
    "exhaust": "drag-pipes",
    "heads": "stock",
    "air": "high-flow",
    "fuel": "pump",
    "rev_limit": null
   }
  },
  "softail90": {
   "label": "1990 Softail (1340)",
   "combo": {
    "baseline": "evo-1340",
    "displacement_ci": null,
    "compression": null,
    "carb": "cv40",
    "cam": "stock-evo",
    "exhaust": "drag-pipes",
    "heads": "stock",
    "air": "stock",
    "fuel": "pump",
    "rev_limit": null
   }
  },
  "knuckle": {
   "label": "1947 Knucklehead (74)",
   "combo": {
    "baseline": "knuckle-74",
    "displacement_ci": null,
    "compression": null,
    "carb": "linkert-m74b",
    "cam": "stock-knuckle",
    "exhaust": "stock",
    "heads": "stock",
    "air": "stock",
    "fuel": "pump",
    "rev_limit": null
   }
  }
 }
};

// ---------------------------------------------------------------- model

var IDLE_TQ_FRACTION = 0.62;
var RISE_EXPONENT = 0.8;
var FALL_EXPONENT = 1.3;
var CAM_RPM_PER_DEG = 15.0;
var CAM_TQ_PER_DEG = 0.0012;
var CAM_TQ_PER_LIFT = 0.5;
var CARB_LOG_GAIN = 0.35;
var COMP_PER_POINT = 0.028;
var DISP_EXPONENT = 0.95;
var REDLINE_PER_CAM_DEG = 10.0;

function UnsupportedError(message) {
  this.name = "UnsupportedError";
  this.message = message || "";
  if (Error.captureStackTrace) Error.captureStackTrace(this, UnsupportedError);
}
UnsupportedError.prototype = Object.create(Error.prototype);
UnsupportedError.prototype.constructor = UnsupportedError;

function roundTo(x, digits) {
  var p = Math.pow(10, digits);
  return Math.round(x * p) / p;
}
function clamp(x, lo, hi) { return Math.min(Math.max(x, lo), hi); }

function areaRatio(boreMm, stockBoreMm) {
  return Math.pow(boreMm / stockBoreMm, 2);
}

function torqueAt(rpm, peakTq, peakTqRpm, redline, decline, exponent) {
  if (rpm <= peakTqRpm) {
    var frac = peakTqRpm ? rpm / peakTqRpm : 1.0;
    return peakTq * (IDLE_TQ_FRACTION +
      (1.0 - IDLE_TQ_FRACTION) * Math.pow(frac, RISE_EXPONENT));
  }
  var span = Math.max(redline - peakTqRpm, 1);
  var x = Math.min((rpm - peakTqRpm) / span, 1.0);
  return peakTq * (1.0 - decline * Math.pow(x, exponent));
}

function curve(peakTq, peakTqRpm, redline, decline, exponent, step) {
  exponent = (exponent === undefined) ? FALL_EXPONENT : exponent;
  step = step || 100;
  var points = [];
  var rpm = 1200;
  while (rpm <= redline) {
    var tq = torqueAt(rpm, peakTq, peakTqRpm, redline, decline, exponent);
    points.push([rpm, roundTo(tq, 1), roundTo(tq * rpm / 5252.0, 1)]);
    rpm += step;
  }
  if (points[points.length - 1][0] !== redline) {
    var tqLast = torqueAt(redline, peakTq, peakTqRpm, redline, decline, exponent);
    points.push([redline, roundTo(tqLast, 1), roundTo(tqLast * redline / 5252.0, 1)]);
  }
  return points;
}

function calibrateDecline(baseline, exponent) {
  var target = baseline.stock_hp;
  var lo = 0.05, hi = 0.60;
  for (var i = 0; i < 24; i++) {
    var mid = (lo + hi) / 2.0;
    var c = curve(baseline.stock_tq, baseline.stock_tq_rpm,
      baseline.redline, mid, exponent);
    var peakHp = 0;
    for (var j = 0; j < c.length; j++) peakHp = Math.max(peakHp, c[j][2]);
    if (peakHp > target) lo = mid; else hi = mid;
  }
  return roundTo((lo + hi) / 2.0, 4);
}

function calibrate(baseline) {
  var best = null;
  var exponents = [1.2, 1.5, 1.8, 2.1, 2.4, 2.8, 3.2, 4.0];
  for (var k = 0; k < exponents.length; k++) {
    var exponent = exponents[k];
    var decline = calibrateDecline(baseline, exponent);
    var c = curve(baseline.stock_tq, baseline.stock_tq_rpm,
      baseline.redline, decline, exponent);
    var peak = c[0];
    for (var j = 1; j < c.length; j++) if (c[j][2] > peak[2]) peak = c[j];
    var err = Math.abs(peak[0] - baseline.stock_hp_rpm);
    if (best === null || err < best[0]) best = [err, decline, exponent];
  }
  return [best[1], best[2]];
}

var _calibrated = {};
function stockFalloff(baselineKey) {
  if (!Object.prototype.hasOwnProperty.call(_calibrated, baselineKey)) {
    _calibrated[baselineKey] = calibrate(DATA.BASELINES[baselineKey]);
  }
  return _calibrated[baselineKey];
}

function stockCombo(baselineKey) {
  var b = DATA.BASELINES[baselineKey];
  return {
    baseline: baselineKey,
    displacement_ci: b.disp_ci,
    compression: b.compression,
    carb: b.stock_carb,
    cam: b.stock_cam,
    exhaust: "stock",
    heads: "stock",
    air: "stock",
    fuel: "pump",
    rev_limit: null
  };
}

function estimate(combo) {
  var key = combo.baseline;
  if (!Object.prototype.hasOwnProperty.call(DATA.BASELINES, key)) {
    throw new UnsupportedError(
      "No published stock baseline for '" + key + "' — this family is not " +
      "supported yet, and the dyno will not guess.");
  }
  var b = DATA.BASELINES[key];
  var factors = [];
  var warnings = [];
  if (b.tq_estimated) {
    warnings.push("Peak torque for this engine was never published — " +
      "the baseline torque is estimated from published HP " +
      "(peak = 1.15 x HP x 5252 / HP-rpm). Treat the " +
      "torque curve as rough.");
  }

  // --- displacement ---
  var disp = (combo.displacement_ci !== undefined && combo.displacement_ci !== null)
    ? combo.displacement_ci : b.disp_ci;
  if (disp <= 0) throw new Error("displacement must be positive");
  var dispFactor = Math.pow(disp / b.disp_ci, DISP_EXPONENT);
  if (Math.abs(disp - b.disp_ci) > 0.5) {
    factors.push(["Displacement " + b.disp_ci + " -> " + disp + " ci", dispFactor]);
  }

  // --- compression ---
  var cr = (combo.compression !== undefined && combo.compression !== null)
    ? combo.compression : b.compression;
  var compFactor = clamp(1.0 + COMP_PER_POINT * (cr - b.compression), 0.90, 1.15);
  if (Math.abs(cr - b.compression) > 0.05) {
    factors.push(["Compression " + b.compression.toFixed(1) + " -> " + cr.toFixed(1) + ":1", compFactor]);
  }
  if (cr >= 10.5 && combo.fuel === "pump") {
    warnings.push("Compression " + cr.toFixed(1) + ":1 on pump gas risks detonation — " +
      "race gas and careful timing are the usual answer.");
  }

  // --- carb / induction ---
  var carbKey = combo.carb || b.stock_carb;
  if (!Object.prototype.hasOwnProperty.call(DATA.CARBS, carbKey)) {
    throw new UnsupportedError("Carb '" + carbKey + "' is not cataloged — no published " +
      "bore/flow on file.");
  }
  var carb = DATA.CARBS[carbKey];
  var stockCarb = DATA.CARBS[b.stock_carb];
  var carbLog, carbLabel;
  if (carb.flow_cfm && stockCarb.flow_cfm) {
    var ratio = carb.flow_cfm / stockCarb.flow_cfm;
    carbLog = Math.log(ratio);
    carbLabel = carb.name + " (" + carb.flow_cfm + " CFM) vs stock " +
      stockCarb.name + " (" + stockCarb.flow_cfm + " CFM)";
  } else {
    var area = areaRatio(carb.bore_mm, stockCarb.bore_mm);
    carbLog = Math.log(area);
    carbLabel = carb.name + " (" + carb.bore_mm + " mm venturi) vs stock " +
      stockCarb.name + " (" + stockCarb.bore_mm + " mm)";
  }
  var carbFactor = clamp(1.0 + CARB_LOG_GAIN * carbLog, 0.85, 1.25);
  var topEnd = 0.5 * carbLog;
  if (carbKey !== b.stock_carb) factors.push([carbLabel, carbFactor]);
  if (!carb.flow_cfm) {
    warnings.push(carb.name + ": no published flow (CFM) on file — the " +
      "estimate uses venturi area only.");
  }

  // --- cam ---
  var camKey = combo.cam || b.stock_cam;
  if (!Object.prototype.hasOwnProperty.call(DATA.CAMS, camKey)) {
    throw new UnsupportedError("Cam '" + camKey + "' is not cataloged — no published " +
      "specs on file.");
  }
  var cam = DATA.CAMS[camKey];
  var stockCam = DATA.CAMS[b.stock_cam];
  var durDelta = 0, camFactor = 1.0, peakShift = 0.0;
  if (cam.dur_i === null || cam.dur_i === undefined ||
      stockCam.dur_i === null || stockCam.dur_i === undefined) {
    if (camKey !== b.stock_cam) {
      throw new UnsupportedError("No published duration for " + cam.name +
        " — the dyno can't model that cam swap.");
    }
  } else {
    durDelta = cam.dur_i - stockCam.dur_i;
    var liftDelta = cam.lift_i - stockCam.lift_i;
    camFactor = clamp(1.0 + CAM_TQ_PER_DEG * durDelta + CAM_TQ_PER_LIFT * liftDelta, 0.95, 1.25);
    peakShift = CAM_RPM_PER_DEG * durDelta;
    topEnd += 0.004 * durDelta;
  }
  if (camKey !== b.stock_cam) {
    factors.push([cam.name + ": " + cam.dur_i + " deg @" + cam.dur_basis + ", " +
      cam.lift_i.toFixed(3) + " in lift", camFactor]);
  }
  if (cam.ic === null || cam.ic === undefined) {
    warnings.push(cam.name + ": intake closing point not published — " +
      "dynamic compression is not modeled.");
  }

  // --- bolt-ons ---
  var exhaust = DATA.EXHAUSTS[combo.exhaust || "stock"];
  var heads = DATA.HEADS[combo.heads || "stock"];
  var air = DATA.AIR_CLEANERS[combo.air || "stock"];
  var fuel = DATA.FUELS[combo.fuel || "pump"];
  topEnd += exhaust.top_end + heads.top_end;
  var boltOns = [
    ["Exhaust", DATA.EXHAUSTS, combo.exhaust || "stock"],
    ["Heads", DATA.HEADS, combo.heads || "stock"],
    ["Air cleaner", DATA.AIR_CLEANERS, combo.air || "stock"]
  ];
  for (var i = 0; i < boltOns.length; i++) {
    var label = boltOns[i][0], table = boltOns[i][1], choice = boltOns[i][2];
    if (choice !== "stock") {
      factors.push([label + ": " + table[choice].name, table[choice].tq]);
    }
  }
  if (combo.fuel === "race" && cr > 10.5) {
    factors.push(["Race gas (lets " + cr.toFixed(1) + ":1 run)", 1.02]);
  }

  // --- combine ---
  var peakTq = b.stock_tq * dispFactor * compFactor * carbFactor *
    camFactor * exhaust.tq * heads.tq * air.tq;
  if (combo.fuel === "race" && cr > 10.5) peakTq *= 1.02;
  var peakTqRpm = Math.round(b.stock_tq_rpm + peakShift + 100 * carbLog);
  peakTqRpm = clamp(peakTqRpm, 1500, b.redline - 500);
  var redline = b.redline + Math.max(0, Math.round(REDLINE_PER_CAM_DEG * durDelta));
  if (combo.rev_limit) redline = Math.min(redline, Math.round(combo.rev_limit));
  var falloff = stockFalloff(key);
  var decline = clamp(falloff[0] - 0.12 * clamp(topEnd, -0.3, 1.0), 0.08, 0.60);
  var exponent = falloff[1];

  var c = curve(peakTq, peakTqRpm, redline, decline, exponent);
  var peakHpPt = c[0], peakTqPt = c[0];
  for (var j = 1; j < c.length; j++) {
    if (c[j][2] > peakHpPt[2]) peakHpPt = c[j];
    if (c[j][1] > peakTqPt[1]) peakTqPt = c[j];
  }

  return {
    baseline: key,
    family: b.family,
    variant: b.variant,
    peak_hp: peakHpPt[2],
    peak_hp_rpm: peakHpPt[0],
    peak_tq: peakTqPt[1],
    peak_tq_rpm: peakTqPt[0],
    redline: redline,
    displacement_ci: disp,
    compression: cr,
    curve: c,
    factors: factors.map(function (f) { return [f[0], roundTo(f[1], 3)]; }),
    warnings: warnings,
    stock_hp: b.stock_hp,
    stock_hp_rpm: b.stock_hp_rpm,
    stock_tq: b.stock_tq,
    stock_tq_rpm: b.stock_tq_rpm,
    source: b.source
  };
}

function compare(comboA, comboB) {
  var a = estimate(comboA), b = estimate(comboB);
  return [a, b, {
    hp: roundTo(b.peak_hp - a.peak_hp, 1),
    hp_pct: roundTo(100.0 * (b.peak_hp - a.peak_hp) / a.peak_hp, 1),
    tq: roundTo(b.peak_tq - a.peak_tq, 1),
    tq_pct: roundTo(100.0 * (b.peak_tq - a.peak_tq) / a.peak_tq, 1)
  }];
}

// ---------------------------------------------------------------- SAE

function pressureKpa(altitudeFt) {
  var h = altitudeFt * 0.3048;
  return 101.325 * Math.pow(1.0 - 2.25577e-5 * h, 5.25588);
}

function saeCorrectionFactor(tempF, altitudeFt, relHumidity) {
  relHumidity = relHumidity || 0.0;
  var tc = (tempF - 32.0) * 5.0 / 9.0;
  var p = pressureKpa(altitudeFt);
  var pSat = 0.61094 * Math.exp(17.625 * tc / (tc + 243.04));
  var pDry = p - pSat * (relHumidity / 100.0);
  return 1.18 * (99.0 / pDry) * Math.sqrt((tc + 273.0) / 298.0) - 0.18;
}

function applySae(result, tempF, altitudeFt, relHumidity) {
  var cf = saeCorrectionFactor(tempF, altitudeFt, relHumidity);
  return [roundTo(result.peak_hp / cf, 1), roundTo(result.peak_tq / cf, 1), roundTo(cf, 3)];
}

// ---------------------------------------------------------------- validation

function validateData() {
  var problems = [];
  var key, b, c, field;
  var baselineKeys = Object.keys(DATA.BASELINES);
  for (var i = 0; i < baselineKeys.length; i++) {
    key = baselineKeys[i]; b = DATA.BASELINES[key];
    var req = ["family", "variant", "source", "stock_carb", "stock_cam"];
    for (var j = 0; j < req.length; j++) {
      if (!b[req[j]]) problems.push("baseline " + key + ": missing " + req[j]);
    }
    var nums = ["disp_ci", "disp_cc", "compression", "stock_hp",
      "stock_hp_rpm", "stock_tq", "stock_tq_rpm", "redline"];
    for (var k = 0; k < nums.length; k++) {
      if (typeof b[nums[k]] !== "number" || b[nums[k]] <= 0) {
        problems.push("baseline " + key + ": bad " + nums[k]);
      }
    }
    if (!Object.prototype.hasOwnProperty.call(DATA.CARBS, b.stock_carb)) {
      problems.push("baseline " + key + ": stock carb " + b.stock_carb + " not in catalog");
    }
    if (!Object.prototype.hasOwnProperty.call(DATA.CAMS, b.stock_cam)) {
      problems.push("baseline " + key + ": stock cam " + b.stock_cam + " not in catalog");
    }
  }
  var carbKeys = Object.keys(DATA.CARBS);
  for (var m = 0; m < carbKeys.length; m++) {
    key = carbKeys[m]; c = DATA.CARBS[key];
    if (!c.source) problems.push("carb " + key + ": missing source");
    if (typeof c.bore_mm !== "number" || c.bore_mm <= 0) {
      problems.push("carb " + key + ": bad bore_mm");
    }
  }
  var camKeys = Object.keys(DATA.CAMS);
  for (var n = 0; n < camKeys.length; n++) {
    key = camKeys[n]; c = DATA.CAMS[key];
    if (!c.source) problems.push("cam " + key + ": missing source");
    if (!c.families || !c.families.length) problems.push("cam " + key + ": missing families");
    if (c.unsourced) {
      if (!c.stock) problems.push("cam " + key + ": unsourced non-stock cam");
      if ((c.source || "").toLowerCase().indexOf("no published") === -1) {
        problems.push("cam " + key + ": unsourced entry must say so");
      }
      continue;
    }
    var fields = ["dur_i", "dur_e", "lift_i", "lift_e"];
    for (var q = 0; q < fields.length; q++) {
      field = fields[q];
      if (typeof c[field] !== "number" || c[field] <= 0) {
        problems.push("cam " + key + ": bad " + field);
      }
    }
    if (!c.dur_basis) problems.push("cam " + key + ": missing dur_basis");
  }
  return problems;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DATA: DATA,
    UnsupportedError: UnsupportedError,
    estimate: estimate,
    compare: compare,
    stockCombo: stockCombo,
    stockFalloff: stockFalloff,
    calibrate: calibrate,
    saeCorrectionFactor: saeCorrectionFactor,
    applySae: applySae,
    pressureKpa: pressureKpa,
    validateData: validateData
  };
}
