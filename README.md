# The Mall Market Pricing Project

This repository is a self-contained project brief covering scraping and data design techniques for The Mall.

It covers a real platform problem:

- the current scraper captures the base Shopify storefront price
- clients want the actual price shown and sold in a target market/currency such as `USD`
- client-side FX conversion is not enough because Shopify Markets can use market-specific pricing, rounding, compare-at prices, taxes, and availability

The package includes:

- a baseline scraper that mirrors the current `products.json`-first approach
- a storefront probe for Cutler and Gross
- sample output from both scripts
- current-state notes
- a project brief
- success criteria

## Folder layout

- `.nvmrc`
- `.gitignore`
- `package.json`
- `scripts/scrape-current-way.mjs`
- `scripts/probe-market-pricing.mjs`
- `examples/current-scrape-output.json`
- `examples/market-probe-output.json`
- `docs/01-problem-statement.md`
- `docs/02-current-state.md`
- `docs/03-cutler-and-gross-recon.md`
- `docs/04-project-brief.md`
- `docs/05-success-criteria.md`

## Requirements

- Node.js `22`
- `curl`

There are no npm dependencies.

## Clone and run

```bash
git clone <repo-url>
cd themall-market-pricing-project
npm run scrape:current
npm run probe:markets
```

## Quick start from a local copy

```bash
cd themall-market-pricing-project
npm run scrape:current
npm run probe:markets
```

## What to read first

1. [docs/01-problem-statement.md](docs/01-problem-statement.md)
2. [docs/03-cutler-and-gross-recon.md](docs/03-cutler-and-gross-recon.md)
3. [docs/04-project-brief.md](docs/04-project-brief.md)
4. [docs/05-success-criteria.md](docs/05-success-criteria.md)

## What this covers

The work here is meant to show:

- reason from a real Shopify storefront, not an abstract whiteboard prompt
- separate base catalog scraping from market-aware pricing extraction
- design a data model for per-market product and variant prices
- propose a reliable extraction and validation strategy
- think about rollout, monitoring, cost, correctness, and failure modes

## Notes

- The scripts use `curl` under the hood because it behaved more consistently than Node's built-in HTTP stack against this storefront during probing.
- The sample outputs in `examples/` are grounded in live requests to `cutlerandgross.com` on March 20, 2026.
