# PRD: Two-Sided Uncertainty Capacity Planner

Interactive web app implementing the adapted two-stage newsvendor (NVP2S) model from *Last Mile Delivery Capacity Planning with Two-Sided Uncertainty* (Castillo, Posner, Sodero, and Zinn, Journal of Business Logistics). The app lets a user set demand uncertainty, crowdsourced (CD) labor supply uncertainty, supply correlation, and cost parameters, then runs the Monte Carlo simulation optimization in the browser and shows the optimal private delivery (PD) capacity Q\*, the cost breakdown, and the paper's experimental sweeps.

**Status:** v1.0 draft for agent handoff
**Owner:** Vince Castillo
**Build team:** one Opus agent (architecture, simulation core, verification), one Sonnet agent (UI, charts, tests, docs)

---

## 1. Purpose and audience

The paper examines capacity planning under uncertain delivery demand and crowd supply. The app lets managers and students explore how uncertainty changes capacity choices and costs.

Primary uses, in priority order:

1. **Teaching demo.** Live in a classroom or keynote. Must load fast, run in under two seconds for a single scenario, and be legible on a projector.
2. **Reader companion.** Someone who has read the paper reproduces Figures 4 through 6 and Appendix S3 and S4 with their own parameters.
3. **Managerial what-if.** A planner enters their own demand mean, tier costs, and failed-delivery cost and gets a Q\* recommendation with a cost curve.

Non-goals for v1: multi-market planning, routing, service-level modeling, user accounts, any backend.

---

## 2. Research sources and app settings

The companion uses the manuscript, supplied Java export, and configurable scenario inputs to support interactive exploration of the study.

| Source | Role |
| --- | --- |
| `Two_Sided_Uncertainty___JBL_Minor_Revision_Decision.pdf` | Research background, model notation, propositions, and experiment design. |
| `anylogic-model-java.txt` | Reference for simulation routines, capacity search, cost calculations, and supply sampling. |
| `DECISIONS.md` | Browser app settings and design choices. |

### 2.1 Calculation settings

Expose editable crowd tiers, reliability-adjusted costs, demand distribution options, and supply synchronization. Default to five crowd tiers, with 2–8 tiers supported. Keep fixed fleet planning and conditional capacity outputs clearly labeled. The advanced Java cost setting provides an additional way to explore capacity calculations.

### 2.2 Supply synchronization

The synchronization control mixes tier-specific and shared supply draws. Describe ρ as the weight assigned to shared availability and show the resulting capacity distribution for the visitor's chosen scenario.

---

## 3. Product decision: stack

**Decision: React + TypeScript + Vite, static build, no backend.** Simulation core is a dependency-free TypeScript package run inside a Web Worker.

Why not a single HTML file: the experiment sweeps (up to 5×5×3×3 cells × 1,000 iterations = 225,000 optimizations) need a worker to keep the UI responsive, and the sim core needs a real test suite to hit the validation targets in Section 8. Vite still emits a folder you can drop on GitHub Pages or Fisher's static hosting.

Escape hatch: the sim core must be buildable as a standalone ES module (`dist/twosided-core.js`) so a single-file HTML demo can import it later if wanted.

| Concern | Choice |
|---|---|
| Framework | React 18, TypeScript strict, Vite |
| State | `useReducer` + context. No Redux. |
| Charts | Recharts for line/bar/area. Plotly.js only if a heatmap or 3D surface is added in v2. |
| Styling | Tailwind. Light and dark theme. |
| Worker | Vite native worker (`new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' })`) |
| RNG | Seeded PRNG (mulberry32 or sfc32). Every run reports its seed. |
| Tests | Vitest. Core coverage target 90%. |
| Lint/format | ESLint + Prettier, defaults. |
| Deploy | `npm run build` → `dist/`. Include a `deploy.yml` GitHub Actions workflow for Pages. |

Repo name: `two-sided-uncertainty-app`. Package name: `@castle-analytics/twosided`.

---

## 4. Model specification (canonical)

All notation follows Table 1 of the paper. Money in R$ unless the user changes the currency label (label only, no conversion).

### 4.1 Inputs

