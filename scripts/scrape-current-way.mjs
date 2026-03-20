import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_BASE_URL = "https://www.cutlerandgross.com";
const MAX_PRODUCTS = Number(process.env.MAX_PRODUCTS || 25);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 20000);

function normalizeBaseUrl(input) {
  return (input || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function execFileAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 25 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function parseHeaders(raw) {
  const blocks = String(raw)
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => block.startsWith("HTTP/"));

  const lastBlock = blocks.at(-1) || "";
  const lines = lastBlock.split(/\r?\n/);
  const statusLine = lines.shift() || "";
  const statusMatch = statusLine.match(/HTTP\/[0-9.]+\s+(\d+)/);
  const headers = {};

  for (const line of lines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  }

  return {
    status: statusMatch ? Number(statusMatch[1]) : null,
    headers,
  };
}

async function curlRequest(url, options = {}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cto-market-pricing-"));
  const headersPath = path.join(tempDir, "headers.txt");
  const bodyPath = path.join(tempDir, "body.txt");
  const args = [
    "-sS",
    "--max-time",
    String(Math.ceil(REQUEST_TIMEOUT_MS / 1000)),
    "-D",
    headersPath,
    "-o",
    bodyPath,
    "-w",
    "%{url_effective}",
  ];

  if (options.followRedirects !== false) {
    args.push("-L");
  }

  if (options.method) {
    args.push("-X", options.method);
  }

  for (const [key, value] of Object.entries(options.headers || {})) {
    args.push("-H", `${key}: ${value}`);
  }

  if (options.body) {
    args.push("--data", options.body);
  }

  args.push(url);

  try {
    const { stdout } = await execFileAsync("curl", args);
    const [rawHeaders, rawBody] = await Promise.all([
      readFile(headersPath, "utf8"),
      readFile(bodyPath, "utf8"),
    ]);
    const parsedHeaders = parseHeaders(rawHeaders);
    const finalUrl = String(stdout || "").trim();

    return {
      ok:
        parsedHeaders.status != null &&
        parsedHeaders.status >= 200 &&
        parsedHeaders.status < 300,
      status: parsedHeaders.status,
      url: finalUrl,
      text: rawBody,
      headers: parsedHeaders.headers,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function fetchJson(url) {
  const response = await curlRequest(url, {
    followRedirects: true,
    headers: {
      "user-agent": "Mozilla/5.0 (The Mall market pricing assignment)",
      accept: "application/json, text/plain, */*",
    },
  });

  let data = null;
  try {
    data = JSON.parse(response.text);
  } catch {
    data = response.text;
  }

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    data,
    headers: response.headers,
  };
}

function cleanDescription(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseShopifyProducts(shopifyProducts, baseUrl) {
  const seenHandles = new Set();
  const products = [];

  for (const product of shopifyProducts || []) {
    if (!product?.handle || seenHandles.has(product.handle)) {
      continue;
    }
    seenHandles.add(product.handle);

    const firstVariant = product.variants?.[0];
    if (!firstVariant) continue;

    const price = Number.parseFloat(firstVariant.price);
    const compareAtPrice = firstVariant.compare_at_price
      ? Number.parseFloat(firstVariant.compare_at_price)
      : null;
    const discountPercentage =
      compareAtPrice && compareAtPrice > price
        ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
        : null;

    const variants = (product.variants || [])
      .map((variant) => ({
        variant_id: variant.id?.toString() || null,
        title: variant.title || null,
        size: variant.option1 || null,
        color: variant.option2 || null,
        option3: variant.option3 || null,
        price: Number.parseFloat(variant.price) || 0,
        compare_at_price: variant.compare_at_price
          ? Number.parseFloat(variant.compare_at_price)
          : null,
        available: variant.available !== false,
        sku: variant.sku || null,
      }))
      .filter((variant) => variant.variant_id);

    products.push({
      name: product.title || null,
      vendor: product.vendor || null,
      shopify_product_gid:
        product.id != null ? `gid://shopify/Product/${product.id}` : null,
      price,
      original_price: compareAtPrice,
      discount_percentage: discountPercentage,
      product_url: `${baseUrl}/products/${product.handle}`,
      category: product.product_type || "Uncategorized",
      in_stock: variants.some((variant) => variant.available),
      description: cleanDescription(product.body_html),
      created_at: product.published_at || null,
      variants,
    });
  }

  return products;
}

async function scrapeProducts(baseUrl, maxProducts) {
  const collected = [];
  let page = 1;

  while (collected.length < maxProducts) {
    const url = `${baseUrl}/products.json?limit=250&page=${page}`;
    const response = await fetchJson(url);
    if (!response.ok) {
      break;
    }

    const products = response.data?.products;
    if (!Array.isArray(products) || products.length === 0) {
      break;
    }

    collected.push(...products);
    page += 1;
  }

  return parseShopifyProducts(collected.slice(0, maxProducts), baseUrl);
}

async function fetchMeta(baseUrl) {
  const response = await fetchJson(`${baseUrl}/meta.json`);
  if (!response.ok || typeof response.data !== "object") {
    return null;
  }
  return response.data;
}

function extractCurrencyFromVariants(payload) {
  const productPayload = payload?.product || payload;
  const candidates = [
    productPayload?.currency,
    productPayload?.variants?.[0]?.price_currency,
    productPayload?.variants?.[0]?.compare_at_price_currency,
    productPayload?.variants?.[0]?.presentment_prices?.[0]?.price?.currency_code,
    productPayload?.variants?.[0]?.currency,
  ];

  const found = candidates.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  return found ? found.trim().toUpperCase() : null;
}

async function fetchCurrencyFromVariants(baseUrl) {
  const productsResponse = await fetchJson(`${baseUrl}/products.json?limit=1`);
  const firstProduct = productsResponse.data?.products?.[0];
  const handle = firstProduct?.handle || firstProduct?.url_handle;
  if (!handle) {
    return { currency: null, handle: null, variantsUrl: null };
  }

  const variantsUrl = `${baseUrl}/products/${handle}/variants.json`;
  const variantsResponse = await fetchJson(variantsUrl);
  return {
    currency: extractCurrencyFromVariants(variantsResponse.data),
    handle,
    variantsUrl,
  };
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.argv[2]);
  const meta = await fetchMeta(baseUrl);
  const variantCurrency = await fetchCurrencyFromVariants(baseUrl);
  const products = await scrapeProducts(baseUrl, MAX_PRODUCTS);

  const summary = {
    base_url: baseUrl,
    scraped_at: new Date().toISOString(),
    current_method: {
      catalog_endpoint: `${baseUrl}/products.json`,
      meta_endpoint: `${baseUrl}/meta.json`,
      first_variants_endpoint: variantCurrency.variantsUrl,
      price_source: "first variant in products.json",
      brand_currency_source:
        "variants.json currency candidates, then meta.json currency",
    },
    brand_meta: meta
      ? {
          name: meta.name || null,
          country: meta.country || null,
          currency: meta.currency || null,
          ships_to_countries_count: Array.isArray(meta.ships_to_countries)
            ? meta.ships_to_countries.length
            : 0,
          published_products_count: meta.published_products_count || null,
        }
      : null,
    variants_currency_probe: variantCurrency,
    sample_product: products[0] || null,
    sample_product_count: products.length,
    note:
      "This baseline mirrors the current scraper: it returns the default storefront price and does not prove market-specific USD pricing.",
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
