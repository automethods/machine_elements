# Shared chart publication 0.1.0

Owns the local Graph 0.4.1 publication correction for Firefox/Chromium. MIT source and licence are retained under vendor/graph; the independent original publication module is in validation/origins/graph-0.4.1.

The sole upstream correction changes inspection from getCTM to getScreenCTM for both root and descendant. Firefox's outer-root getCTM excludes the viewBox scale while descendant matrices include it, causing false measured widths of 37.795% of the requested mm geometry. One common screen coordinate system restores the root-relative transform. Native chart data, rendered SVG, page dimensions, line widths and all strict conformance tests are preserved. This does not switch strict checks off.

Import the existing Graph API from index.mjs. The caller still supplies Plotly, profile and bindings. Source snapshots retain original hashes; consumers use the standard verified publisher.