```ts
interface ScenarioParams {
  // Demand
  demandMean: number;          // μ, default 759.9
  demandCV: number;            // CV_D in [0, 1.5], default 0.34 (empirical)
  demandTruncation: 'none' | 'zero' | 'zeroAnd3Sigma'; // default 'zero'

  // PD capacity
  pdUnitCost: number;          // a, default 20.3 (must equal laborCost + operatingCost)
  laborCost: number;           // l, default 2.8
  operatingCost: number;       // v, default 17.6 (salvage on idle PD)
  pdReliability: number;       // r_priv, default 0.986

  // CD tiers (ordered by cost ascending; UI enforces sort)
  tiers: Array<{
    name: string;              // "Low cost motorcycle", "Car", "Van", "Premium moto", "Super premium moto"
    unitCost: number;          // b_i, defaults {8.8, 10.8, 17.3, 22.0, 28.7}
    meanCapacity: number;      // B̄_i, defaults {16.5, 389.8, 9.0, 67.5, 42.0}  (see D9)
  }>;
  cdReliability: number;       // r_CD, default 0.981
  supplyCV: number;            // CV_S in [0, 1.2], default 0.36 (empirical)
  supplyCorrelation: number;   // ρ in [0, 1], default 0.0
  commonMeanCapacity?: number; // default: capacity-weighted mean of tiers (paper: 322.1). Editable.

  // Failure
  failedDeliveryCost: number;  // u, default 35.1

  // Simulation
  iterations: number;          // default 1000, range 100 to 10000
  seed: number;                // default 42
  convention: 'paper' | 'legacyJava'; // default 'paper'
}
```

Validation rules (reject with a readable message):
- `a = l + v` within 1e-6, and `a < u`.
- Every `b_i ≤ u` (paper: trivial otherwise).
- Tier costs strictly increasing after sort; tiers with equal cost are merged (sum capacities).
- `0 < r ≤ 1` for both reliabilities.
- Beta scale: `meanCapacity / 1000` must lie in (0, 1). If a user enters a mean > 1000, raise the scale to the next power of ten and say so.

### 4.2 Per-iteration procedure

Implements Table 3 of the paper.

```
for k in 1..iterations:
  1. Sample demand D̃ ~ Norm(μ, σ = CV_D · μ), truncated per demandTruncation.
     If CV_D == 0, D̃ = μ exactly.
  2. Sample CD supply per tier i:
       scale = 1000 (or the raised scale)
       μ_i = meanCapacity_i / scale;  σ_i = CV_S · μ_i
       (α_i, β_i) = betaParams(μ_i, σ_i)        // Section 4.3
       (α_c, β_c) = betaParams(μ_c, CV_S · μ_c) // common distribution
       X_i ~ Beta(α_i, β_i);  X_c ~ Beta(α_c, β_c)   // X_c drawn once per iteration
       B_i = scale · ((1 − ρ) · X_i + ρ · X_c)
     If CV_S == 0, B_i = meanCapacity_i exactly (do not sample a near-degenerate Beta).
  3. Expected unit costs:
       ā   = r_priv · a + (1 − r_priv) · u
       b̄_i = r_CD · b_i + (1 − r_CD) · u
  4. Cheap-tier transformation (convention 'paper'):
       w = number of tiers with b_i < v            // paper default: 3 (8.8, 10.8, 17.3 < 17.6)
       S_w = Σ_{i≤w} B_i
       cheapUsed = min(D̃, S_w)
       cheapSpend = Σ over tiers 1..w of (deliveries taken from tier i) · b̄_i, filling cheapest first
       D = max(D̃ − S_w, 0)
       Remaining tiers N' = {w+1..n}, re-indexed 1..m with costs b̄'_i and capacities B'_i
       Remaining-demand CDF: F(x) = F_D̃(x + S_w) for x ≥ 0
     (convention 'legacyJava': w = 0, b̄_0 = 0, no transformation; alternative app calculation setting)
  5. Critical fractile (Appendix S1):
       b̄'_0 = v,  b̄'_{m+1} = u
       C_i = Σ_{j≤i} B'_j,  C_0 = 0
       H(Q) = [ Σ_{i=0}^{m} (b̄'_{i+1} − b̄'_i) · F(Q + C_i) ] / (u − v)
       RHS = (u − ā) / (u − v)
       Q* = smallest integer Q in [0, Qmax] with H(Q) ≥ RHS, Qmax = ceil(μ + 4σ) + 1
       (binary search; H is nondecreasing in Q; if H(Qmax) < RHS return Qmax and flag)
  6. Realized cost for this iteration at Q*:
       pdFixed     = ā · Q*
       idle        = max(Q* − D, 0);  idleSavings = v · idle
       cdDeliv     = min(max(D − Q*, 0), C_m)
       cdSpend     = fill cdDeliv from tiers 1..m cheapest first at b̄'_i
       missed      = max(D − Q* − C_m, 0);  penalty = u · missed
       total       = pdFixed − idleSavings + cheapSpend + cdSpend + penalty
     This equals G(Q, D, B) in Appendix S1 plus cheap-tier spend. Assert equality in tests.
  7. Record: D̃, D, B_i, S_w, Q*, H(Q*), RHS, each cost component, total, PD share, CD share, missed.
```

