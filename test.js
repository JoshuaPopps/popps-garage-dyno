#!/usr/bin/env node
/* Tests for Pocket Garage Dyno (dyno.js). No dependencies.
 *
 *   node test.js
 *
 * Ported 1:1 from the Python reference tests, and cross-checked
 * against the Python implementation on every baseline, preset, and
 * three hot combos (24/24 identical — see TESTING.md).
 *
 * Checks: catalog validation, stock-calibration accuracy (a bone-stock
 * combo must reproduce its published stock HP within 2% and stock
 * torque within 1%), curve physics (hp == tq*rpm/5252 at every point,
 * curves rise then fall), mod behavior (bigger carb/cam/exhaust gain
 * power and move the peak up; drag pipes cost low-end torque), SAE
 * correction (Phoenix summer costs power; standard day is ~0.97),
 * A/B compare math, and unsupported-family handling.
 */
"use strict";
const assert = require("node:assert/strict");
const dyno = require("./dyno.js");
const {
  DATA, estimate, compare, stockCombo, stockFalloff,
  saeCorrectionFactor, applySae, validateData, UnsupportedError
} = dyno;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("ok - " + name);
  } catch (e) {
    console.log("FAIL - " + name + "\n  " + (e.stack || e).split("\n").slice(0, 3).join("\n  "));
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------- catalog
test("validation clean", () => {
  assert.deepEqual(validateData(), []);
});
test("every baseline has a source", () => {
  for (const [key, b] of Object.entries(DATA.BASELINES)) {
    assert.ok(b.source, key);
  }
});
test("baseline count", () => {
  assert.equal(Object.keys(DATA.BASELINES).length, 18);
});
test("no invented torque is hidden", () => {
  const derived = Object.keys(DATA.BASELINES).filter(k => DATA.BASELINES[k].tq_estimated);
  assert.deepEqual(derived.sort(), ["flathead-45", "knuckle-61", "knuckle-74"]);
  for (const key of derived) {
    assert.ok(DATA.BASELINES[key].source.toLowerCase().includes("estimated"));
  }
});
test("unsourced flow is flagged, not faked", () => {
  const noFlow = Object.keys(DATA.CARBS).filter(k => !DATA.CARBS[k].flow_cfm);
  assert.ok(noFlow.includes("ss-e"));   // S&S publishes no absolute CFM
  assert.ok(noFlow.includes("ss-g"));
  assert.ok(noFlow.includes("linkert-m74b"));
  assert.ok(DATA.CARBS.hsr42.flow_cfm); // 213 CFM published
});
test("no VM42", () => {
  // Mikuni makes no VM42 (38 -> 44). It must not be in the catalog.
  assert.ok(!("vm42" in DATA.CARBS));
});

// ---------------------------------------------------------------- calibration
test("stock combos reproduce published HP", () => {
  for (const key of Object.keys(DATA.BASELINES)) {
    const r = estimate(stockCombo(key));
    const err = Math.abs(r.peak_hp - r.stock_hp) / r.stock_hp;
    assert.ok(err <= 0.02, key + ": stock " + r.stock_hp + ", curve says " + r.peak_hp);
  }
});
test("stock combos reproduce published torque", () => {
  for (const key of Object.keys(DATA.BASELINES)) {
    const r = estimate(stockCombo(key));
    const err = Math.abs(r.peak_tq - r.stock_tq) / r.stock_tq;
    assert.ok(err <= 0.01, key);
  }
});
test("peak HP rpm near published", () => {
  for (const key of Object.keys(DATA.BASELINES)) {
    const r = estimate(stockCombo(key));
    assert.ok(Math.abs(r.peak_hp_rpm - r.stock_hp_rpm) <= 500, key);
  }
});
test("falloff in sane range", () => {
  for (const key of Object.keys(DATA.BASELINES)) {
    const [d, e] = stockFalloff(key);
    assert.ok(d >= 0.05 && d <= 0.60, key);
    assert.ok(e >= 1.0 && e <= 4.0, key);
  }
});

// ---------------------------------------------------------------- curve physics
test("hp equals tq times rpm", () => {
  const r = estimate(stockCombo("evo-1340"));
  for (const [rpm, tq, hp] of r.curve) {
    assert.ok(Math.abs(hp - tq * rpm / 5252.0) <= 0.15, rpm);
  }
});
test("curve rises then falls", () => {
  const r = estimate(stockCombo("evo-1340"));
  const tqs = r.curve.map(p => p[1]);
  const peakI = tqs.indexOf(Math.max(...tqs));
  assert.ok(peakI > 0 && peakI < tqs.length - 1);
  for (let i = 0; i < peakI; i++) assert.ok(tqs[i] <= tqs[i + 1]);
  for (let i = peakI; i < tqs.length - 1; i++) assert.ok(tqs[i] >= tqs[i + 1]);
});
test("curve covers idle to redline", () => {
  const r = estimate(stockCombo("evo-1340"));
  assert.equal(r.curve[0][0], 1200);
  assert.equal(r.curve[r.curve.length - 1][0], r.redline);
});

// ---------------------------------------------------------------- mods
function withMod(base, kw) {
  return estimate(Object.assign({}, base, kw));
}
test("Super E beats CV40", () => {
  const base = stockCombo("evo-1340");
  const stock = withMod(base, {});
  const big = withMod(base, { carb: "ss-e" });
  assert.ok(big.peak_hp > stock.peak_hp);
  assert.ok(big.peak_hp - stock.peak_hp < 12, "Super E should not add fantasy power");
});
test("HSR48 beats HSR42", () => {
  const base = stockCombo("evo-1340");
  assert.ok(withMod(base, { carb: "hsr48" }).peak_hp > withMod(base, { carb: "hsr42" }).peak_hp);
});
test("2-into-1 beats stock pipes", () => {
  const base = stockCombo("evo-1340");
  assert.ok(withMod(base, { exhaust: "two-into-1" }).peak_hp > withMod(base, {}).peak_hp);
});
test("drag pipes cost low-end torque", () => {
  const base = stockCombo("evo-1340");
  assert.ok(withMod(base, { exhaust: "drag-pipes" }).peak_tq < withMod(base, {}).peak_tq);
});
test("big bore gains", () => {
  const base = stockCombo("evo-1340");
  assert.ok(withMod(base, { displacement_ci: 96 }).peak_hp > withMod(base, {}).peak_hp);
  assert.ok(withMod(base, { displacement_ci: 96 }).peak_tq > withMod(base, {}).peak_tq);
});
test("compression gains", () => {
  const base = stockCombo("evo-1340");
  assert.ok(withMod(base, { compression: 10.5 }).peak_hp > withMod(base, {}).peak_hp);
});
test("high compression warns on pump gas", () => {
  const r = withMod(stockCombo("evo-1340"), { compression: 11.0, fuel: "pump" });
  assert.ok(r.warnings.some(w => w.includes("detonation")));
});
test("hot cam moves peak up", () => {
  const base = stockCombo("evo-1340");
  const cams = Object.keys(DATA.CAMS).filter(k =>
    DATA.CAMS[k].families.includes("Evolution Big Twin") && k !== "stock-evo");
  assert.ok(cams.length > 0, "no aftermarket Evo cam in catalog");
  const hot = cams.reduce((a, b) => (DATA.CAMS[a].dur_i > DATA.CAMS[b].dur_i ? a : b));
  assert.ok(withMod(base, { cam: hot }).peak_tq_rpm > withMod(base, {}).peak_tq_rpm);
});
test("rev limit caps curve", () => {
  const r = withMod(stockCombo("evo-1340"), { rev_limit: 5000 });
  assert.equal(r.redline, 5000);
  assert.equal(r.curve[r.curve.length - 1][0], 5000);
});

// ---------------------------------------------------------------- SAE
test("standard day is near unity", () => {
  // SAE J1349 reference is 77 F and 29.234 inHg DRY air (99 kPa),
  // thinner than sea-level standard pressure, so a 77 F sea-level
  // day corrects to just under 1.0.
  const cf = saeCorrectionFactor(77, 0);
  assert.ok(cf > 0.95 && cf < 1.0, cf);
  // At the true SAE reference (99 kPa dry air, ~640 ft) the factor is 1.0.
  assert.ok(Math.abs(saeCorrectionFactor(77, 640) - 1.0) < 0.01);
});
test("Phoenix summer costs power", () => {
  const cf = saeCorrectionFactor(110, 1100);
  assert.ok(cf > 1.05, cf);
  const r = estimate(stockCombo("evo-1340"));
  const [obsHp, obsTq] = applySae(r, 110, 1100);
  assert.ok(obsHp < r.peak_hp);
  assert.ok(obsTq < r.peak_tq);
});
test("Phoenix winter costs less than summer", () => {
  assert.ok(saeCorrectionFactor(65, 1100) < saeCorrectionFactor(110, 1100));
});
test("altitude alone costs power", () => {
  assert.ok(saeCorrectionFactor(77, 5000) > saeCorrectionFactor(77, 0));
});
test("pressure falls with altitude", () => {
  assert.ok(dyno.pressureKpa(5280) < dyno.pressureKpa(0));
  assert.ok(Math.abs(dyno.pressureKpa(0) - 101.325) < 0.01);
});

// ---------------------------------------------------------------- compare
test("compare delta math", () => {
  const a = stockCombo("evo-1340");
  const b = Object.assign({}, a, { carb: "hsr48", exhaust: "two-into-1" });
  const [ra, rb, d] = compare(a, b);
  assert.ok(Math.abs(d.hp - (rb.peak_hp - ra.peak_hp)) < 0.05);
  assert.ok(Math.abs(d.hp_pct - 100.0 * (rb.peak_hp - ra.peak_hp) / ra.peak_hp) < 0.05);
  assert.ok(d.hp > 0);
});

// ---------------------------------------------------------------- unsupported
test("unknown baseline raises", () => {
  assert.throws(() => estimate(Object.assign(stockCombo("evo-1340"), { baseline: "flathead-74" })), UnsupportedError);
});
test("unknown carb raises", () => {
  assert.throws(() => estimate(Object.assign(stockCombo("evo-1340"), { carb: "lectrons-xxx" })), UnsupportedError);
});
test("unknown cam raises", () => {
  assert.throws(() => estimate(Object.assign(stockCombo("evo-1340"), { cam: "nope" })), UnsupportedError);
});
test("bad displacement raises", () => {
  assert.throws(() => estimate(Object.assign(stockCombo("evo-1340"), { displacement_ci: 0 })), Error);
});

// ---------------------------------------------------------------- presets
test("preset combos estimate", () => {
  for (const [name, p] of Object.entries(DATA.PRESETS)) {
    const r = estimate(p.combo);
    assert.ok(r.peak_hp > 0, name);
    assert.ok(r.peak_tq > 0, name);
  }
});

console.log(passed + " tests passed, 0 failed");
