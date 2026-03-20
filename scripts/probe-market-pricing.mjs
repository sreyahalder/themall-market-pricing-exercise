import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PRODUCT_PATH = "/products/9782-aviator-polarised-sunglasses-black";
const BASE_URL = "https://www.cutlerandgross.com";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 20000);

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
      status: parsedHeaders.status,
      url: finalUrl,
      text: rawBody,
      headers: parsedHeaders.headers,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function fetchText(url, options = {}) {
  return curlRequest(url, {
    ...options,
    headers: {
      "user-agent": "Mozilla/5.0 (The Mall market pricing project)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(options.headers || {}),
    },
  });
}

function matchValue(pattern, text) {
  const match = text.match(pattern);
  return match ? match[1] : null;
}

async function main() {
  const productUrl = `${BASE_URL}${PRODUCT_PATH}`;
  const page = await fetchText(productUrl);

  const summary = {
    product_url: productUrl,
    scraped_at: new Date().toISOString(),
    default_page: {
      final_url: page.url,
      og_price_amount: matchValue(/og:price:amount\" content=\"([^\"]+)\"/, page.text),
      og_price_currency: matchValue(
        /og:price:currency\" content=\"([^\"]+)\"/,
        page.text,
      ),
      shopify_currency_active: matchValue(
        /Shopify\.currency = \{\"active\":\"([^\"]+)\"/,
        page.text,
      ),
      shopify_country: matchValue(/Shopify\.country = \"([^\"]+)\"/, page.text),
      has_us_market_option: page.text.includes("United States (USD|$)"),
      has_ca_market_option: page.text.includes("Canada (CAD|$)"),
      has_au_market_option: page.text.includes("Australia (AUD|$)"),
      has_eur_market_option: page.text.includes("(EUR|"),
    },
  };

  const body = new URLSearchParams({
    form_type: "localization",
    utf8: "✓",
    _method: "put",
    return_to: PRODUCT_PATH,
    country_code: "US",
  });

  const localizationResponse = await fetchText(`${BASE_URL}/localization`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    followRedirects: false,
  });

  summary.localization_probe = {
    request_country_code: "US",
    status: localizationResponse.status,
    redirect_location: localizationResponse.headers.location || null,
    set_cookie: localizationResponse.headers["set-cookie"] || null,
    note:
      "A 302 plus a market-specific path or cookie is a strong signal, but not proof that the product page can be fetched market-aware without a browser session.",
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
