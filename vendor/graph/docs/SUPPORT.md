# Technical styling release 0.4.1

This release implements the requested technical-formatting layer in the working viewer, rather than merely labelling a colour theme “DSTU.” It replaces the partial 0.3.1 attachment and is intended to be deployed as actual runnable files in Graph.

## Axis-title patch

The 0.4.1 default 2D report places X labels beside the right arrow and horizontal Y labels just above the top arrow. Middle/end placement remains selectable. See `AXIS_LABEL_PATCH_v0.4.1.md` and `VALIDATION_v0.4.1.json` for the exact change and patch-level test evidence. Older evidence is retained under its original version.

## Units and geometry

The profile and inspector use millimetres for the outer page, margins, caption reserve, line widths, dash/gap lengths, marker dimensions, tick lengths, axis arrowheads and nominal font em size. The default outer page is 160 × 110 mm, including an 18 mm caption strip. Its plot rectangle is 131 × 65 mm at left 19 mm, top 12 mm. Decimal input such as 105.3 mm is not rounded to a pixel slider step.

Interactive display uses nominal CSS units and a labelled fit/zoom transform. This is not a promise about actual monitor millimetres. SVG publication renders an isolated native chart at 10 user units/mm and writes the corresponding physical width/height and viewBox. PNG uses round(mm × DPI / 25.4) dimensions and a real pHYs resolution chunk. Changing DPI does not change the requested paper dimensions.

Required SVG checks measure the generated file, not just the native option values. The default outer/plot tolerance is 0.1 mm. Stroke/dash checks use 0.03 mm, marker outline 0.06 mm. Measurement semantics are digital vector geometry, not printer calibration or a regulatory certificate.

## Lines, grids, markers

All ten semantic roles are editable: primary, secondary, reference, limit, construction, centerline, uncertainty, axis, grid_major and grid_minor. Each exposes width, colour, physical dash/gap array, phase offset, cap and join. Decorative series binding is explicit; a role alone does not grant permission to replace a data encoding.

The project default uses 0.60 mm primary curves, 0.25 mm axes, 0.18 mm major grids and 0.09 mm minor grids. The main/axis ratio is displayed with a project target of 2–3. These are project choices, NOT a claim that those dimensions are universally mandated by DSTU.

For 2D SVG scatter, physical dash patterns are passed to native Plotly as explicit numeric lengths. Caps, joins and offsets use a documented finishing step on the native SVG. This step is reapplied after native redraw and on actual exported output. It does not replace the chart renderer. Axis and grid dash geometry is likewise supported.

Nine calibrated marker symbols cover circles and squares (open/filled), up/down triangles, diamond, cross and x. Size means maximum un-stroked outline dimension; stroke width is separate. Marker density is controlled independently without removing numerical samples. Array-encoded markers are protected. This release does not add a rendered-depth/drawing-order editor: native series order and 3D depth behavior stay unchanged.

## Axes and notation

Major/minor visibility is independent. Numeric major/minor intervals operate in existing axis units and are checked for reasonable density. Blank intervals preserve the native policy. Numeric interval overrides reject non-linear axes rather than reinterpret their scale. Existing scale type, numeric range, data ordering and gaps remain protected.

Technical-formatting mode can place ticks outside/inside, add explicitly requested axis arrowheads, place titles at the axis middle or end, and format supplied quantity/symbol/unit metadata with comma, slash, brackets or a full quantity form. It never performs a scientific unit conversion. Known example units are locked; imported metadata is user supplied. Native-style mode does not impose page geometry, tick-generation or label-content changes.

## Caption and typography

The report caption is centred beneath the chart, inside a separately reserved strip of the specified outer page. Number/title, source and notes are editable; long text wraps and overflowing publication output is rejected instead of silently enlarged or clipped. Caption metadata is also exportable for a receiving document to own numbering and cross-references.

The “UA / DSTU-oriented report” name refers to the selected caption convention and project rules. DSTU 3008:2015 §7.5 is cited for report figures. Consistency of numbering and the first in-text reference cannot be checked from a standalone chart. No full DSTU ISO 128/3098, ESKD or GOST certification is claimed.

Fonts are explicit external system requirements. Nominal em size is separate from optional browser H-cap-height calibration. H calibration is reported nominal, not as a drafting-font certificate. No font files are distributed. Embedded/outlined font workflows, automatic arbitrary LaTeX rendering and font licensing decisions are not supplied by this release.

## Native 3D

Existing Plotly surface, scatter3d and explicit mesh3d examples remain interactive. Grid/font styling preserves tested camera/projection/aspect, coordinates, scalar arrays, colour mappings and topology. The browser suite includes a real mouse orbit, then restyling and a snapshot. Physical 2D dash/marker calibration, minor grids and 2D axis arrow/title conventions are not silently simulated in WebGL. Notices identify unsupported requests.

3D publication is an isolated native PNG with the selected pixels/DPI and a composed caption. Fine 3D geometry is nominal rather than measured from raster pixels. 3D is not mislabelled as fully vector SVG. Valid native mesh picking remains in use. A viewer-owned compatibility guard for pinned Plotly 3.3.1 rejects a GPU hit whose cell index is absent from the current mesh before the native picker dereferences it. This guard affects only invalid hits; it does not modify the bundled engine source, mesh data or rendering. It is outside the reusable styling adapter and recorded in browser tests.

## Outputs and acceptance

- Interactive HTML: bundled native runtime, figure data, current view, technical profile, bindings and caption. Numeric source is recoverable. No external network dependencies are needed beyond a locally available selected system font.
- SVG: qualified single 2D SVG-scatter plot. The report measures outer/plot rectangles, representative strokes, dash lengths/offsets, caps/joins, marker outlines, page-bound label containment, tick-label overlap, caption placement and embedded data equality. It does not claim general collision detection for every arbitrary annotation.
- PNG: 2D is rasterized from the measured SVG; 3D is a native raster snapshot. Integer pixel dimensions and actual pHYs are read back. Vector-source line geometry is not falsely described as raster-pixel metrology.
- Print / Save PDF: an actual print sheet at the requested CSS page size. This is a separate browser printing route, NOT qualified to ±0.1 mm. The recorded Chromium sample measured about 160.189 × 110.067 mm for a 160 × 110 mm request: the width misses that tolerance. Use measured SVG when exact vector dimensions are required; the PDF sample is diagnostic, not an accepted geometry reference.

Single constrained, overlaid or multi-panel fixed-page layouts are rejected with an explanation; native-style mode remains available. Native streaming applications, third-party plugins, arbitrary native source reconstruction and other engines need their own qualification. The release is not labelled universally production-certified across browsers/GPUs.

## Rule and engine references

User basis: Technical Chart Adapter v0.2 and Implementation Specification v0.2.1, plus the native/HTML/3D and technical-formatting discussion. Current implementation details and test evidence are this release's additions.

- DSTU 3008:2015 text, report figures: https://science.kname.edu.ua/images/dok/derzhstandart_3008_2015.pdf
- Plotly scatter attributes: https://plotly.com/javascript/reference/scatter/
- Plotly axis attributes: https://plotly.com/javascript/reference/layout/xaxis/
- Plotly scene attributes: https://plotly.com/javascript/reference/layout/scene/
- CSS unit relationships and screen limits: https://www.w3.org/TR/css-values-4/#absolute-lengths

These references explain the mapped facilities and caption convention. They do not establish that every output conforms; evidence belongs to the exact generated artifact and route.
