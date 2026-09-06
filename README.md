# Fleet Lab

An interactive companion to *Last Mile Delivery Capacity Planning with Two-Sided Uncertainty* by **Castillo, Posner, Sodero, and Zinn**, published in the *Journal of Business Logistics*.

Configure delivery demand, crowd availability, costs, reliability, and supply tiers; compare fleet strategies; and replay a sampled day on an animated district map.

**[Open Fleet Lab](https://professorcastillo.github.io/hybrid-fleets/)**

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5186/**. Vite uses `strictPort`; port 5173 is reserved for another project. Use the development server to run the React/TypeScript app.

```sh
npm run build             # Static app + standalone dist/twosided-core.js
npm run preview           # Production preview on 127.0.0.1:5187
npm test                  # Numerical routines and application behavior
npm run test:coverage
npm run validate          # Run software tests and write their report
npm run compare-settings  # Explore the app's calculation settings
npm run precompute        # Rebuild the five experiment datasets
```

## Explore the model

- Configure demand and crowd supply uncertainty, synchronization, delivery costs, reliability, and 2–8 supply tiers.
- Compare fixed hybrid, private-only, crowd-only, and custom private-capacity scenarios using the same simulated days.
- Watch private and crowd deliveries move across an animated district. Pause, restart, seek, change playback speed, or select another day.
- Explore cost curves, supply tiers, daily cost components, and the distribution of conditional capacity.
- Run five sets of experiments, use your own scenario inputs, and export charts, CSV data, or parameters.
- Read the study's five propositions, equations, and manuscript.
- Save a scenario locally, share its parameters by URL, and use the app on desktop or mobile in light or dark mode.

## How the app works

A seeded Monte Carlo simulation draws daily demand and crowd capacity. The app calculates conditional capacity for each supply draw and offers a fixed fleet planning extension for comparing one fleet commitment across simulated days. Cost summaries include private capacity, crowd assignments, idle capacity savings, and unassigned deliveries.

The animated district illustrates the selected day's allocations using weighted vehicle batches. Its roads, destinations, and playback clock are illustrative. Reliability is included in expected unit costs. See [Model settings](DECISIONS.md) for the app's configurable calculations and defaults.

All calculations run in a browser Web Worker. No backend, account, paid map service, or external data upload is required. Saved scenarios stay in the visitor's browser; shared links contain the selected parameters and seed.

## Project structure

```text
app/src/                    React UI, Canvas animation, worker
app/public/precomputed/     Experiment datasets and software-check output
app/public/sources/         Manuscript, Java export, and app documentation
packages/core/src/          Numerical and simulation routines
packages/core/test/         Software tests
scripts/                    Software checks and data generation
PLAN.md                     Application development plan
DECISIONS.md                Model settings and app design choices
CALCULATION_SETTINGS.md     App calculation-setting examples
VALIDATION.md               Software test report
QA.md                       Build and browser checks
```

Change the default scenario in `packages/core/src/presets.ts`, then run software checks and precompute the experiment datasets. Copy updated app documentation into `app/public/sources/` before rebuilding. The supplied manuscript and Java export are preserved at the repository root.

## GitHub Pages

The **Deploy Fleet Lab** workflow tests, builds, and publishes the app on every push to `main`. It can also be run manually from the repository's Actions tab. In **Settings → Pages**, the build source is **GitHub Actions**.

The workflow sets the site's base path so scripts, the simulation worker, experiment data, and manuscript links work at `/hybrid-fleets/`. To preview that build locally:

```sh
VITE_BASE_PATH=/hybrid-fleets/ npm run build
npm run preview -- --base /hybrid-fleets/
```

Open **http://127.0.0.1:5187/hybrid-fleets/**. For other static hosts, `npm run build` creates `dist/` with relative asset paths by default. Set `VITE_BASE_PATH` to override that base.

Deployment uses committed experiment datasets. Run `npm run precompute` and commit its output when updating them. The downloadable manuscript is served separately from the app's initial assets.

## Future app features

Historical CSV calibration, 3PL contracting scenarios, route planning, service-level constraints, and localization.
