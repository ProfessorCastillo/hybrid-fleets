# Implementation audit

## Correction to the initial assessment

The published results are the reference to reproduce. The initial build did not establish an error in the paper. Its mismatch establishes that this reimplementation is not yet validated against the published model. Unit tests checked numerical behavior and internal consistency; they did not validate the interpretation of the research.

The initial build made several substantive choices: it replaced the printed raw-a threshold with expected-cost abar, implemented a particular conditioning of transformed demand, selected demand truncation and table values, and added an advance fixed-fleet optimization as the main recommendation. That extension is not the paper's reported mean conditional Q*. Calling the app a direct implementation of the published equations was too strong.

## Controlled convention comparison

Every column in a row uses the same 1,000 sampled supply vectors. No costs, capacities, or CVs are fitted to reported outcomes. The seed controls both demand sampling and the supply stream.

| Demand CV | Supply CV | Seed | Published Q* | Initial reconstruction | Printed raw-a RHS only | Untruncated CDF only | Java fractile convention |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0.2 | 0.2 | 42 | 345 | 438.76 | 446.47 | 438.76 | 347.71 |
| 0.2 | 0.8 | 42 | 371.7 | 443.41 | 450.25 | 443.41 | 353.27 |
| 0.8 | 0.2 | 42 | 416.9 | 921.40 | 949.95 | 876.89 | 412.25 |
| 0.8 | 0.8 | 42 | 406.4 | 914.09 | 942.69 | 869.56 | 403.12 |
| 0.34 | 0.36 | 42 | 345 | 545.15 | 557.89 | 544.84 | 359.32 |
| 0.2 | 0.2 | 123 | 345 | 430.80 | 438.52 | 430.80 | 339.92 |
| 0.2 | 0.8 | 123 | 371.7 | 433.92 | 440.59 | 433.92 | 344.22 |
| 0.8 | 0.2 | 123 | 416.9 | 913.39 | 941.97 | 868.93 | 406.54 |
| 0.8 | 0.8 | 123 | 406.4 | 900.46 | 929.02 | 855.93 | 392.96 |
| 0.34 | 0.36 | 123 | 345 | 532.24 | 545.03 | 531.98 | 348.00 |
| 0.2 | 0.2 | 2026 | 345 | 431.76 | 439.48 | 431.76 | 340.80 |
| 0.2 | 0.8 | 2026 | 371.7 | 453.94 | 460.83 | 453.94 | 361.39 |
| 0.8 | 0.2 | 2026 | 416.9 | 915.86 | 944.41 | 871.38 | 408.20 |
| 0.8 | 0.8 | 2026 | 406.4 | 928.57 | 957.18 | 884.06 | 413.34 |
| 0.34 | 0.36 | 2026 | 345 | 532.64 | 545.38 | 532.35 | 348.28 |

The Java-fractile column uses the supplied procFleetSizeFixed structure: raw unit costs, the initial b1-minus-zero term, all CD tiers in the capacity ladder, and F_of_x truncated to [0, mu+3 sigma]. It retains the paper's five-tier calibration and the same Beta samples as the other columns. It uses a mathematically defined integer threshold search, not Java's post-search nudge. It is not a full AnyLogic replay and does not demonstrate which version generated the publication.

The Java-based results are substantially closer to several reported values than the initial reconstruction. This points to translating and reconciling implementation conventions as the next task. The remaining differences are not explained by this audit.

## What is established

- The initial app included an additional fixed planning objective; its 580 default is not the paper's 345 recommendation.
- Selecting conventions materially changes the stochastic results, even with identical sampled supply.
- Rounding and table-selection observations alone do not establish a faulty model or invalid published results.
- The app must earn a claim of faithful replication by reproducing the published benchmarks and explaining the convention mapping.

The production calculations have not been switched to whichever column looks closest. The app and documentation now identify the outstanding work as implementation validation.