### 4.3 Numerical helpers (own implementations, tested)

- `betaParams(μ, σ)`: α = ((1 − μ)/σ² − 1/μ)·μ², β = α·(1/μ − 1). Must reproduce Table S2.1 to two significant figures for CV_S ∈ {0.2, 0.4, 0.6, 0.8}. Guard: if σ² ≥ μ(1−μ) the Beta is invalid; clamp σ to 0.999·sqrt(μ(1−μ)) and set a warning flag on the result.
- `sampleBeta(α, β, rng)`: via two Gamma draws (Marsaglia and Tsang), X/(X+Y). For α < 1 use the boost trick (sample Gamma(α+1) and multiply by U^{1/α}).
- `sampleNormal(rng)`: Box-Muller or Marsaglia polar.
- `normalCdf(x, μ, σ)`: erf-based, absolute error < 1e-7. Truncated variants divide by the truncation mass.
- Seeded PRNG with `fork(k)` so each iteration k has its own stream; parallel sweeps then reproduce exactly regardless of worker count.

### 4.4 Aggregate outputs per scenario

```ts
interface ScenarioResult {
  params: ScenarioParams;
  n: number;
  qStar: { mean: number; sd: number; p05: number; p50: number; p95: number; histogram: Bin[] };
  cost: {
    total: Stat; pdFixed: Stat; idleSavings: Stat; cheapTierSpend: Stat;
    cdSpend: Stat; penalty: Stat;                       // Stat = {mean, sd, p05, p95}
    expectedPdUnitCost: number;                         // ā (Table 7 column 3)
    avgExpectedCdUnitCost: number;                      // total CD spend / total CD deliveries (Table 7 column 4)
  };
  allocation: { pdShare: number; cdShare: number; missedShare: number }; // of D̃
  supply: { meanTierCapacity: number[]; meanTotalCapacity: number; meanCheapCapacity: number };
  warnings: string[];
  seed: number;
  elapsedMs: number;
}
```

### 4.5 Cost curve (for the Explorer, not in the paper)

For a fixed scenario, evaluate expected total cost across Q ∈ {0, 10, 20, …, Qmax} using the same sampled (D̃, B) draws for every Q (common random numbers). Plot E[G(Q)] with a 5th to 95th percentile band and mark Q\* from step 5. The curve minimum and the fractile Q\* should agree within one grid step; assert this in tests for CV_D ∈ {0.2, 0.4} with `convention: 'paper'`.

### 4.6 Fleet comparison (Appendix S3)

Three policies evaluated on the same draws:
- **Hybrid:** Q\* from Section 4.2.
- **PD-only:** Q = Qmax-ish. Paper is silent on the exact rule. Use Q = the PD capacity that would satisfy demand at the 99th percentile, ceil(μ + 2.33σ), and expose this as a setting. No CD used; missed deliveries beyond Q cost u.
- **CD-only:** Q = 0. All demand to CD tiers cheapest first; shortfall beyond total CD capacity costs u.

Report mean total cost and a 95% CI for each policy.

### 4.7 Experiment sweeps (Table 4, S4.1, S5)

