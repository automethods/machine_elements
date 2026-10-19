# Technical API 0.4.1

## Profile

Start with `cloneTechnical(technicalProfiles.ua)` (or `.colour` / `.monochrome`), edit properties, and call `validateTechnicalProfile`. Profiles are complete versioned objects, not partial arbitrary native options. Unknown/missing properties, unsafe keys, invalid geometry, unsupported values and excessive resource sizes are rejected. Old 0.3 pixel profiles are not reinterpreted as millimetres.

`mode: 'technical_format'` explicitly permits presentation layout changes: fixed outer/chart rectangles, margins, caption space, tick presentation, requested intervals, legend positioning and requested supplied notation. `mode: 'native_style'` retains authored layout/tick/label policies. Neither mode changes native data values, scale type, numeric ranges, ordering/interpolation, camera, mesh topology or quantitative arrays.

`roles.<role>.dash_mm` is an even-length array of positive dash/gap values; empty means solid. `marker_mm` is maximum un-stroked outline size, not nominal API size or visible ink including its edge. `max_markers` changes display frequency, not the data array. Width, colour, dash and marker channels each need a decorative binding. `roles` are profile tokens, never authority to erase a numeric or categorical encoding.

## Axis title placement

`axes.label_position` accepts `"center"`, `"end"` or `"arrowhead"`. Arrowhead mode places horizontal X/Y labels next to the right/top tips with a 1.5 mm nominal gap. Long X titles move above the tip to avoid right-margin clipping. It requires technical formatting and enabled metadata label formatting. `axes.ends: "plain"` uses endpoint placement instead. These are user-selected presentation rules, not universal standards mandates.

## Adapter

`createTechnicalAdapter(Plotly, graphDiv, {withExclusive, bindings, readProtectedState?, readRevision?, awaitSettled?, allowUntestedVersion?})` attaches to an existing rendered instance. The default tested engine is Plotly.js 3.3.1. Passing `allowUntestedVersion: true` bypasses a gate; it does not qualify that version.

`plan(profile)` returns a frozen instance-scoped plan without writing. `apply(plan)` consumes that plan after checking the captured state. `applyProfile(profile)` performs both steps under the shared runner. These return `{plan, report}`. `capture()`, `undo()`, `canUndo`, `profile`, and `dispose()` complete the API. Plans are not a generic object-path execution format and cannot be imported from arbitrary JSON and applied.

Other host writers and snapshot jobs must share `withExclusive`. Native interactions during a live application update need a host policy; the viewer visibly pauses pointer interactions while busy. Native configuration comparisons do not prove arbitrary third-party plugin behavior. Supply a protected state reader for relevant external state. Callback functions remain in the host and are not serialized as source.

## Publication

`publishTechnicalSVG(Plotly, graphDiv, profile, bindings, {strict:true})` constructs an isolated native figure, applies the selected geometry, exports SVG, inspects that actual output and rejects required failures. It returns `{svg, report}`. `strict:false` returns the failed proof and report for diagnosis; do not distribute a failed proof as accepted publication.

`publishTechnicalPNG(...)` returns `{bytes: Uint8Array, report}`. The pixels and pHYs are inspected. 2D source-SVG checks remain clearly marked as source checks; 3D detail geometry is nominal. Caption overflow fails before publication. Export never resets/resizes the live scene.

`inspectTechnicalSVG(svg, profile, bindings, nativeData)` can independently recheck an exported vector artifact. Tampered viewport dimensions fail. `inspectCaptionGeometry(profile)` checks rendered caption glyph bounds. Measurement requires a browser DOM/font environment.

`makeTechnicalHTML(native, profile, bindings, plotlyRuntimeSource, technicalRuntimeSource)` packages an interactive local HTML figure; the runtime strings must be trusted code supplied by the application/build, never untrusted chart data. The build script demonstrates the complete bundling path. `makePrintHTML` produces an explicit browser print sheet, not a direct certified PDF export.

`technicalDimensions(profile)`, `quantityLabel`, `parseDashMM`, `planTechnicalStyle`, `applyTechnicalOperationsToCopy`, `resolveTechnicalFontPx`, `crc32`, `withPNGResolution` and `readPNGGeometry` are also exported and have TypeScript declarations.

## Recovery and persistence

A native JSON export contains figure arrays/layout and a technical sidecar. Executable callbacks, shaders and plugin modules must be retained in a source package. The viewer's JSON importer deliberately accepts a limited safe subset. Save profile or native JSON before closing; the local server never writes chart files automatically.

The old `createPlotlyAdapter` / `profiles` API is retained for compatibility and emits its original 0.3 report format. New integrations should use the technical API above.
