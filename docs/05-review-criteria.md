# Review Criteria

## What this reviews

This is not a trick question about one Shopify endpoint. It is a systems and product-quality question.

The goal is to evaluate whether the work proposes a robust subsystem under messy real-world constraints.

## Criteria

### 1. Product judgment

Strong:

- understands why client-side FX is not the same as actual market price
- separates user trust requirements from implementation convenience
- defines a clear fallback policy

Weak:

- proposes "just convert everything to USD"
- treats all currency conversions as equivalent to real market pricing

### 2. Technical depth

Strong:

- reasons through multiple extraction paths
- understands Shopify Markets, localization, structured data, carts, and embedded product payloads
- proposes a fallback stack instead of a single fragile trick

Weak:

- relies on `products.json` alone
- assumes one endpoint will expose every market price

### 3. Data model quality

Strong:

- models market-aware price as first-class data
- tracks confidence, freshness, source, and verification state
- separates raw observations from normalized serving data

Weak:

- overwrites the base product price with market-specific price
- has no place to store provenance or uncertainty

### 4. Operational maturity

Strong:

- defines retries, backoff, monitoring, and debugging flows
- discusses cost and scale tradeoffs between browser-based and HTTP-based extraction
- proposes staged rollout and quality gates

Weak:

- only discusses happy-path extraction
- ignores rate limits, bans, or monitoring

### 5. Execution realism

Strong:

- gives a concrete plan for Cutler and Gross
- identifies where more investigation is needed
- proposes measurable milestones

Weak:

- stays at generic architecture language only
- avoids the ugly edge cases in the provided storefront

## A strong answer will usually include

- a clear baseline-vs-market-aware separation
- per-market entities in the data model
- an extraction hierarchy
- a validation plan
- a UI-serving policy for verified versus fallback prices
- a rollout and monitoring plan

## Red flags

- scraping checkout in ways that are unnecessarily risky or brittle
- no distinction between authoritative and inferred prices
- no explanation of how stale data is handled
- no support for partial market coverage
- no concern for operational cost
