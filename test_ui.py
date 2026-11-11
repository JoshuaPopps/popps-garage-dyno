#!/usr/bin/env python3
"""Real-browser UI test for Popps's Garage Dyno.

Drives index.html in headless Chromium (Playwright) and proves the
plain-JavaScript app actually runs: presets load, the dyno renders
results and a chart, compare works, the catalog renders, and no page
errors fire. The app makes no external requests at all — no CDN, no
server — so the test needs nothing but localhost.

Requires: playwright + chromium (one-time setup, NOT shipped with the
app — see TESTING.md):
    pip install playwright
    playwright install chromium

Run from the project root:
    python3 test_ui.py
"""
import http.server
import functools
import pathlib
import socketserver
import threading

ROOT = pathlib.Path(__file__).parent


def serve():
    """Serve the project dir on an ephemeral localhost port."""
    handler = functools.partial(http.server.SimpleHTTPRequestHandler,
                                directory=str(ROOT))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, httpd.server_address[1]


def main():
    from playwright.sync_api import sync_playwright

    httpd, port = serve()
    url = "http://127.0.0.1:%d/" % port
    errors = []
    failed_requests = []
    try:
        with sync_playwright() as p:
            # Plain JS, no CDN: nothing external is fetched, so no
            # proxy is needed — the page only ever hits localhost.
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 800, "height": 900})
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text)
                    if m.type == "error" else None)
            page.on("requestfailed", lambda r: failed_requests.append(r.url))
            page.on("response", lambda r: failed_requests.append(r.url)
                    if r.status >= 400 else None)
            page.goto(url, wait_until="load")
            # The app renders synchronously on load (no runtime download).
            page.wait_for_selector("#results-a .big-number", timeout=30000)

            # 1. Default run rendered: Evo 1340 stock, ~71 hp.
            text = page.inner_text("#results-a")
            # CSS uppercases the labels, so compare case-insensitively.
            assert "peak horsepower" in text.lower(), "no HP block rendered"
            assert "71" in text, "default stock Evo should show ~71 hp: %r" % text[:200]
            assert page.query_selector("#results-a svg.chart"), "no chart SVG"

            # 2. Baseline info + source shown.
            info = page.inner_text("#a-baseline-info")
            assert "82.5" in info, "baseline info missing stock torque: %r" % info

            # 3. Preset: 1995 Fat Boy -> Super E + drag pipes.
            page.click("text=1995 Fat Boy (1340)")
            page.wait_for_timeout(500)
            text = page.inner_text("#results-a")
            assert "71.6" in text, "Fat Boy preset should show 71.6 hp: %r" % text[:200]
            assert "Super E" in text, "factor list should name the Super E"

            # 4. Phoenix summer SAE card.
            page.click("#sae-phx-summer")
            page.click("#run-a")
            page.wait_for_timeout(500)
            text = page.inner_text("#results-a")
            assert "110" in text and "1,100" in text, "SAE card missing PHX conditions"

            # 5. Compare tab: A vs B with a different carb.
            page.click(".nav button[data-view='view-compare']")
            page.wait_for_selector("#compare-a-summary >> text=Combo A")
            page.select_option("#b-carb", "hsr48")
            page.select_option("#b-exhaust", "two-into-1")
            page.click("#run-compare")
            page.wait_for_selector("#results-compare table", timeout=10000)
            ctext = page.inner_text("#results-compare")
            assert "Difference" in ctext, "compare table missing"
            assert "+" in ctext, "B should beat A: %r" % ctext[:300]
            assert page.query_selector("#results-compare svg.chart"), "no compare chart"

            # 6. Catalog tab: all three tables render with real rows.
            page.click(".nav button[data-view='view-catalog']")
            page.wait_for_selector("#catalog table", timeout=10000)
            ctext = page.inner_text("#catalog")
            assert "Knucklehead" in ctext and "Milwaukee-Eight" in ctext
            assert "Super E" in ctext and "HSR42" in ctext
            assert "EV27" in ctext and "SE-211" in ctext
            assert "NOT PUBLISHED" in ctext, "unsourced flags should show"
            rows = page.query_selector_all("#catalog table tr")
            assert len(rows) > 100, "catalog should have 100+ rows, got %d" % len(rows)

            # 7. About tab renders.
            page.click(".nav button[data-view='view-about']")
            assert "SAE J1349" in page.inner_text("#view-about")

            # 8. Cam select follows the baseline family (Evo BT cams only).
            page.click(".nav button[data-view='view-dyno']")
            page.select_option("#a-baseline", "m8-107")
            page.wait_for_timeout(300)
            opts = page.query_selector_all("#a-cam option")
            labels = [o.inner_text() for o in opts]
            assert any("Mega 8" in l for l in labels), "M8 cam missing: %r" % labels
            assert not any("EV27" in l for l in labels), "Evo cam leaked into M8 list"

            browser.close()
    finally:
        httpd.shutdown()

    assert not errors, "page/console errors: %r" % errors
    assert not failed_requests, "failed requests: %r" % failed_requests
    print("UI test passed: presets, run, SAE, compare, catalog, about, "
          "cam filtering — no page errors, no failed requests.")


if __name__ == "__main__":
    main()
