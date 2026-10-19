# Patch 0.4.1 validation

Current patch results are in `VALIDATION_v0.4.1.json` and `evidence-v0.4.1/`. The 25 focused browser tests, all 101 unit tests and launcher tests were run on the patch. The longer historical browser/PDF suite below describes v0.4.0 evidence and was not rerun in full for this axis-title-only update.

# Validation method and boundaries

The root validation JSON records exact counts and source hashes. `evidence/unit-tests.log`, `browser-tests.json`, `viewer-control-tests.json` and `launcher-tests.json` contain actual executed checks, not an implementation backlog.

Unit tests cover legacy adapter behavior, physical conversions, strict schema/geometry validation, dash pairs, role/binding protections, annotation retention, native versus technical mode, invalid log intervals, density limits, idempotency, stale plans, undo, disposal and PNG metadata/CRC.

Browser tests use the entire built HTML with the unchanged Plotly.js runtime. They measure real serialized SVG paths/text, inspect generated PNG bytes, reopen exported interactive HTML, exercise controls and downloads/imports, perform a real 3D orbit, and compare camera/scalar/mesh data. External requests are blocked with clean browser contexts. Linux/Xvfb/Chromium 144/SwiftShader is the tested environment; this is not a cross-GPU or cross-browser certification.

The managed browser blocks file/HTTP navigation, so browser content is loaded inline from the actual built HTML bytes. Separately, both real launcher implementations are tested over local HTTP, including exact byte delivery, version reporting, wrong Host, unsupported methods, missing files, invalid/occupied ports, paths with spaces, missing executable permissions, and shutdown. Desktop auto-opening and macOS were not exercised.

Screenshots were visually inspected for the default technical figure, publication proof, 3D and mobile layouts. A diagnostic browser PDF was rendered and inspected; it is visually usable but its 160.189 mm page width fails the 160 mm ±0.1 mm target. This route is documented as unqualified for exact page geometry, not hidden inside a universal pass.

A reported acceptance means the declared required checks for that artifact passed. Fonts, drafting-standard compliance, document-level cross-references, and raster 3D detail geometry remain explicit nominal/out-of-scope properties. Successful runtime tests do not imply universal DSTU conformance.
