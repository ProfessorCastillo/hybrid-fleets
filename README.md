# Fleet Lab

An interactive companion to *Last Mile Delivery Capacity Planning with Two-Sided Uncertainty*. Configure delivery demand, crowd availability, costs, reliability, and supply tiers; compare fixed fleet strategies; replay a sampled day on an animated district map.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5186/**. Port 5173 is reserved for another project. Vite uses `strictPort` so it cannot silently choose or occupy another port. Opening `index.html` with a `file://` URL will not run this React/TypeScript app.

```sh
npm run build        # Static app + standalone dist/twosided-core.js
npm run preview      # Production preview on 127.0.0.1:5187
npm test             # Mathematical and model tests
npm run test:coverage
npm run validate     # Writes implementation checks and diagnostics
npm run reconcile    # Controlled convention audit against the Java calculation
npm run precompute   # Rebuilds all five experiment datasets
```

## Included

- React/TypeScript sandbox with demand and supply uncertainty sliders, editable costs and 2–8 supply tiers, reliability, synchronization, seeded presets, and distribution conventions.
- Worker-based, cancellable recalculation; dependency-free TypeScript model core.
- Fixed hybrid, private-only, crowd-only, and custom private capacity policies evaluated on common draws.
- Animated district with weighted delivery batches, play/pause/restart, seeking, speed, day selection, and route display. The map uses the selected policy's actual allocations for the chosen draw.
- Cost curve and supply interval, daily cost components, supply ladder, conditional-Q histogram, and per-iteration inspection.
- 565 precomputed experiment cells × 1,000 draws, with live reruns, CSV/PNG export, and parameter export.
- All five propositions, mathematical explanations, source downloads, and reconciliation notes.
- Local saved scenario, shareable parameter/seed URL, light/dark themes, keyboard sliders, and responsive mobile layout.

## Model fidelity

**This browser reconstruction is not yet validated as a faithful replication.** The published results are the reference to reproduce. The initial app made substantive choices about the threshold, demand conditioning, calibration, and optimization objective. Its failure to reproduce some benchmarks establishes an implementation validation gap, not an error in the published paper. See `IMPLEMENTATION_AUDIT.md` for the controlled comparison with the supplied Java calculation.

The paper's procedure optimizes separately for each supply draw and reports mean conditional Q*. The sandbox adds a distinct fixed planning calculation, solving the critical fractile after averaging over supply draws. This one fleet commitment stays fixed across simulated days. The cost curve corresponds to this fixed decision. At the empirical default inputs and seed 42, the implementation gives conditional mean Q*=545.151 and fixed Q=580; the paper reports 345 for its empirical case.

The map is an educational allocation visualization. Roads, destinations, movement speeds, and the 08:00–18:00 clock are illustrative. It does not solve a routing problem, predict ETAs, count literal vehicles, or estimate on-time delivery. Reliability enters expected costs; the map does not add a second stochastic failure penalty.

See `DECISIONS.md` for the app's provisional table selections, cost rounding, demand convention, and experimental cost-split assumptions. Final citation metadata and the later Java implementation remain author-confirmation items.

## Structure

```text
app/src/                    React UI, Canvas animation, worker
app/public/precomputed/     Five experiment datasets + reproduction checks
app/public/sources/         Supplied manuscript/Java + decision/validation docs
packages/core/src/          Framework-free numerical and model implementation
packages/core/test/         Model verification
scripts/                    Reproduction diagnostics and precomputation
PLAN.md                     Independent implementation plan
DECISIONS.md                Source reconciliation and scope decisions
VALIDATION.md               Observed vs expected research results
QA.md                       Build, browser, and responsive checks
```

Change calibration in `packages/core/src/presets.ts`, then run validation and precomputation again. Copy changed source notes into `app/public/sources/` before rebuilding. The unmodified supplied manuscript, PRD, and Java export are preserved at the repository root.

## Static hosting

Live app: **https://ProfessorCastillo.github.io/hybrid-fleets/**

The **Deploy Fleet Lab** GitHub Actions workflow tests, builds, and publishes the app on every push to `main`. It can also be run manually from the repository's Actions tab. In **Settings → Pages**, the build source is **GitHub Actions**. The workflow uses the site's configured base path, so application assets, the simulation worker, experiment data, and source downloads work at `/hybrid-fleets/`.

`npm run build` creates `dist/` with relative asset paths by default, suitable for other static hosts. Set `VITE_BASE_PATH` to override that base. To preview the GitHub Pages build locally:

```sh
VITE_BASE_PATH=/hybrid-fleets/ npm run build
npm run preview -- --base /hybrid-fleets/
```

Open **http://127.0.0.1:5187/hybrid-fleets/**. The main application is approximately 200 kB gzipped including its worker and styles; the downloadable 6.1 MB manuscript is separate and is not loaded at startup. Deployment uses the committed experiment datasets; run `npm run precompute` and commit its output when intentionally updating them.

The app has no backend, authentication, analytics, map-service dependency, or external data upload. Shared links contain model parameters, so use data appropriate to share.

## Deferred

Historical CSV calibration, a dedicated 3PL extension, routing/traffic/service-level modeling, localization, Lighthouse certification, and faithful publication reproduction after implementation validation. These do not prevent use of the current local sandbox.
