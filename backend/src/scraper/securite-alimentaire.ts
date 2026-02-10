import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { ScrapedRecall } from '../types';

const BASE_URL = 'https://securite-alimentaire.public.lu';
const API_BASE = `${BASE_URL}/api/content`;
const ALERTS_URL = `${BASE_URL}/fr/actualites/alertes.html`;

// Realistic browser headers to avoid WAF blocks
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-LU,fr;q=0.9,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

const JSON_HEADERS = {
  ...BROWSER_HEADERS,
  'Accept': 'application/json',
};

const INFANT_KEYWORDS = [
  'lait infantile', 'laits infantiles', 'lait bébé', 'lait pour nourrisson',
  'préparation pour nourrisson', 'lait de suite', 'formule infantile',
  'baby milk', 'infant formula', 'infant milk', 'baby formula',
  'säuglingsmilch', 'babymilch', 'anfangsmilch', 'folgemilch',
  'guigoz', 'gallia', 'blédina', 'nidal', 'nan expert',
];

function isInfantFormula(text: string): boolean {
  const lower = text.toLowerCase();
  return INFANT_KEYWORDS.some(keyword => lower.includes(keyword));
}

function extractBrand(title: string, description: string): string | null {
  const brandPatterns = [
    /marque\s*[:\s]+([^,\.\-\n]+)/i,
    /de la marque\s+([^,\.\-\n]+)/i,
    /marques?\s+([^,\.\-\n]+)/i,
    /Rappel.*?:\s*(.+?)\s*[-–]/,
  ];

  const combined = `${title} ${description}`;
  for (const pattern of brandPatterns) {
    const match = combined.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

function extractLotNumbers(text: string): string | null {
  const patterns = [
    /(?:lot|numéro de lot|n°\s*de lot|batch)[s]?\s*[:\s]+([^\n.]+)/gi,
    /(?:lot(?:s)?)\s*[:\s]+\s*([A-Z0-9][A-Z0-9\s,\/\-]+)/gi,
  ];

  const lots: string[] = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      lots.push(match[1].trim());
    }
  }
  return lots.length > 0 ? lots.join('; ') : null;
}

function extractExpiryDates(text: string): string | null {
  const patterns = [
    /(?:date.*?(?:expiration|péremption|durabilité|DLC|DDM|DLUO))\s*[:\s]+([^\n.]+)/gi,
    /(?:à consommer.*?(?:avant|jusqu))\s*[:\s]+([^\n.]+)/gi,
    /(?:best before|use by|exp(?:iry)?)\s*[:\s]+([^\n.]+)/gi,
  ];

  const dates: string[] = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      dates.push(match[1].trim());
    }
  }
  return dates.length > 0 ? dates.join('; ') : null;
}

function extractProductName(title: string): string {
  return title
    .replace(/^(?:mise à jour\s*[-–:]\s*)?(?:rappel\s+de\s+produit|avis\s+de\s+rappel|rappel)\s*[:\-–]\s*/i, '')
    .trim();
}

function extractReason(text: string): string {
  const reasonPatterns = [
    /(?:motif|raison|danger|risque|problème|contamination|présence)\s*[:\s]+([^\n.]+)/i,
    /(?:salmonell|listeria|e\.\s*coli|cronobacter|allergène|allergen|céréulide|bacillus)/i,
  ];

  for (const pattern of reasonPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1]?.trim() || match[0].trim();
    }
  }
  return '';
}

// ─── Strategy 1: AEM Content Services API ────────────────────────────

interface SirenEntity {
  class?: string[];
  properties?: Record<string, any>;
  links?: Array<{ rel: string[]; href: string }>;
  entities?: SirenEntity[];
}

/**
 * Try to discover alert URLs via the AEM Content Services API.
 * AEM exposes JSON at /api/content/<path>.model.json or .caas.json
 */
async function fetchAlertUrlsViaAPI(): Promise<string[]> {
  const urls: string[] = [];

  // Try several AEM Content Services endpoint patterns
  const apiPaths = [
    `${API_BASE}/fr/actualites/alertes.model.json`,
    `${API_BASE}/fr/actualites/alertes.caas.json`,
    `${BASE_URL}/fr/actualites/alertes.model.json`,
    `${BASE_URL}/fr/actualites/alertes.infinity.json`,
    `${BASE_URL}/fr/actualites/alertes.1.json`,
  ];

  for (const apiUrl of apiPaths) {
    try {
      console.log(`  Trying API: ${apiUrl}`);
      const response = await fetch(apiUrl, { headers: JSON_HEADERS });

      if (!response.ok) {
        console.log(`  → ${response.status} ${response.statusText}`);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        console.log(`  → Not JSON (${contentType})`);
        continue;
      }

      const data = await response.json() as any;
      console.log(`  → Got JSON response`);

      // Extract URLs from Siren-style entities
      extractUrlsFromSiren(data, urls);

      // Also look for direct path references in the JSON
      extractUrlsFromJSON(data, urls);

      if (urls.length > 0) {
        console.log(`  → Found ${urls.length} URLs via API`);
        return urls;
      }
    } catch (err) {
      console.log(`  → Error: ${(err as Error).message}`);
    }
  }

  return urls;
}

