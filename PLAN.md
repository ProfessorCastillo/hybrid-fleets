# Fleet Lab application plan

## Purpose

Help readers explore delivery capacity planning, configure scenarios, and watch resulting allocations in an animated district. The companion draws on *Last Mile Delivery Capacity Planning with Two-Sided Uncertainty* by Castillo, Posner, Sodero, and Zinn.

1. **Organize the model inputs.** Use the manuscript, Java export, and product requirements to define controls, default scenarios, and calculations. Document app settings in `DECISIONS.md`.
2. **Build the simulation.** Implement seeded demand and supply sampling, reliability-adjusted costs, conditional capacity selection, fixed fleet planning, allocation, and summary statistics.
3. **Create the sandbox.** Provide sliders, editable supply tiers, presets, fleet comparisons, charts, and save/share/export controls. Run calculations in browser workers.
4. **Animate a day.** Display weighted delivery batches on a procedural district map with playback controls and day selection.
5. **Connect the research.** Include the five propositions, experiment controls, equations, manuscript, and authorship. Precompute experiment datasets for fast loading.
6. **Verify and publish.** Check numerical routines, accounting identities, seeded behavior, inputs, browser interactions, responsive layout, and the production build. Deploy through GitHub Pages.

## Technology and scope

React, TypeScript, Vite, Recharts, CSS, and Canvas. The app runs without user accounts, a backend, paid map services, or real shipment data. Roads, destinations, and playback timing are part of the app's educational animation.

Future app features include historical CSV calibration, 3PL scenarios, route planning, and localization.
