# Problem Statement

## Business problem

The platform scrapes Shopify product catalogs into its own database. Today, the scraper captures the default storefront price and a brand-level currency. Clients often want to see products in a target currency such as `USD`.

The current product experience converts prices client-side with an FX converter. That is not good enough.

Why:

- Shopify Markets can define market-specific prices instead of straight FX conversion
- storefronts often round differently by market
- compare-at prices can differ by market
- availability can differ by market
- tax-inclusive and tax-exclusive presentation can differ by market

The result is that "converted GBP to USD" can differ from "the actual USD price a US shopper sees and buys".

## Goal

Design a system that lets the platform access actual product listing prices for each available Shopify market and currency, not just the base storefront price.

## Concrete case for the exercise

Use `https://www.cutlerandgross.com` as the seed storefront.

This store is useful because:

- `meta.json` reports the base shop currency as `GBP`
- the storefront exposes multiple market options including `United States (USD|$)`
- the public catalog endpoints still appear to return base storefront prices

This is exactly the mismatch the system needs to solve.

## Non-goals

- perfect support for every commerce platform
- full anti-bot architecture across all sites
- checkout automation for every brand

The focus is Shopify storefronts with multiple markets and currencies.

