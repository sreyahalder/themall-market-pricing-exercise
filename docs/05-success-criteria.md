# Success Criteria

## What good project work should include

- a clear separation between base catalog ingestion and market-aware pricing
- a data model that treats market prices as first-class data
- a fallback strategy instead of a single endpoint dependency
- a validation path for confirming real storefront pricing
- a rollout plan that can start small and scale
- an operational plan for retries, debugging, and monitoring

## Good signs

- the writeup explains why FX conversion is not the same as actual market pricing
- the proposed model stores freshness, provenance, and confidence
- the extraction strategy covers localization, structured data, embedded product payloads, and cart validation
- the rollout plan acknowledges cost and reliability tradeoffs between HTTP-first and browser-based collection
- the solution is specific about how to handle incomplete or low-confidence data

## Things to avoid

- treating converted prices as equivalent to real market prices
- overwriting the base storefront price with market-specific data
- relying on `products.json` alone
- assuming one endpoint will expose all market prices
- ignoring staleness, provenance, or confidence
- designing a solution that only works on the happy path
