/* Pocket Garage Dyno — UI. Plain JavaScript, no frameworks, no network.
 * The engine lives in dyno.js (DATA + estimate/compare/SAE). This file
 * is the forms, the chart, the catalog tables, and the wiring.
 */
"use strict";

/* global DATA, estimate, compare, stockCombo, validateData, UnsupportedError */

function el(id) { return document.getElementById(id); }
function val(id) { return el(id).value.trim(); }
function num(id, def) {
  var v = val(id);
  if (!v) return def;
  var n = parseFloat(v);
  return isNaN(n) ? def : n;
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/* Python %g-style short number: 40 stays "40", 39.6 stays "39.6". */
function g(x) { return String(Number(x.toPrecision(6))); }
function f1(x) { return x.toFixed(1); }

// ---------------- form fill ----------------

function fillSelect(id, items, selected) {
  var s = el(id);
  s.innerHTML = "";
  for (var i = 0; i < items.length; i++) {
    var opt = document.createElement("option");
    opt.value = items[i][0];
    opt.textContent = items[i][1];
    if (items[i][0] === selected) opt.selected = true;
    s.appendChild(opt);
  }
}

function baselineItems() {
  var fams = {};
  for (const [k, b] of Object.entries(DATA.BASELINES)) {
    (fams[b.family] = fams[b.family] || []).push([k, b]);
  }
  var out = [];
  for (const fam of Object.keys(fams).sort()) {
    var rows = fams[fam].sort(function (a, b) {
      return a[1].variant < b[1].variant ? -1 : 1;
    });
    for (const [k, b] of rows) out.push([k, fam + " — " + b.variant + " (" + b.years + ")"]);
  }
  return out;
}

function carbItems() {
  return Object.entries(DATA.CARBS)
    .sort(function (a, b) { return a[1].bore_mm - b[1].bore_mm; })
    .map(function (kv) {
      var k = kv[0], c = kv[1];
      return [k, c.name + " — " + g(c.bore_mm) + " mm" +
        (c.flow_cfm ? "" : " (flow not published)")];
    });
}

function camItems(baselineKey) {
  var fam = DATA.BASELINES[baselineKey].family;
  var out = [];
  var rows = Object.entries(DATA.CAMS).sort(function (a, b) {
    return a[1].name < b[1].name ? -1 : 1;
  });
  for (const [k, c] of rows) {
    if (c.families.indexOf(fam) === -1) continue;
    if (c.dur_i === null || c.dur_i === undefined) {
      out.push([k, c.name + " — specs not published"]);
    } else {
      out.push([k, c.name + " — " + g(c.dur_i) + " deg @" + c.dur_basis +
        ", " + c.lift_i.toFixed(3) + " in lift"]);
    }
  }
  return out;
}

function simpleItems(table) {
  return Object.entries(table)
    .sort(function (a, b) { return a[1].name < b[1].name ? -1 : 1; })
    .map(function (kv) { return [kv[0], kv[1].name]; });
}

function baselineInfoHtml(b) {
  return "Stock: " + g(b.stock_hp) + " hp @ " + b.stock_hp_rpm + " rpm, " +
    g(b.stock_tq) + " ft-lb @ " + b.stock_tq_rpm + " rpm, " +
    g(b.compression) + ":1 compression, redline " + b.redline + " rpm. " +
    "<span class='badge factory'>SOURCE</span> " + esc(b.source);
}

function fillComboForm(prefix, baselineKey) {
  var b = DATA.BASELINES[baselineKey];
  fillSelect(prefix + "-baseline", baselineItems(), baselineKey);
  fillSelect(prefix + "-carb", carbItems(), b.stock_carb);
  fillSelect(prefix + "-cam", camItems(baselineKey), b.stock_cam);
  fillSelect(prefix + "-exhaust", simpleItems(DATA.EXHAUSTS), "stock");
  fillSelect(prefix + "-heads", simpleItems(DATA.HEADS), "stock");
  fillSelect(prefix + "-air", simpleItems(DATA.AIR_CLEANERS), "stock");
  fillSelect(prefix + "-fuel", simpleItems(DATA.FUELS), "pump");
  el(prefix + "-baseline-info").innerHTML = baselineInfoHtml(b);
  el(prefix + "-disp").placeholder = "stock " + g(b.disp_ci);
  el(prefix + "-cr").placeholder = "stock " + b.compression.toFixed(1);
}

function onBaselineChange(prefix) {
  var key = val(prefix + "-baseline");
  var b = DATA.BASELINES[key];
  fillSelect(prefix + "-carb", carbItems(), b.stock_carb);
  fillSelect(prefix + "-cam", camItems(key), b.stock_cam);
  el(prefix + "-baseline-info").innerHTML = baselineInfoHtml(b);
  el(prefix + "-disp").placeholder = "stock " + g(b.disp_ci);
  el(prefix + "-cr").placeholder = "stock " + b.compression.toFixed(1);
  el(prefix + "-disp").value = "";
  el(prefix + "-cr").value = "";
}

function setCombo(prefix, combo) {
  fillComboForm(prefix, combo.baseline);
  if (combo.displacement_ci) el(prefix + "-disp").value = String(combo.displacement_ci);
  if (combo.compression) el(prefix + "-cr").value = String(combo.compression);
  el(prefix + "-carb").value = combo.carb || "";
  el(prefix + "-cam").value = combo.cam || "";
  el(prefix + "-exhaust").value = combo.exhaust || "stock";
  el(prefix + "-heads").value = combo.heads || "stock";
  el(prefix + "-air").value = combo.air || "stock";
  el(prefix + "-fuel").value = combo.fuel || "pump";
  if (combo.rev_limit) el(prefix + "-revlimit").value = String(combo.rev_limit);
}

function readCombo(prefix) {
  return {
    baseline: val(prefix + "-baseline"),
    displacement_ci: num(prefix + "-disp", null),
    compression: num(prefix + "-cr", null),
    carb: val(prefix + "-carb"),
    cam: val(prefix + "-cam"),
    exhaust: val(prefix + "-exhaust"),
    heads: val(prefix + "-heads"),
    air: val(prefix + "-air"),
    fuel: val(prefix + "-fuel"),
    rev_limit: num(prefix + "-revlimit", null)
  };
}

function applyPreset(name) {
  var p = DATA.PRESETS[name];
  setCombo("a", p.combo);
  el("results-a").innerHTML = "";
  runDyno();
}

// ---------------- chart ----------------

function chartSvg(series) {
  var W = 560, H = 360, PL = 62, PR = 62, PT = 26, PB = 48;
  var maxRpm = 0, maxHp = 0, maxTq = 0;
  for (var s = 0; s < series.length; s++) {
    maxRpm = Math.max(maxRpm, series[s][1].redline);
    maxHp = Math.max(maxHp, series[s][1].peak_hp);
    maxTq = Math.max(maxTq, series[s][1].peak_tq);
  }
  maxHp *= 1.12;
  maxTq *= 1.12;
  var minRpm = 1200;
  function X(rpm) { return PL + (rpm - minRpm) / (maxRpm - minRpm) * (W - PL - PR); }
  function Yhp(hp) { return PT + (1 - hp / maxHp) * (H - PT - PB); }
  function Ytq(tq) { return PT + (1 - tq / maxTq) * (H - PT - PB); }

  var parts = ['<svg class="chart" viewBox="0 0 ' + W + " " + H +
    '" role="img" aria-label="Horsepower and torque curves">'];
  for (var i = 0; i < 5; i++) {
    var frac = i / 4.0;
    var y = Math.round(PT + frac * (H - PT - PB));
    var hpV = Math.round(maxHp * (1 - frac));
    var tqV = Math.round(maxTq * (1 - frac));
    parts.push('<line x1="' + PL + '" y1="' + y + '" x2="' + (W - PR) + '" y2="' + y +
      '" stroke="rgba(255,255,255,.055)" stroke-width="1"/>');
    parts.push('<text x="' + (PL - 6) + '" y="' + (y + 6) +
      '" font-size="17" fill="#9a9aa6" text-anchor="end">' + hpV + "</text>");
    parts.push('<text x="' + (W - PR + 6) + '" y="' + (y + 6) +
      '" font-size="17" fill="#9a9aa6" text-anchor="start">' + tqV + "</text>");
  }
  parts.push('<text x="' + (PL - 6) + '" y="' + (PT - 6) +
    '" font-size="17" font-weight="bold" fill="#c4a6ff">HP</text>');
  parts.push('<text x="' + (W - PR + 6) + '" y="' + (PT - 6) +
    '" font-size="17" font-weight="bold" fill="#ededf2">TQ</text>');
  for (var rpm = 2000; rpm <= maxRpm; rpm += 1000) {
    parts.push('<text x="' + Math.round(X(rpm)) + '" y="' + (H - 14) +
      '" font-size="16" fill="#9a9aa6" text-anchor="middle">' + rpm + "</text>");
  }
  parts.push('<text x="' + Math.round((PL + W - PR) / 2) + '" y="' + (H - 32) +
    '" font-size="16" fill="#9a9aa6" text-anchor="middle">rpm</text>');
  for (var k = 0; k < series.length; k++) {
    var r = series[k][1], hpC = series[k][2], tqC = series[k][3];
    var dashed = series[k][4];
    var dash = dashed ? ' stroke-dasharray="7 5"' : "";
    var hpPts = r.curve.map(function (p) { return Math.round(X(p[0])) + "," + Math.round(Yhp(p[2])); }).join(" ");
    var tqPts = r.curve.map(function (p) { return Math.round(X(p[0])) + "," + Math.round(Ytq(p[1])); }).join(" ");
    parts.push('<polyline points="' + hpPts + '" fill="none" stroke="' + hpC + '" stroke-width="3"' + dash + "/>");
    parts.push('<polyline points="' + tqPts + '" fill="none" stroke="' + tqC + '" stroke-width="2.5"' + dash + "/>");
    parts.push('<circle cx="' + Math.round(X(r.peak_hp_rpm)) + '" cy="' + Math.round(Yhp(r.peak_hp)) +
      '" r="6" fill="' + hpC + '"/>');
    parts.push('<circle cx="' + Math.round(X(r.peak_tq_rpm)) + '" cy="' + Math.round(Ytq(r.peak_tq)) +
      '" r="6" fill="' + tqC + '"/>');
  }
  parts.push("</svg>");
  return parts.join("");
}

// ---------------- results ----------------

function resultHtml(r, tempF, altFt, title) {
  var sae = applySae(r, tempF, altFt);
  var obsHp = sae[0], obsTq = sae[1], cf = sae[2];
  var stock = estimate(stockCombo(r.baseline));
  var hpGain = r.peak_hp - stock.peak_hp;
  var tqGain = r.peak_tq - stock.peak_tq;
  function signed(x) { return (x >= 0 ? "+" : "") + f1(x); }
  var html = [];
  html.push('<div class="estimate-banner">ESTIMATE — crank figures, ' +
    "not a dyno sheet. Stock baseline: " + esc(r.variant) + ". Source: " + esc(r.source) + "</div>");
  html.push("<h3>" + esc(title) + "</h3>");
  html.push('<div class="big-numbers">');
  html.push('<div class="big-number"><div class="value chrome-text">' + f1(r.peak_hp) + " <small>hp</small></div>" +
    '<div class="label">Peak horsepower</div>' +
    '<div class="sub">@ ' + r.peak_hp_rpm + " rpm (stock " + f1(stock.peak_hp) + ", " + signed(hpGain) + ")</div></div>");
  html.push('<div class="big-number"><div class="value chrome-text">' + f1(r.peak_tq) + " <small>ft-lb</small></div>" +
    '<div class="label">Peak torque</div>' +
    '<div class="sub">@ ' + r.peak_tq_rpm + " rpm (stock " + f1(stock.peak_tq) + ", " + signed(tqGain) + ")</div></div>");
  html.push("</div>");
  html.push(chartSvg([["A", r, "#c4a6ff", "#ededf2", false]]));
  html.push('<p class="chart-legend"><span><span class="swatch" style="background:#c4a6ff"></span>' +
    'Horsepower</span><span><span class="swatch" style="background:#ededf2"></span>' +
    "Torque</span></p>");
  html.push('<div class="card"><h4>At ' + g(tempF) + " F / " +
    altFt.toLocaleString("en-US") +
    " ft (SAE correction " + cf.toFixed(3) + ")</h4>" +
    "<p>Same motor in that air: <strong>" + f1(obsHp) + " hp / " + f1(obsTq) +
    " ft-lb</strong> (observed, uncorrected). Phoenix summer heat costs real power.</p></div>");
  if (r.factors.length) {
    html.push('<div class="card"><h4>What moved the number</h4><ul class="factor-list">');
    for (const [label, f] of r.factors) {
      html.push("<li><span>" + esc(label) + "</span><span>× " + f.toFixed(3) + "</span></li>");
    }
    html.push("</ul><p class='muted'>Factors multiply peak torque; " +
      "horsepower follows from the curve (hp = tq × rpm / 5252). " +
      "See About for the method.</p></div>");
  }
  for (const w of r.warnings) html.push('<div class="warn">' + esc(w) + "</div>");
  html.push("<details><summary>Full curve (every 100 rpm)</summary>" +
    '<table><tr><th class="num">rpm</th><th class="num">Torque (ft-lb)</th>' +
    '<th class="num">HP</th></tr>');
  for (const [rpm, tq, hp] of r.curve) {
    html.push('<tr><td class="num">' + rpm + '</td><td class="num">' + f1(tq) +
      '</td><td class="num">' + f1(hp) + "</td></tr>");
  }
  html.push("</table></details>");
  return html.join("");
}

function runDyno() {
  var r;
  try {
    r = estimate(readCombo("a"));
  } catch (e) {
    el("results-a").innerHTML = '<div class="warn">' + esc(e.message) + "</div>";
    return;
  }
  var tempF = num("a-temp", 77);
  var altFt = num("a-alt", 0);
  el("results-a").innerHTML = resultHtml(r, tempF, altFt, r.family + " — " + r.variant);
  el("compare-a-summary").innerHTML =
    '<h4 style="margin-top:0">Combo A — ' + esc(r.family) + " " + esc(r.variant) + "</h4>" +
    "<p><strong>" + f1(r.peak_hp) + " hp @ " + r.peak_hp_rpm + " rpm / " + f1(r.peak_tq) +
    " ft-lb @ " + r.peak_tq_rpm + " rpm</strong> (estimate)</p>" +
    '<p class="muted">' + esc(r.factors.map(function (f) { return f[0]; }).join(", ") || "Bone stock.") + "</p>";
}

function runCompare() {
  var ra, rb, d;
  try {
    var res = compare(readCombo("a"), readCombo("b"));
    ra = res[0]; rb = res[1]; d = res[2];
  } catch (e) {
    el("results-compare").innerHTML = '<div class="warn">' + esc(e.message) + "</div>";
    return;
  }
  var html = [];
  html.push('<div class="estimate-banner">ESTIMATE — crank figures, not a dyno sheet.</div>');
  html.push(chartSvg([
    ["A", ra, "#c4a6ff", "#ededf2", false],
    ["B", rb, "#9d6bff", "#9a9aa6", true]
  ]));
  html.push('<p class="chart-legend"><span><span class="swatch" style="background:#c4a6ff"></span>' +
    'A — horsepower</span><span><span class="swatch" style="background:#ededf2"></span>' +
    'A — torque</span><span><span class="swatch" style="background:#9d6bff"></span>' +
    'B — horsepower</span><span><span class="swatch" style="background:#9a9aa6"></span>' +
    "B — torque</span></p>");
  html.push('<table><tr><th></th><th class="num">Combo A</th><th class="num">Combo B</th>' +
    '<th class="num">Difference</th></tr>');
  function fmtDiff(v, pct) {
    return (v >= 0 ? "+" : "") + f1(v) + " (" + (pct >= 0 ? "+" : "") + f1(pct) + "%)";
  }
  var rows = [
    ["Peak HP", f1(ra.peak_hp) + " @ " + ra.peak_hp_rpm + " rpm",
      f1(rb.peak_hp) + " @ " + rb.peak_hp_rpm + " rpm", fmtDiff(d.hp, d.hp_pct)],
    ["Peak torque", f1(ra.peak_tq) + " @ " + ra.peak_tq_rpm + " rpm",
      f1(rb.peak_tq) + " @ " + rb.peak_tq_rpm + " rpm", fmtDiff(d.tq, d.tq_pct)],
    ["Redline", ra.redline + " rpm", rb.redline + " rpm",
      (rb.redline - ra.redline >= 0 ? "+" : "") + (rb.redline - ra.redline)]
  ];
  for (const [label, a, b, diff] of rows) {
    var cls = diff.charAt(0) === "+" ? "delta-pos" : (diff.charAt(0) === "-" ? "delta-neg" : "");
    html.push('<tr class="' + cls + '"><td>' + label + '</td><td class="num">' + a +
      '</td><td class="num">' + b + '</td><td class="num">' + diff + "</td></tr>");
  }
  html.push("</table>");
  html.push('<p class="muted">A: ' + esc(ra.family) + " — " + esc(ra.variant) +
    ". B: " + esc(rb.family) + " — " + esc(rb.variant) + ".</p>");
  el("results-compare").innerHTML = html.join("");
}

// ---------------- catalog ----------------

function catalogHtml() {
  var html = [];
  html.push("<h3>Stock baselines</h3><table>" +
    "<tr><th>Family / variant</th><th class='num'>Disp.</th>" +
    '<th class="num">CR</th><th class="num">Stock HP</th>' +
    '<th class="num">Stock TQ</th><th>Source</th></tr>');
  var baselines = Object.entries(DATA.BASELINES).sort(function (a, b) {
    return (a[1].family + a[1].variant) < (b[1].family + b[1].variant) ? -1 : 1;
  });
  for (const [k, b] of baselines) {
    html.push("<tr><td>" + esc(b.family) + " — " + esc(b.variant) + " (" + esc(b.years) + ")</td>" +
      '<td class="num">' + g(b.disp_ci) + " ci</td>" +
      '<td class="num">' + b.compression.toFixed(1) + ":1</td>" +
      '<td class="num">' + g(b.stock_hp) + " @ " + b.stock_hp_rpm + "</td>" +
      '<td class="num">' + g(b.stock_tq) + " @ " + b.stock_tq_rpm + "</td>" +
      "<td>" + esc(b.source) + "</td></tr>");
  }
  html.push("</table>");
  html.push("<h3>Carburetors</h3><table><tr><th>Carb</th>" +
    '<th class="num">Bore</th><th class="num">Flow</th><th>Fits</th><th>Source</th></tr>');
  var carbs = Object.entries(DATA.CARBS).sort(function (a, b) { return a[1].bore_mm - b[1].bore_mm; });
  for (const [k, c] of carbs) {
    var flow = c.flow_cfm ? (g(c.flow_cfm) + " CFM")
      : '<span class="badge unsourced">NOT PUBLISHED</span>';
    html.push("<tr><td>" + esc(c.name) + '<br><span class="muted">' + esc(c.bore_note || "") + "</span></td>" +
      '<td class="num">' + g(c.bore_mm) + " mm</td>" +
      '<td class="num">' + flow + "</td>" +
      "<td>" + esc((c.fits || []).join(", ")) + "</td>" +
      "<td>" + esc(c.source) + "</td></tr>");
  }
  html.push("</table>");
  html.push("<h3>Camshafts</h3><p class='muted'>Durations are published " +
    "@ .053\" lift (the Harley Evo/Twin Cam convention) unless the row says " +
    'otherwise — M8 figures are @ .050". Never relabeled.</p>' +
    "<table><tr><th>Cam</th><th>Fits</th>" +
    '<th class="num">Duration int/exh</th><th class="num">Lift int/exh</th>' +
    '<th class="num">LSA</th><th class="num">Int. close</th><th>Source</th></tr>');
  var cams = Object.entries(DATA.CAMS).sort(function (a, b) {
    return a[1].name < b[1].name ? -1 : 1;
  });
  for (const [k, c] of cams) {
    var dur = (c.dur_i === null || c.dur_i === undefined)
      ? '<span class="badge unsourced">NOT PUBLISHED</span>'
      : g(c.dur_i) + "° / " + g(c.dur_e) + "° @" + c.dur_basis;
    var lift = (c.lift_i === null || c.lift_i === undefined) ? "—"
      : c.lift_i.toFixed(3) + " / " + c.lift_e.toFixed(3) + " in";
    var ic = (c.ic === null || c.ic === undefined)
      ? '<span class="badge unsourced">NOT PUBLISHED</span>'
      : g(c.ic) + "° ABDC";
    html.push("<tr><td>" + esc(c.name) + "</td><td>" + esc((c.families || []).join(", ")) + "</td>" +
      '<td class="num">' + dur + '</td><td class="num">' + lift + "</td>" +
      '<td class="num">' + (c.lsa ? g(c.lsa) + "°" : "—") + '</td><td class="num">' + ic + "</td>" +
      "<td>" + esc(c.source) + "</td></tr>");
  }
  html.push("</table>");
  html.push('<p class="muted">Exhaust, heads, air cleaner, and fuel ' +
    "factors are heuristics from published dyno lore — see the " +
    "About tab for the method and the exact numbers in dyno.js.</p>");
  return html.join("");
}

function camInfo(c) {
  var adv = "";
  if (c.adv_i) adv = "Advertised " + g(c.adv_i) + "° / " + g(c.adv_e) + "°. ";
  var lsa = c.lsa ? "LSA " + g(c.lsa) + "°. " : "";
  var ic = (c.ic !== null && c.ic !== undefined)
    ? "Intake closes " + g(c.ic) + "° ABDC." : "Intake closing not published.";
  return adv + lsa + ic + " Source: " + esc(c.source);
}

// ---------------- wire up ----------------

function init() {
  var problems = validateData();
  if (problems.length) {
    el("results-a").innerHTML = '<div class="warn">Catalog problem: ' +
      esc(problems.join("; ")) + "</div>";
    return;
  }
  var defaultKey = "evo-1340" in DATA.BASELINES ? "evo-1340" : Object.keys(DATA.BASELINES).sort()[0];
  fillComboForm("a", defaultKey);
  fillComboForm("b", defaultKey);
  var row = el("preset-row");
  for (const [name, p] of Object.entries(DATA.PRESETS)) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = p.label;
    btn.setAttribute("data-preset", name);
    row.appendChild(btn);
  }
  el("catalog").innerHTML = catalogHtml();
  runDyno();

  el("run-a").addEventListener("click", runDyno);
  el("run-compare").addEventListener("click", runCompare);
  el("a-baseline").addEventListener("change", function () { onBaselineChange("a"); });
  el("b-baseline").addEventListener("change", function () { onBaselineChange("b"); });
  el("a-cam").addEventListener("change", function () {
    var c = DATA.CAMS[val("a-cam")];
    el("a-cam-info").innerHTML = c ? camInfo(c) : "";
  });
  el("sae-standard").addEventListener("click", function () {
    el("a-temp").value = "77"; el("a-alt").value = "0";
  });
  el("sae-phx-summer").addEventListener("click", function () {
    el("a-temp").value = "110"; el("a-alt").value = "1100";
  });
  el("sae-phx-winter").addEventListener("click", function () {
    el("a-temp").value = "65"; el("a-alt").value = "1100";
  });
  el("preset-row").addEventListener("click", function (event) {
    var name = event.target.getAttribute("data-preset");
    if (name && DATA.PRESETS[name]) applyPreset(name);
  });
}

/* Tab nav + service worker. Plain JS, runs before anything else. */
document.querySelectorAll(".nav button").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".nav button").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
    document.getElementById(btn.dataset.view).classList.add("active");
    window.scrollTo(0, 0);
  });
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  });
}

init();
