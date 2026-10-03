# H08 — PDF and 3D rendering code blocks the initial sheet load

Status: **Resolved in newer local main**, excluded from the open bug count. Originally medium severity, confirmed at `8a0544f`.

Commit `1864673` defers the PDF and 3D tools. This finding was reproduced before those commits were integrated into the review worktree; the final review checks the updated build separately.

## Reproduction and evidence

Build the app and serve its generated assets with gzip. Load it with an empty browser cache, 200,000 bytes/second download throughput, 150 ms latency, and 4× CPU throttling. The character inputs appear after **4.43 seconds**; first contentful paint occurs at **4.42 seconds**. The single entry JS resource takes **3.82 seconds** and transfers **710,866 compressed bytes** / **2,266,341 decoded bytes**.

The page loads this entire module before the user exports a PDF or opens a dice roller. This is a controlled slow-device/network scenario, not a production latency measurement. Evidence: `hiveborn-front-build.log`, `serve-hiveborn-build.mjs`, `hiveborn-cold-start.js`, and `browser-results.json:H08startup`.

## Cause

`src/hiveborn/character_sheet/components/character_buttons.tsx` imports the PDF generator eagerly. Dice UI also imports the Three.js rendering graph eagerly, including the sheet overlay. Vite emits a single 2.27 MB entry JavaScript chunk rather than keeping these optional features behind interaction-driven imports.

## Suggested fix

Dynamically import the PDF generator when an export is requested. Split the 3D renderer and overlay behind lazy boundaries while keeping basic roll calculation and the sheet usable immediately. Show a small loading state for the optional feature and avoid importing the same heavy renderer elsewhere in the initial graph.

Regression: inspect the production entry graph and repeat the same cold-load profile. Initial navigation must not request the PDF/3D chunks; activating each feature must still work. Retain the measurements as a comparison, not a universal timing threshold.
