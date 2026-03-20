# Cutler and Gross Recon

All findings below were observed on March 20, 2026.

## Seed URLs

- Storefront: `https://www.cutlerandgross.com`
- Catalog: `https://www.cutlerandgross.com/products.json?limit=2`
- Meta: `https://www.cutlerandgross.com/meta.json`
- Product page: `https://www.cutlerandgross.com/products/9782-aviator-polarised-sunglasses-black`
- Variant endpoint: `https://www.cutlerandgross.com/products/9782-aviator-polarised-sunglasses-black/variants.json`

## Public endpoint behavior

### `meta.json`

Observed signals:

- `currency: GBP`
- `country: GB`
- `published_products_count: 293`
- `ships_to_countries` includes `US`

Interpretation:

- the base storefront is GBP
- the brand ships to the US
- this alone does not prove what price a US shopper sees

### `products.json`

Observed signals:

- first product handle: `9782-aviator-polarised-sunglasses-black`
- first variant price: `440.00`
- catalog payload exposes price and compare-at price
- catalog payload does not clearly expose market-aware presentment prices

Interpretation:

- the endpoint is good for default catalog ingestion
- it does not solve multi-market pricing by itself

### Product page HTML

Observed signals:

- `Shopify.currency = {"active":"GBP","rate":"1.0"}`
- `Shopify.country = "GB"`
- `og:price:currency = GBP`
- rendered price snippets show `£440.00`
- structured data offer shows `priceCurrency = GBP`
- the storefront exposes a localization form at `POST /localization`
- the market selector includes `United States (USD|$)`, `Canada (CAD|$)`, `Australia (AUD|$)`, and many `EUR` countries

Interpretation:

- the default server-rendered product page is still GB/GBP
- the store clearly advertises multiple markets
- the market switch mechanism exists, but the public catalog page is not automatically market-aware

## Localization probe

Observed behavior from posting:

- request: `POST /localization`
- form fields:
  - `form_type=localization`
  - `_method=put`
  - `return_to=/products/9782-aviator-polarised-sunglasses-black`
  - `country_code=US`

Observed response:

- `302` redirect
- `Location: https://www.cutlerandgross.com/en-us/products/9782-aviator-polarised-sunglasses-black`
- `Set-Cookie: localization=US; path=/en-us`

Important nuance:

- following that exact redirect path with a simple command-line request produced a `404` during probing

Interpretation:

- the storefront exposes a real localization mechanism
- a naive HTTP-only replay is not enough to conclude success
- client context matters; geolocation, cookies, redirect handling, and localized path behavior can change what storefront state you observe
- the right production system likely needs a more robust market resolution strategy, such as:
  - cookie-aware session handling
  - theme-specific localized path resolution
  - market-aware page fetching via a browser or better storefront signal
  - cart or line-item validation to confirm the actual sell price

## Takeaway

This is a useful case because it is not trivial:

- the storefront clearly supports multiple markets
- the obvious public endpoints still reflect base-store pricing
- the localization path is suggestive but not turnkey

That forces the design to be resilient instead of relying on one lucky endpoint.
