# Current State

## Existing ingestion model

The current Shopify pipeline is `products.json` first.

Current backend behavior, simplified:

1. paginate `products.json?limit=250&page=N`
2. parse product-level fields from the catalog payload
3. use the first variant for price and compare-at price
4. build the platform product payload from that result
5. fetch `meta.json` for brand metadata
6. fetch `products/{handle}/variants.json` to guess the brand currency

## Relevant implementation details

The current backend code does the following:

- `shopifyScaper.js`
  - resolves redirects to a final base URL
  - paginates `products.json`
  - parses the first variant as the product price
  - derives `discount_percentage` from `compare_at_price`
  - writes the product URL as `/products/{handle}`

- `brandMetadataService.js`
  - fetches `meta.json`
  - tries to determine currency from `products/{handle}/variants.json`
  - falls back to `meta.json.currency`

## What this means in practice

This flow is good for:

- full-catalog discovery
- normalized product and variant ingestion
- detecting default storefront pricing and stock state

This flow is not enough for:

- actual per-market presentment price
- actual per-market compare-at price
- validating the price a US shopper sees on the storefront

## Current baseline assumptions

The current system effectively assumes:

- `products.json` is the source of truth for price
- `meta.json.currency` or `variants.json` tells us what currency the brand sells in

Those assumptions break when a Shopify store supports multiple markets and local pricing.

## Why client-side conversion is insufficient

If a storefront base price is `GBP 440.00`, the client can convert that to `USD`. But that does not prove the store actually sells the item in the US market at that converted value.

Possible deltas:

- explicit Shopify market prices
- fixed rounded numbers per market
- sale prices set per market
- market-specific product suppression
- country-specific duties or tax display

## Target state

The platform should store both:

- base catalog data
- market-aware price observations by product or variant and market

The market-aware layer should be first-class data, not a display-only conversion.

