# Model settings

Fleet Lab is an interactive companion to the research by Castillo, Posner, Sodero, and Zinn. This document describes the browser app's settings and design choices.

| Setting | App behavior |
| --- | --- |
| Conditional capacity | Solve for private capacity separately for each sampled supply vector; report its distribution and mean. |
| Fixed fleet planning | Choose one private-capacity commitment using the supply-averaged critical fractile, then compare it across simulated days. |
| Capacity search | Return the smallest integer crossing the selected threshold, expanding the search interval as needed. |
| Demand distribution | Default to a normal distribution truncated at zero. Advanced settings also offer an untruncated normal and truncation at zero and μ + 3σ. |
| Crowd tier costs | Default to R$8.8, 10.8, 17.3, 22.0, and 28.7 per delivery. All tiers are editable. |
| Fifth-tier mean capacity | Default to 42 deliveries; configurable in the tier editor. |
| Private cost | Default total private cost is R$20.3 and its operating component is R$17.6. |
| Reliability | Incorporate private and crowd reliability into expected unit costs. |
| Shared supply | Use a common mean capacity of 322.1 by default. Mix tier-specific and shared supply draws using ρ. |
| Allocation order | Assign lower-cost crowd tiers first, then private capacity, then remaining crowd tiers in ascending cost order. |
| Cost curve | Integrate demand analytically for each sampled supply vector to illustrate the fixed fleet planning extension. |
| Private-only buffer | Use ceil(μ + 2.33σ) by default, with a configurable buffer. |
| Private-cost sensitivity | Scale labor and operating components proportionally as total private cost changes. |
| Java cost setting | Offer raw costs and a zero threshold baseline as an alternative calculation setting. The scenario inputs and seeded draws remain configurable. |
| Comparison scenarios | Evaluate hybrid, private-only, crowd-only, and custom policies using the same demand and supply draws. |
| Animation | Show weighted delivery batches for the selected day's allocations on an illustrative district map. |
| Storage and sharing | Save scenarios in browser storage and encode shared scenario parameters in the URL. |

The production simulation is implemented in `packages/core/src/`. The `npm run compare-settings` command illustrates how the app's calculation settings affect its outputs using identical supply draws.
