# Runtime sources

- engdoc: `/media/cigameca/SHARED/Work/engdoc_text_work`, package 0.1.0,
  browser bundle of `dist/native-session.js`; exact SHA-256 in `engdoc-SOURCE.json`.
  Refresh using `npm run vendor:engdoc` with the source's installed esbuild.
- Graph 0.4.1: `Graph/new/Development v0.4.1/graph-technical-chart-adapter-0.4.1.tgz`;
  source modules and MIT license are included unchanged in `graph/`.
- Plotly 3.3.1: `Graph/new/Development v0.4.1/Graph_Studio_v0.4.1.zip`,
  `Graph/vendor/plotly-3.3.1.min.js`; MIT license in `LICENSE.plotly-js.txt`.
- MathJax: local deployed runtime copied from `Automobile/new/vendor/mathjax`;
  associated license and notices remain in that folder.
- College logo: copied from `Automobile/new/Images/logo.svg`.

Original upstream sources and source literature are retained unchanged; local adapters are separate.

- Three.js r183: existing local `Engine_motor/ICE/vendor/three`; only core, ES module, OrbitControls and MIT licence copied. Exact hashes in `three/SOURCE.json`. Geometry and calculation state are supplied by this worksheet, not by the renderer.

- Browser favicon: homepage circled-A geometry from `Home_page/dist/assets/favicon.svg`, recolored to this project's green `#4d7358` at the user's request. Geometry equality and variant hash are recorded in `../docs/favicon-verification.json`. Other modules retain their own icons. Reducer artwork remains the subject illustration.

- Shared gear geometry: `../vehickle_math_models/modules/gear-geometry`, module 0.1.1 / bundle 0.8.2. The verified consumer is `technical-modules/`, with licences and exact release/file hashes in `pin.json`. BOSL2 commit `6cacf1b7…` (BSD-2-Clause), McCracken PlanetaryGears `9ed95215…` (Apache-2.0), Earcut `765470e7…` (ISC). Full provenance is in `gear-geometry/vendor-sources.json`. Five precomputed family examples and two default stages are in `../data/gears/`, with per-mesh hashes.
- OpenSCAD 2021.01: official Linux AppImage, extracted locally at `../../vehickle_math_models/tools/openscad-2021.01/`; GPL-2.0 tool, retained notices and download hash in its `SOURCE.json`. Only custom geometry generation uses this separate shared CLI. It is not copied into static/browser distributions.

- Active chart publication uses the pinned shared `technical-modules/chart-publication` 0.1.0 (Graph 0.4.1, MIT). Only the inspection transform is corrected to a common screen coordinate frame for Firefox and Chromium. The original Graph snapshot remains in `graph/` and the shared validation before-image; geometry/text-fit checks are not bypassed.
