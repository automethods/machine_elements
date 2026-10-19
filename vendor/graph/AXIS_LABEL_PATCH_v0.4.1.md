# Graph Studio 0.4.1 — axis titles next to arrowheads

This focused update implements the requested axis-title placement. It does not change chart values, units, scales, numerical ranges, line/grid styles, or the 3D camera.

The initial 2D report and line-role examples now use arrowed axes and `axes.label_position: "arrowhead"`. The X title sits immediately beside the right arrow; the Y title is horizontal just above the top arrow. The nominal gap is 1.5 mm in publication space and is scaled consistently in the viewer and exports. A long X title that would not fit in the right margin is right-aligned just above the arrow tip. The browser measures the selected font; planning without a DOM uses a conservative text-width estimate.

**Inspector:** Typography & notation → Axis title placement now offers Near arrowhead, End of axis, and Middle of axis. Grid & axes → Axis ends controls the arrowheads. With plain axes selected, Near arrowhead uses the existing endpoint layout without creating an arrow. Saved profiles retain their explicit center/end settings; the change does not silently rewrite saved user choices.

Label placement applies to Technical formatting with “Format supplied axis quantities / units” enabled. Supplied metadata remains authoritative; no unit conversion occurs. Native restyle and 3D use their existing label policies. No 2D annotation or camera adjustment is imposed on a 3D scene.

The same native annotation layout is used for the live chart, isolated SVG rendering, 2D PNG rendering, and standalone interactive HTML. This is not a browser-only overlay. Native annotations unrelated to the formatter remain intact.

The 1.5 mm gap and default arrowhead placement are the user's presentation preference, not an assertion that every DSTU chart requires this layout. Existing font, PDF-print-route and broader engine qualifications are unchanged.

## Tests executed for this patch

- 101 unit tests passed (89 existing and 12 focused axis-title tests).
- 25 focused browser/export checks passed, including actual text bounds near arrow tips, tick/legend separation, all three UI choices, notation variants and long labels, SVG and 600-DPI PNG, standalone HTML after zoom, idempotency, undo, mobile layout and unchanged 3D camera.
- Launcher checks and type compilation are recorded in `VALIDATION_v0.4.1.json`.

The browser tests run in Chromium/Linux with software WebGL, complete HTML bytes loaded inline and external requests blocked. They do not claim cross-browser/GPU qualification. Historical v0.4.0 evidence remains under `evidence/`; patch evidence is under `evidence-v0.4.1/`.

## Run

Stop the old terminal server with Ctrl+C. Copy the refreshed Graph folder and run `sh run.sh`. Refresh the browser (Ctrl+Shift+R) and check for v0.4.1. The filename is still `Graph_Studio.html`; no build or nested archive extraction is needed.
