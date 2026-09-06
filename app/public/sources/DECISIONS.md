# Browser implementation assumptions

The published results are the reference for this work. This document records choices made in the browser reconstruction; it does not establish errors in the publication. The initial assessment overstated what could be concluded from mismatches. Numerical unit tests validated internal consistency, not faithful replication of the published model.

The manuscript, supplied Java export, and PRD informed the build. A controlled audit is recorded in `IMPLEMENTATION_AUDIT.md` and reproducible with `npm run reconcile`.

| Topic | Current implementation choice and validation task |
| --- | --- |
| Algorithm translation | The app constructed an appendix-based solver rather than directly porting procFleetSizeFixed. The supplied Java uses a zero initial cost baseline and all tiers. That convention gives results substantially closer to several published cases. The correct mapping remains to be established. |
| Private capacity headline | The app added a fixed advance-planning optimization that averages H over supply. Its default of 580 is an app extension, not the published empirical Q*=345. It is now labeled Fixed-planning estimate. |
| Conditional capacity | Experiments currently report the browser reconstruction’s mean conditional Q*. These outputs have not passed all published reference cases. |
| Threshold | The app substituted expected private cost abar for the printed raw a on the right-hand side. This was an interpretation, not a verified detail of the published calculation. The audit isolates its effect. |
| Demand transformation | The app uses a per-supply shift of the original demand CDF by cheap-tier capacity. That conditional treatment is a substantive choice that must be reconciled with the original implementation. |
| Demand distribution | The app conditions the normal distribution on nonnegative demand. The Java uses [0, mu+3 sigma]; the manuscript describes a normal distribution. Advanced options support these alternatives. |
| Five crowd tier costs | The app selects 8.8, 10.8, 17.3, 22.0, 28.7 from Tables 2 and 5. The supplied Java’s default constants differ. Mapping the publication’s calibration to that routine remains part of validation. |
| Fifth-tier capacity | The app provisionally uses 42.0 from S2.1 rather than the 4.2 displayed in Table 5. It is editable. Neither choice has been established as the precise input used in the published runs. |
| Private labor component | The app keeps the displayed a=20.3 and v=17.6 and derives l=2.7 for exact addition. Table 5 displays l=2.8. Printed rounded values do not reveal the full underlying precision; they are not evidence of a faulty model. |
| Expected unit-cost arithmetic | With the displayed parameters, expected private cost is 20.5072. The PRD prints 20.5052; both round to the paper’s R$20.5. This minor PRD arithmetic observation does not explain stochastic Q* discrepancies. |
| Common supply mean | The app uses the tabulated 322.1 explicitly. It has not established the weights underlying that value. Its optional capacity-weighted calculation gives 302.2438 from the selected tier means; those need not be the study’s weights. |
| Supply synchronization | The app applies Eq. (2) as a convex mixture with one shared draw per day, including when CV=0. Under this implementation the selected means change with the mixing weight. The audit must match the original sampling convention before interpreting reproduced experiment outputs. |
| Cheap tiers | The app selects raw b_i<v and allocates them before private capacity. This differs from the supplied Java routine. The audit keeps these alternatives explicit instead of assuming the Java can be dismissed as outdated. |
| Reliability accounting | Expected unit costs enter the reconstructed cost objective. The animation represents allocations, not a second set of sampled delivery failures. The Java diagnostic retains raw costs. |
| Cost curve | This is an app extension. Demand is integrated analytically for each supply draw; the curve describes the fixed planning objective. Passing this curve’s own consistency tests does not validate the published experiment. |
| Private-only comparison | The app uses Q=ceil(mu+2.33 sigma), a PRD-proposed assumption. The study’s precise private-only rule has not been established from the supplied materials. |
| Private-cost sensitivity | The app scales labor and operating costs proportionally. Holding v=17.6 at a=6.6 would be unbounded in this reconstructed objective, but that does not establish that the publication used that cost split. This is labeled as an app extension. |
| Integer search | The app uses the smallest integer crossing the threshold and expands the upper bound as needed. The Java has a post-search nudge; that has not been replayed exactly. |
| Java diagnostic | The flag changes the threshold baseline, raw costs, and cheap-tier handling. It retains selected scenario inputs and the app RNG. It is not a complete replay of the original AnyLogic execution environment. |
| Animation | Routes, clock, and destination locations are illustrative. Weighted batches display the selected policy’s allocations from a specific sampled day. No routing, ETA, or driver-count claims are made. |
| Attribution | The user confirms that the paper is published and peer reviewed. The supplied manuscript supports the title; final citation details can be added when available. |

Outstanding work is implementation validation: establish the original calculation conventions, reproduce published benchmarks without tuning outputs to targets, and distinguish all app extensions from publication results.