function extractUrlsFromSiren(data: SirenEntity, urls: string[]): void {
  if (data.links) {
    for (const link of data.links) {
      const href = link.href;
      if (href && href.includes('/alertes/') && href.endsWith('.html')) {
        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        if (!urls.includes(fullUrl)) {
          urls.push(fullUrl);
        }
      }
    }
  }

  if (data.entities) {
    for (const entity of data.entities) {
      extractUrlsFromSiren(entity, urls);

      // Check entity properties for URLs
      if (entity.properties) {
        const props = entity.properties;
        for (const key of Object.keys(props)) {
          const val = props[key];
          if (typeof val === 'string' && val.includes('/alertes/') && val.includes('.html')) {
            const fullUrl = val.startsWith('http') ? val : `${BASE_URL}${val}`;
            if (!urls.includes(fullUrl)) {
              urls.push(fullUrl);
            }
          }
        }
      }
    }
  }
}

function extractUrlsFromJSON(data: any, urls: string[], depth = 0): void {
  if (depth > 10) return;

  if (typeof data === 'string') {
    if (data.includes('/actualites/alertes/') && data.endsWith('.html')) {
      const fullUrl = data.startsWith('http') ? data : `${BASE_URL}${data}`;
      if (!urls.includes(fullUrl)) {
        urls.push(fullUrl);
      }
    }
    return;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      extractUrlsFromJSON(item, urls, depth + 1);
    }
    return;
  }

  if (data && typeof data === 'object') {
    for (const key of Object.keys(data)) {
      extractUrlsFromJSON(data[key], urls, depth + 1);
    }
  }
}

// ─── Strategy 2: HTML scraping with browser-like headers ────────────

async function fetchAlertUrlsViaHTML(): Promise<string[]> {
  console.log(`  Fetching HTML: ${ALERTS_URL}`);
  const response = await fetch(ALERTS_URL, { headers: BROWSER_HEADERS, redirect: 'follow' });

  if (!response.ok) {
    console.log(`  → HTTP ${response.status} ${response.statusText}`);
    return [];
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Debug: show what we actually got
  const pageTitle = $('title').text().trim();
  const linkCount = $('a').length;
  console.log(`  → Page title: "${pageTitle}", links on page: ${linkCount}`);

  if (linkCount < 5) {
    console.log(`  → Likely a WAF/challenge page. First 500 chars of body:`);
    console.log(`  → ${html.substring(0, 500).replace(/\n/g, ' ')}`);
    return [];
  }

  const urls: string[] = [];

  // Look for alert links with various selector strategies
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('/alertes/') && href.endsWith('.html') && !href.endsWith('alertes.html')) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!urls.includes(fullUrl)) {
        urls.push(fullUrl);
      }
    }
  });

  console.log(`  → Found ${urls.length} alert URLs from HTML`);
  return urls;
}

// ─── Strategy 3: Probe known URL patterns ───────────────────────────

async function fetchAlertUrlsViaProbing(): Promise<string[]> {
  const urls: string[] = [];
  const now = new Date();

  // Generate year/month combinations to probe (last 12 months)
  const yearMonths: Array<{ year: number; month: string }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    yearMonths.push({
      year: d.getFullYear(),
      month: String(d.getMonth() + 1).padStart(2, '0'),
    });
  }

  // Try to fetch year/month index pages which might list alerts
  for (const { year, month } of yearMonths) {
    const indexUrl = `${BASE_URL}/fr/actualites/alertes/${year}/${month}.html`;

    try {
      console.log(`  Probing: ${indexUrl}`);
      const response = await fetch(indexUrl, { headers: BROWSER_HEADERS, redirect: 'follow' });

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.includes(`/alertes/${year}/`) && href.endsWith('.html')) {
          const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
          // Filter out index pages themselves
          if (!fullUrl.endsWith(`/${month}.html`) && !urls.includes(fullUrl)) {
            urls.push(fullUrl);
          }
        }
      });

      // Be polite
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch {
      // Skip this month
    }
  }

  console.log(`  → Found ${urls.length} alert URLs via probing`);
  return urls;
}

// ─── Combined URL discovery ─────────────────────────────────────────

export async function fetchAlertListUrls(): Promise<string[]> {
  console.log('Discovering alert URLs...');

  // Strategy 1: Try AEM Content Services API
  console.log('Strategy 1: AEM Content Services API');
  let urls = await fetchAlertUrlsViaAPI();
  if (urls.length > 0) return urls;

  // Strategy 2: HTML scraping with browser headers
  console.log('Strategy 2: HTML scraping');
  urls = await fetchAlertUrlsViaHTML();
  if (urls.length > 0) return urls;

  // Strategy 3: Probe known URL patterns
  console.log('Strategy 3: Probing year/month indexes');
  urls = await fetchAlertUrlsViaProbing();
  if (urls.length > 0) return urls;

  console.log('All strategies exhausted. Found 0 alert URLs.');
  return [];
}

// ─── Alert page scraping ────────────────────────────────────────────