| Experiment | Factors | Cells | Reproduces |
|---|---|---|---|
| Base Case | CV_D × CV_S, each {0, .2, .4, .6, .8} | 25 | Figure 4, Table 7 |
| Exp 1 | + ρ ∈ {0, .5, 1} | 75 | Figure 5 |
| Exp 2 | + u ∈ {28.7, 35.1, 41.6} | 225 | Figure 6 |
| Exp 3 | Exp 1 + a ∈ {6.6, 20.3, 34.0} (l scales, v fixed unless user says otherwise) | 225 | Figure S4.1 |
| Fleet comparison | CV_S × ρ at empirical CV_D = 0.34 | 15 | Figure S3.1 |
| 3PL (v2) | Exp 1 × {no 3PL, 3PL} | 150 | Figure S5.1 |

Sweeps run at a user-set iteration count (default 300 for interactive, 1,000 for detailed exploration). Results cache in memory keyed by a hash of params; the app ships with a precomputed JSON of all paper-default sweeps at 1,000 iterations so the Figures tab renders instantly on load.

Private-cost sensitivity: scale labor and operating components proportionally as the visitor changes total private cost. Describe this app setting alongside the experiment.

---

## 5. Screens and features

Single-page app with a left-rail tab list. Every tab shares the same `ScenarioParams` state; changing a parameter on one tab changes it everywhere.

### 5.1 Explorer (default tab)

Purpose: the classroom slider demo.

Layout: parameter panel left (collapsible), results right.

Parameter panel, grouped:
- **Uncertainty**: CV_D slider (0 to 1.5, step .02), CV_S slider (0 to 1.2, step .02), ρ slider (0 to 1, step .05). Large numeric readouts.
- **Costs**: a (with l and v sub-fields), u, per-tier b_i in a compact editable table.
- **Supply**: per-tier mean capacity, common-distribution mean (auto, overridable), r_priv, r_CD.
- **Simulation**: iterations, seed, "Re-roll seed" button, convention toggle (hidden behind an "Advanced" disclosure).
- **Presets** dropdown: Empirical (paper Table 5), Low/Low, High/High, U-shape case (CV_S = 0.8 sweep), Cheap PD (a = 6.6), Expensive PD (a = 34.0). Plus "Save preset" to localStorage and "Copy shareable link" (params URL-encoded).

Results panel:
1. **Headline card**: Q\* mean with ±1 sd, PD/CD/missed share bar, expected total cost per day, ā vs average CD unit cost side by side (this is the "cheap on paper, expensive in practice" punchline).
2. **Cost breakdown** stacked bar: pdFixed, −idleSavings, cheapTierSpend, cdSpend, penalty.
3. **Cost curve** (Section 4.5) with Q\* marker. Toggle to show the three fleet policies as horizontal reference lines.
4. **Supply ladder** chart reproducing Figure 3: x = tier cost, vertical bar = tier capacity with 5th to 95th percentile whiskers from the current draws. Cheap tiers (b_i < v) shaded differently with a label "consumed first."
5. **Q\* histogram** across iterations.
6. **Iteration inspector** (collapsed): table of the first 50 iterations with all recorded fields, CSV export of all iterations.

Debounce: parameter changes queue a run 250 ms after the last change; a run in flight is cancelled. Show a thin progress bar. Target under 1 s at 1,000 iterations.

### 5.2 Figures (paper reproduction)

Tabs within tab: Base Case, Exp 1, Exp 2, Exp 3, Fleet Comparison. Each renders small multiples matching the paper's figure layout (lines by CV_S, x-axis CV_D, panels by ρ and u). Buttons: "Run with current parameters" (uses current non-factor params), "Reset to paper defaults," "Download CSV," "Download PNG." Show cell-level 95% CI on hover. Show the paper's figure number and caption under each chart.

### 5.3 Propositions

Five cards, P1 through P5, each with the proposition text verbatim from the paper, a one-paragraph plain-English explanation, and a **"Show me"** button that sets the Explorer or Figures view to the parameters that demonstrate it:
- P1: Base Case sweep, highlight the main diagonal.
- P2: Base Case with CV_S = 0.8 line isolated (U-shape).
- P3: Exp 1, fix CV_S = 0.4, animate ρ from 0 to 1.
- P4: Exp 2, fix ρ = 0, step u across three values.
- P5: Fleet Comparison at empirical parameters.

