# Fleet Lab implementation plan

## Purpose
Let a reader understand and interact with the adapted two-stage newsvendor model, configure a real scenario, and replay the resulting capacity allocations in an animated district. The original manuscript and Java export remain untouched.

1. **Reconcile sources.** Read the manuscript (including S1–S5), Java calculation routines, and PRD. Record implementation assumptions and the difference between a conditional optimum and an advance fleet commitment in DECISIONS.md.
2. **Build and verify the model.** Implement a dependency-free, seeded TypeScript core: normal and Beta sampling, reliability-adjusted costs, cheap-tier transformation, critical fractile, cost accounting, and aggregate statistics. Compute both the paper's per-supply conditional optimum and one fixed capacity from the supply-averaged fractile.
3. **Create a useful sandbox.** Offer uncertainty sliders, demand and cost inputs, editable supply tiers, presets, fixed/private/crowdsourced/custom fleet comparison, a cost curve, capacity ladder, distribution, and CSV/share/save controls. Run expensive calculations in cancellable workers.
4. **Animate an actual draw.** Replay sampled demand and tier allocations on a procedural city map. Support pause, reset, speed, seeking, and selection of a new day. Scale the animated packets to exact model allocation totals. Explain that geography and animation timing are illustrative and reliability enters expected costs.
5. **Connect back to the research.** Include factor sweeps, all five propositions, equations, source links, assumptions, and transparent reproduction diagnostics. Precompute paper-convention experiments and never substitute published values for calculated results.
6. **Verify and deliver.** Test mathematical identities, samplers, optimizer bounds, fixed-policy fairness, conservation, reproducibility, invalid inputs, browser flows, mobile layout, and production output. Save the results, model decisions, and run/deployment instructions.

## Scope decisions
React + TypeScript + Vite, Recharts, custom CSS, Canvas for the animated district, one worker per active calculation. No account, backend, paid map API, external assets, or real shipment data needed. The requested animation is a new educational layer. Live routing, ETAs, congestion, service promises, and actual success/failure simulation are outside the paper's model.

The draft PRD is guidance, not a claim of completed acceptance. Published results are the validation targets; remaining mismatches are implementation work. Deployment setup is provided; publishing is separate from the local build.