async function scrapeAlertViaAPI(url: string): Promise<ScrapedRecall | null> {
  // Convert HTML URL to AEM JSON endpoint
  // e.g. /fr/actualites/alertes/2026/01/foo.html → /api/content/fr/actualites/alertes/2026/01/foo.model.json
  const path = url.replace(BASE_URL, '').replace('.html', '');
  const jsonUrl = `${BASE_URL}${path}.model.json`;

  try {
    const response = await fetch(jsonUrl, { headers: JSON_HEADERS });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) return null;

    const data = await response.json() as any;

    // AEM model JSON typically has title, text/body, date fields
    const title = data.title || data[':title'] || data.properties?.title || '';
    const description = data.text || data.body || data[':text'] || data.properties?.text || '';
    const publishedDate = data.date || data.publishedDate || data[':publishedDate'] || '';
    const imageUrl = data.image?.src || data.imageUrl || null;

    if (!title) return null;

    const fullText = `${title} ${description}`;

    return {
      source_url: url,
      title,
      description: description.substring(0, 5000),
      reason: extractReason(fullText),
      published_date: publishedDate || extractDateFromUrl(url),
      brand: extractBrand(title, description),
      product_name: extractProductName(title),
      lot_numbers: extractLotNumbers(fullText),
      expiry_dates: extractExpiryDates(fullText),
      image_url: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${BASE_URL}${imageUrl}`) : null,
      is_infant_formula: isInfantFormula(fullText),
    };
  } catch {
    return null;
  }
}

function extractDateFromUrl(url: string): string {
  const dateMatch = url.match(/\/(\d{4})\/(\d{2})\//);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}-01`;
  }
  return new Date().toISOString().split('T')[0];
}

async function scrapeAlertViaHTML(url: string): Promise<ScrapedRecall | null> {
  const response = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });

  if (!response.ok) {
    console.error(`Failed to fetch ${url}: ${response.status}`);
    return null;
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract title
  const title = $('h1').first().text().trim()
    || $('article h1, .article-title, .page-title').first().text().trim()
    || $('title').text().trim();

  if (!title) {
    console.warn(`No title found for ${url}`);
    return null;
  }

  // Extract content body
  const contentSelectors = [
    'article .article-body',
    '.field-name-body',
    '.content-area .text',
    'article .content',
    '.article-content',
    '.node-content',
    'main .content',
    '#content',
    '.cmp-text',          // AEM Core Components
    '.aem-GridColumn',    // AEM responsive grid
  ];

  let description = '';
  for (const selector of contentSelectors) {
    const el = $(selector).first();
    if (el.length) {
      description = el.text().trim();
      break;
    }
  }

  if (!description) {
    description = $('main').text().trim() || $('article').text().trim() || '';
  }

  // Extract published date
  let publishedDate = '';
  const dateSelectors = [
    'time[datetime]',
    '.date-published',
    '.article-date',
    '.field-name-post-date',
    'meta[property="article:published_time"]',
  ];

  for (const selector of dateSelectors) {
    const el = $(selector).first();
    if (el.length) {
      publishedDate = el.attr('datetime') || el.attr('content') || el.text().trim();
      break;
    }
  }

  if (!publishedDate) {
    publishedDate = extractDateFromUrl(url);
  }

  // Extract images
  let imageUrl: string | null = null;
  const imgSelectors = [
    'article img',
    '.article-content img',
    '.content-area img',
    '.field-name-body img',
    '.cmp-image img',
  ];

  for (const selector of imgSelectors) {
    const img = $(selector).first();
    if (img.length) {
      const src = img.attr('src');
      if (src && !src.includes('logo') && !src.includes('icon')) {
        imageUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
        break;
      }
    }
  }

  const fullText = `${title} ${description}`;

  return {
    source_url: url,
    title,
    description: description.substring(0, 5000),
    reason: extractReason(fullText),
    published_date: publishedDate,
    brand: extractBrand(title, description),
    product_name: extractProductName(title),
    lot_numbers: extractLotNumbers(fullText),
    expiry_dates: extractExpiryDates(fullText),
    image_url: imageUrl,
    is_infant_formula: isInfantFormula(fullText),
  };
}

export async function scrapeAlertPage(url: string): Promise<ScrapedRecall | null> {
  try {
    // Try API first, fall back to HTML
    const apiResult = await scrapeAlertViaAPI(url);
    if (apiResult) return apiResult;

    return await scrapeAlertViaHTML(url);
  } catch (err) {
    console.error(`Error scraping ${url}:`, err);
    return null;
  }
}

export async function scrapeAllAlerts(): Promise<ScrapedRecall[]> {
  const urls = await fetchAlertListUrls();
  const recalls: ScrapedRecall[] = [];

  // Process in batches to avoid overwhelming the server
  const BATCH_SIZE = 3;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(url => scrapeAlertPage(url)));

    for (const result of results) {
      if (result) {
        recalls.push(result);
      }
    }

    // Be polite: wait between batches
    if (i + BATCH_SIZE < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`Scraped ${recalls.length} recalls from ${urls.length} pages`);
  return recalls;
}