### 5.4 Methodology

Rendered markdown: model description in the app's own words, the H(Q) and G(Q,D,B) equations in KaTeX, the app settings from Section 2.1 and an explanation of supply synchronization, citation block for the paper, link to the repo, and version and commit hash.

### 5.5 Your Data (v1.1, ship if time allows)

Paste or upload a CSV of daily demand and per-tier daily capacity. App computes μ, CV_D, tier means, CV_S, and pairwise tier correlation (report the average off-diagonal Pearson r as a suggested ρ), fills the parameter panel, and stays client-side. No upload leaves the browser; say so on the screen.

---

## 6. UX and visual requirements

- Works at 1280×720 (projector) and 390px wide (phone) without horizontal scroll. Charts reflow.
- Dark and light theme following system, with a manual toggle.
- Numbers formatted with thousands separators, one decimal for currency, whole numbers for deliveries.
- Every chart has axis titles with units and a caption. Colorblind-safe palette (Okabe-Ito). Line styles differ in dash pattern as well as color, matching the paper's convention.
- Keyboard-operable sliders with arrow-key steps. All controls labeled for screen readers.
- No modal dialogs. Errors and warnings appear inline under the offending control.
- Loading state: skeleton, never a blank chart.
- Header: app title, "Based on Castillo, Posner, Sodero, and Zinn (Journal of Business Logistics)" with link, GitHub link, version.
- Footer note that this is a research demonstration, not operational advice.

---

## 7. Performance targets

| Scenario | Target |
|---|---|
| Explorer single run, 1,000 iterations, 5 tiers | < 1 s on a 2020 laptop, < 3 s on a mid-range phone |
| Base Case sweep, 25 cells × 300 iterations | < 5 s |
| Exp 2 sweep, 225 cells × 1,000 iterations | < 60 s, progress shown per cell, cancellable |
| Initial load (precomputed figures) | < 2 s, bundle under 600 kB gzipped |

Use a worker pool sized to `navigator.hardwareConcurrency − 1` (min 1, max 8) for sweeps. Per-cell seeds derive from the base seed so results are identical regardless of pool size.

---

## 8. Software verification

### 8.1 Numerical and accounting checks

Test normal CDF reference values, Beta shapes and sample moments, seeded random streams, monotonic capacity search, allocation conservation, cost identities, demand integration, and cost-curve minima. Include deterministic, zero-demand, and high-variability cases.

### 8.2 App behavior checks

Verify valid input handling, fleet comparisons on common draws, experiment cell counts, worker completion, animation playback, chart exports, sharing, and desktop/mobile layout. Keep the core tests in `packages/core/test/model.test.ts`.

### 8.3 Software report

`npm run validate` runs the app's software tests and writes their status to `VALIDATION.md`. `npm run compare-settings` generates examples of the app's calculation settings in `CALCULATION_SETTINGS.md`.

---

## 9. Repository layout

```
two-sided-uncertainty-app/
  PRD.md                      # this file
  VALIDATION.md               # generated by npm run validate
  README.md
  package.json
  vite.config.ts
  .github/workflows/deploy.yml
  packages/
    core/                     # framework-free simulation core (publishable)
      src/
        index.ts
        types.ts              # ScenarioParams, ScenarioResult, SweepSpec, ...
        rng.ts                # seeded PRNG + fork
        dist/                 # normal, beta, gamma samplers and CDFs
          normal.ts
          beta.ts
        model/
          expectedCosts.ts    # ā, b̄_i
          transform.ts        # cheap-tier transformation
          fractile.ts         # H(Q), RHS, binary search
          cost.ts             # G(Q, D, B) + component breakdown
          iterate.ts          # one iteration
          scenario.ts         # run N iterations, aggregate
          sweep.ts            # factor grid runner
          fleet.ts            # PD-only / CD-only / hybrid
          costCurve.ts
        presets.ts            # paper defaults, Table 4 factor levels
      test/
        *.test.ts             # Section 8 checks live here
      scripts/
        validate.ts           # writes VALIDATION.md
        precompute.ts         # writes app/public/precomputed/*.json
  app/
    src/
      main.tsx
      App.tsx
      state/                  # reducer, context, URL (de)serialization
      workers/sim.worker.ts   # thin wrapper: postMessage(params) → ScenarioResult / progress
      components/
        params/               # sliders, tier table, presets
        charts/               # CostCurve, SupplyLadder, CostBreakdown, QStarHistogram, SmallMultiples
        tabs/                 # Explorer, Figures, Propositions, Methodology, YourData
        ui/                   # buttons, cards, disclosure, theme toggle
      content/
        propositions.ts       # P1..P5 text + "show me" param sets
        methodology.md
    public/precomputed/       # sweep JSON at paper defaults
```

