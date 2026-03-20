# CTO Candidate Spec

## Prompt

You are joining a retail intelligence platform as a CTO candidate.

The platform already scrapes Shopify product catalogs into its own database. Today, it captures the base storefront price and brand currency, then converts prices client-side when a customer wants a different display currency.

Customers want something stricter:

- if a brand sells to the US market in `USD`, show the actual USD listing price
- do not show a naive FX-converted approximation unless it is clearly marked as fallback data

Design a system that can access and persist the actual prices shown in the currencies and markets available on a Shopify storefront.

Use `https://www.cutlerandgross.com` as the concrete reference store.

## What you are given

1. A baseline scraper that mirrors the current ingestion method.
2. Storefront notes showing how `products.json`, `variants.json`, `meta.json`, and the product page behave.
3. A real example where the base storefront is `GBP` but the site advertises a `USD` market.

## Your assignment

Produce a design for a production-ready market-aware pricing subsystem.

Your design should cover:

- discovery
  - how the system discovers what markets and currencies a storefront supports
- extraction
  - how the system fetches actual product and variant prices for each supported market
- validation
  - how the system proves the captured value is the actual sell/listing price for that market
- storage
  - how the data model stores market-aware prices and price history
- serving
  - how the rest of the platform reads those prices
- operations
  - how the system is monitored, retried, and rolled out safely

## Required outputs

Submit the following:

1. A written architecture memo, about 3 to 6 pages.
2. A proposed data model.
3. A concrete extraction strategy for Cutler and Gross.
4. A rollout plan for the first 10 brands, then the first 1,000 brands.
5. A correctness plan that explains how you would distinguish:
   - real market price
   - derived FX price
   - stale or invalid price
6. A short list of unknowns, assumptions, and risks.

Optional:

- pseudocode or a prototype for one market-aware extractor path
- a validation script that confirms a market price against a cart or checkout-adjacent surface

## Constraints

- Assume you do not control the merchant's Shopify admin.
- Assume Storefront API tokens are usually not available.
- Assume public storefront behavior varies by theme and market setup.
- Assume the current catalog scraper based on `products.json` should remain in place for baseline ingestion.
- Assume legal and reputational risk matters; do not rely on reckless scraping behavior.

## What good answers should address

### 1. Separation of concerns

The strongest design will separate:

- baseline catalog ingestion
- market discovery
- market-aware price extraction
- market price validation
- serving and query behavior

### 2. Data model

At minimum, address tables or entities like:

- `brand_markets`
  - brand id
  - market key
  - country code
  - currency code
  - discovery source
  - enabled status
  - last verified at

- `variant_market_prices`
  - product id
  - variant id
  - brand id
  - market key
  - country code
  - currency code
  - listing price
  - compare-at price
  - availability
  - tax display mode if detectable
  - source type
  - source URL
  - captured at
  - verified at
  - confidence score
  - is fallback_fx

- `market_price_observations`
  - raw observation id
  - extraction job id
  - source type
  - raw payload hash
  - parsed result
  - status
  - captured at

### 3. Extraction strategy

The design should propose an ordered fallback strategy, for example:

1. Fetch a market-aware storefront representation directly, if the store exposes it.
2. Extract price from structured data or embedded product JSON on the localized product page.
3. Validate with a cart add or cart line-item surface in the same market context.
4. If no market-aware source is accessible, store FX-derived price only as a flagged fallback.

The design should explicitly discuss:

- localization cookies
- `/localization` flows
- market-specific path prefixes
- theme-specific embedded product JSON
- cart validation
- rate limiting and antibot behavior

### 4. Correctness rules

The platform needs a clear truth model.

For each market-specific price, define:

- what source is authoritative
- how staleness is measured
- when data should be hidden from the UI
- when fallback FX can be shown
- how mismatches are detected and alerted

### 5. Operational design

Address:

- job scheduling
- concurrency limits
- retries and backoff
- payload caching
- change detection
- observability and alerting
- support tooling for debugging one brand or one product

## Suggested target architecture

You do not need to use this exact design, but a strong answer will usually converge on something similar.

### Baseline layer

Keep the existing `products.json` ingestion for:

- product discovery
- handles and URLs
- core product metadata
- default price

### Market discovery layer

Per brand, discover supported markets from:

- localization form options in HTML
- market-specific links or prefixes
- embedded theme config
- merchant shipping countries as weak signal only

Output:

- a list of candidate markets per brand
- a market entry strategy per brand

### Market extraction layer

For each `(brand, market, product)` tuple:

- enter the market context
- fetch the product page or a more structured market-aware surface
- extract listing price, compare-at price, currency, and availability
- persist a raw observation
- normalize into `variant_market_prices`

### Validation layer

For sampled products or all products on smaller brands:

- add variant to cart in the same market context
- verify the line-item currency and amount
- mark the price observation as validated or suspect

### Serving layer

Product-serving rules should prefer:

1. fresh verified market price
2. fresh unverified market price
3. base storefront price
4. FX-converted price only if the UI flags it as derived

## Specific questions we will ask in the interview

Be ready to defend:

- how you would tell whether a store truly supports a market versus merely listing it in the UI
- how you would prevent the system from over-scraping or getting blocked
- how you would handle stores where the localized path 302s but the resulting page 404s
- how you would decide when to use a browser, plain HTTP, or both
- how you would avoid storing low-confidence prices as if they were authoritative
- how you would roll this out without degrading the existing catalog pipeline

