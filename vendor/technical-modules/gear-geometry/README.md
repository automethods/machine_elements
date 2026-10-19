# Shared gear geometry and planetary motion 0.1.1

Canonical owner: `module.mechanics.gear-geometry`. The original libraries are local under `vendor/`, pinned by Git commit, archive hash and file hashes in `vendor-sources.json`:

- BOSL2 `6cacf1b7…`: BSD-2-Clause, untouched upstream library. Spur, helical, straight bevel, cylindrical worm with enveloping wheel, and internal planetary ring geometry.
- McCracken PlanetaryGears `9ed95215…`: Apache-2.0. Original source retained. `upstream-planetary.mjs` appends only an ES-module export; numerical algorithms remain upstream.
- Earcut `765470e7…`: ISC. Triangulates the genuine BOSL2 internal ring region, avoiding slow OpenSCAD hole triangulation. Area and mesh topology are checked. No external CDN or npm install at runtime.

`index.mjs` exports request validation, examples, the inherited analytical profile fallback, and `evaluatePlanetary`. `node.mjs` exports `generateGearGeometry` and `gearRequestKey`. The request uses metres, radians and rad/s. This boundary converts once to BOSL2 mm/degrees and converts generated points back to metres. McCracken circular pitch is π times module; seconds convert once to its millisecond motion query.

```js
import {exampleGearRequest,evaluatePlanetary} from './index.mjs';
import {generateGearGeometry} from './node.mjs';
const mesh = await generateGearGeometry(exampleGearRequest('worm'));
const motion = evaluatePlanetary(exampleGearRequest('planetary'));
```

OpenSCAD 2021.01 is locally extracted under `../../tools/openscad-2021.01/`, with its upstream licence notices. No system install, FUSE or global profile changes. Pass `{openscadPath}` or use `vmm_openscad` to select another local CLI. Validated numbers generate fixed source templates; requests never supply executable SCAD or shell text. Temporary files are isolated and removed. Geometry refuses warnings, missing parts, malformed meshes and timeouts.

Publish a checked consumer subset through the existing infrastructure:

```sh
node ../publish.mjs --project=/path/to/Machine_elements --module=module.mechanics.gear-geometry
```

The consumer pin advertises only selected modules while retaining the full producer release digest. Existing consumers and default full-bundle publishing retain their behavior. Geometry presets can be bundled for static/offline viewing; custom generation needs the local OpenSCAD runtime.

Basis: x=0. Helical module/pressure angle are **normal** values; opposite helix hands mate. Bevel face width runs along the pitch-cone generator and both cone apexes coincide; straight teeth use spiral=0 and cutter_radius=0. Worm-wheel width is solved against BOSL2's own thickness function. The planetary ring is an actual internal-tooth cavity with an explicitly adopted rim thickness. Planet spacing, integer teeth, divisibility and tip-circle clearance are checked. Kinematic motion comes from McCracken's model, including carrier-relative planet spin and phasing.

Geometry/kinematics do not establish allowable stresses, bearing axial loads, efficiency, lubrication, thermal behavior or manufacturing tolerances. OpenSCAD echo coordinates have six significant digits. The inherited analytical SVG fallback keeps its explicitly approximate radial root transition. Consumer calculations remain independently identified; a geometry example never switches the current engineering task.


Browser deployment: [parametric generation without a geometry server](BROWSER.md). `generateBrowserGearGeometry(request)` returns the same SI packet contract as the optional CLI generator.
