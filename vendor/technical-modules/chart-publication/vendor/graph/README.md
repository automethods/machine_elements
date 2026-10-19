# Graph Studio 0.4.1

Technical formatting for existing native Plotly.js charts. The viewer and reusable library use the same formatter and publisher. The engine remains Plotly.js 3.3.1; no source-to-image digitization or second plotting engine is involved.

## Run the delivered folder

```sh
sh run.sh
```

The prebuilt `Graph_Studio.html`, `run.sh`, `launch-viewer.mjs` and `launch_viewer.py` are peers at the folder root. One installed Node.js 18+ or Python 3.8+ runtime is sufficient. Nothing is installed or downloaded at startup. The server is read-only and binds to 127.0.0.1, with no directory listing, writes or arbitrary file serving. Use `sh run.sh --port 8090` for another port and Ctrl+C to stop. `sh run.sh` works even if Drive strips executable permissions. Without a runtime the self-contained HTML can be opened directly in a browser; direct file-navigation is not qualified by the managed test browser.

## Use the library

Install the supplied local `graph-technical-chart-adapter-0.4.1.tgz` into your own project. The library does not bundle an engine dependency; pass your pinned Plotly.js runtime and existing chart.

```js
import {
  cloneTechnical, technicalProfiles, createTechnicalAdapter,
  createExclusiveRunner, publishTechnicalSVG,
} from '@graph/technical-chart-adapter';

const runExclusive = createExclusiveRunner();
const profile = cloneTechnical(technicalProfiles.ua);
profile.page.width_mm = 160;
profile.roles.primary.width_mm = 0.6;
profile.roles.primary.dash_mm = [4, 2];
// Native source label strings stay unchanged until explicitly requested.
profile.axes.labels = false;
profile.caption.title = 'My engineering result';
const bindings = [{
  index: 0, role: 'primary',
  channels: {width: 'decorative', dash: 'decorative'},
}];
const adapter = createTechnicalAdapter(Plotly, graphDiv, {
  withExclusive: runExclusive, bindings,
});
const plan = await adapter.plan(profile);
console.table(plan.operations);
await adapter.apply(plan);
const {svg, report} = await runExclusive(
  () => publishTechnicalSVG(Plotly, graphDiv, profile, bindings)
);
```

All application writers and snapshot jobs must share the same exclusive update boundary. A stale plan is rejected. The adapter never assumes an unbound colour, size, dash or marker is decorative. A numeric array cannot be overwritten even if a binding falsely calls it decorative. Browser export functions require a DOM and a fully initialized native engine. Keep source modules for callback/plugin/typed-array workflows; plain JSON is not arbitrary source reconstruction.

The old pixel-profile API remains available for compatibility. `technicalProfiles`, `createTechnicalAdapter` and the publication functions are the new millimetre-based API. The top-level `VERSION` is 0.4.1; reports from the preserved legacy API retain their own 0.3 schema/version. Do not mix legacy pixel profiles with technical millimetre profiles.

## Working features

Millimetre outer/plot geometry, margins and caption space; independent axis/curve/major/minor grid classes; physical dash/gap lengths and offset; SVG caps/joins; calibrated marker outlines; linear tick intervals; arrowheads; quantity notation and axis title placement; caption/source/notes composition; font em sizing and optional H-cap metric calibration; monochrome and technical colour profiles; real native source comparison, data recovery, dry-run, apply and undo; interactive HTML, measured SVG, DPI-tagged PNG, and a browser print sheet.

The renderer route and any unqualified properties are explicit. See [STYLES_v0.4.1.md](STYLES_v0.4.1.md), [docs/API.md](docs/API.md) and [docs/VALIDATION.md](docs/VALIDATION.md).

## Reproduce tests and build

```sh
npm test
npm run build
python tests/launcher_checks.py
python tests/axis-labels-browser.py
xvfb-run -a python tests/browser_checks.py
xvfb-run -a python tests/viewer-controls.py
tsc --noEmit --strict --target ES2022 --module NodeNext \
  --moduleResolution NodeNext --lib ES2022,DOM tests/consumer.ts
```

`npm test` and build use only Node standard libraries. Browser tests additionally require an installed Python Playwright package, Chromium and an X display (Xvfb on the tested Linux host). These developer test dependencies are NOT needed to run the delivered viewer. Tests block external network access and record results in `evidence/`. The browser harness renders the complete HTML bytes inline because the managed browser blocks file/HTTP navigation. The actual launcher is separately tested over HTTP.

## Packaging

`npm pack` produces the reusable library with declarations and documentation. `scripts/build.mjs` rebuilds the self-contained viewer from `src/`, `viewer/`, `examples/fixtures.js` and the unchanged bundled Plotly runtime. The delivery manifest identifies exact runtime/source bytes. No font binaries are included. Public-network hosting, authentication, and unattended multi-user operation are not provided by this local launcher.
