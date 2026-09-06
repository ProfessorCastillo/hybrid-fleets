# Verification record

## Automated

- 17 model tests pass. 100% statement/line/function coverage, 98.17% branch coverage across the executable core.
- Includes reference CDF/Beta values, sampler moment checks, extreme Beta shapes, 200 H-monotonicity cases, 1,000 cost/allocation identities, analytic-demand integration vs Monte Carlo, fixed-policy fairness, invalid inputs, deterministic forks, cost-curve optima across three seeds, and sweep design sizes.
- Production TypeScript check and Vite build pass; standalone ES module builds.
- All 565 experiment cells precomputed at 1,000 iterations.
- npm dependency audit: 0 vulnerabilities after updating Vitest and its coverage plugin.
- Implementation diagnostics: 5 checks pass, 13 benchmark/assumption checks remain OPEN. These are explicitly reported in `VALIDATION.md`; exact published replication is not claimed.

## Live browser checks

Preview: http://127.0.0.1:5186/. Port 5173 was released and is not used by Fleet Lab. Port 5186 is configured with `strictPort`.

- Desktop page loads, worker completes, and empirical defaults show fixed Q=580, daily mean cost approximately R$13,158, and 97.3% capacity coverage.
- Hybrid to crowd-only switching changes mean cost/coverage and map allocations on the same draw.
- Next day advances to another actual draw. Day 2 crowd-only replay showed 732 orders, 440 crowd assignments, and 292 without capacity.
- Custom private capacity of zero matched the crowd-only policy. Seeking to the end produced zero in-motion orders and complete allocation totals.
- Predictable-day preset returned Q=345 and 100% capacity coverage.
- Invalid private cost of 50 produced a readable a<u validation error and retained the last valid result; reset restored the default inputs.
- Base experiment completed a fresh 25-cell/300-iteration run. The failure-cost experiment loaded all 225 cells across nine panels.
- All five propositions rendered; methodology displayed the 13 OPEN implementation/reference checks.
- Mobile 390×844 layout visually inspected; document scroll width was exactly 390 (no horizontal overflow). Mobile map, playback controls, and stats were visually inspected.
- Light and dark themes visually inspected. Temporary viewport override reset after testing.
- Saved scenario appeared in the preset menu. PNG generation provides an inline image preview and Save PNG link; the embedded browser did not expose a download event, so saving to disk there is not certified.
- No browser console errors or warnings observed during these flows.

No automated Lighthouse score, real geography/routing benchmark, or remote deployment success is claimed.