---

## 10. Work breakdown

### Phase 0: Alignment (Opus, half day)
- Read the paper Sections 3, Appendix S1 and S2, and the Java `procFleetSizeFixed`, `procCalcDelivCost`, `procFleetSizeCS`.
- Write `packages/core/src/types.ts` and `presets.ts`. Commit the interfaces before any UI work starts so Sonnet can build against them with a mocked worker.
- Document the app settings from Section 2.1 in `DECISIONS.md`.

### Phase 1: Core (Opus, 2 days)
- Numerics (`rng.ts`, `dist/`) with tests against known values.
- `model/*` in the order listed in Section 9. Unit test each.
- `scenario.ts`, `sweep.ts`, `fleet.ts`, `costCurve.ts`.
- `scripts/validate.ts`; run the software checks described in Section 8.
- `scripts/precompute.ts`.
- Deliver: core package with `VALIDATION.md`.

### Phase 1 (parallel): UI scaffold (Sonnet, 2 days)
- Vite + React + Tailwind + Vitest scaffold, theme, layout, tab routing, URL param sync.
- Parameter panel components bound to `ScenarioParams`, with validation messages.
- Chart components fed by fixture `ScenarioResult` JSON (Opus supplies a fixture on day 1).
- Worker wrapper with progress and cancellation.

### Phase 2: Integration (both, 1 day)
- Wire real core into worker. Explorer tab end to end.
- Figures tab reading precomputed JSON, with "Run with current parameters."
- Propositions tab.

### Phase 3: Polish (Sonnet, 1 day; Opus reviews)
- Methodology tab (KaTeX), CSV/PNG export, presets, shareable links, a11y pass, mobile pass.
- README with run, build, deploy, and "how to change paper defaults."
- Lighthouse performance and a11y ≥ 90.

### Phase 4: Handoff
- `VALIDATION.md`, `DECISIONS.md`, list of open questions answered or still open, demo GIF in README.

Ownership rule: Sonnet does not edit `packages/core/src/model/*`. Opus does not edit `app/src/components/*` except in review. Shared files (`types.ts`, `presets.ts`) change only by Opus with a changelog line.

---

## 11. Out of scope for v1 (candidates for v2)

- 3PL extension (Appendix S5).
- Service-level constraints, backlog dynamics.
- Income-targeting driver behavior (Section 4.3 of the paper).
- Heatmap or 3D surface of Q\* over (CV_D, CV_S).
- Multi-day or weekly planning horizon; time-window (morning/afternoon/night) split.
- Persisted user accounts, server-side compute.
- Portuguese localization (worth doing if AffordableMeals will see it).

---

## 12. Product settings and future choices

- **Authorship:** Castillo, Posner, Sodero, and Zinn.
- **Hosting:** GitHub Pages at https://professorcastillo.github.io/hybrid-fleets/.
- **Default scenarios:** Keep tier capacities, costs, demand settings, and the private-only buffer editable.
- **Audience:** Support classrooms, research readers, and delivery planners exploring scenarios.
- **Future data features:** Keep CSV exploration in the browser and provide synthetic examples.

---

## 13. Definition of done

- The software checks in Section 8 pass and are documented in `VALIDATION.md`.
- Explorer, Figures, Propositions, Methodology tabs functional on desktop and phone.
- The experiment tab displays all five experiment designs and supports precomputed and visitor-configured scenarios.
- `npm run build` produces a static bundle under 600 kB gzipped; deploy workflow green.
- README explains how to change the paper defaults in one file (`presets.ts`).
- Core package has no runtime dependencies and ≥ 90% test coverage.
