import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { ScrapedRecall } from '../types';

const BASE_URL = 'https://securite-alimentaire.public.lu';
const ALERTS_URL = `${BASE_URL}/fr/actualites/alertes.html`;

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
  // Common patterns: "Rappel de produit: BRAND - Product" or "marque BRAND"
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
  // Remove common prefixes like "Rappel de produit:" or "Avis de rappel:"
  return title
    .replace(/^(?:rappel\s+de\s+produit|avis\s+de\s+rappel|rappel)\s*[:\-–]\s*/i, '')
    .trim();
}

export async function fetchAlertListUrls(): Promise<string[]> {
  const response = await fetch(ALERTS_URL, {
    headers: {
      'User-Agent': 'FoodWarnLux/1.0 (Luxembourg Food Safety App)',
      'Accept': 'text/html',
      'Accept-Language': 'fr-LU,fr;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch alerts page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const urls: string[] = [];

  // The alerts page lists links to individual alert pages
  // Look for article/news links within the content area
  $('a[href*="/actualites/alertes/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('/alertes/') && href.endsWith('.html') && !href.endsWith('alertes.html')) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!urls.includes(fullUrl)) {
        urls.push(fullUrl);
      }
    }
  });

  // Also look for links in common CMS listing patterns
  $('ul.list-news a, .news-list a, .article-list a, .content-area a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('/alertes/') && href.endsWith('.html') && !href.endsWith('alertes.html')) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!urls.includes(fullUrl)) {
        urls.push(fullUrl);
      }
    }
  });

  console.log(`Found ${urls.length} alert URLs`);
  return urls;
}

export async function scrapeAlertPage(url: string): Promise<ScrapedRecall | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FoodWarnLux/1.0 (Luxembourg Food Safety App)',
        'Accept': 'text/html',
        'Accept-Language': 'fr-LU,fr;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title - try multiple selectors common in government CMS
    const title = $('h1').first().text().trim()
      || $('article h1, .article-title, .page-title').first().text().trim()
      || $('title').text().trim();

    if (!title) {
      console.warn(`No title found for ${url}`);
      return null;
    }

    // Extract the main content body
    const contentSelectors = [
      'article .article-body',
      '.field-name-body',
      '.content-area .text',
      'article .content',
      '.article-content',
      '.node-content',
      'main .content',
      '#content',
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
      // Fallback: get all text from main content area
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
      // Try to extract date from URL pattern: /2026/01/
      const dateMatch = url.match(/\/(\d{4})\/(\d{2})\//);
      if (dateMatch) {
        publishedDate = `${dateMatch[1]}-${dateMatch[2]}-01`;
      }
    }

    // Extract images
    let imageUrl: string | null = null;
    const imgSelectors = [
      'article img',
      '.article-content img',
      '.content-area img',
      '.field-name-body img',
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
    const productName = extractProductName(title);
    const brand = extractBrand(title, description);
    const lotNumbers = extractLotNumbers(fullText);
    const expiryDates = extractExpiryDates(fullText);
    const infantFormula = isInfantFormula(fullText);

    // Try to extract reason/hazard
    let reason = '';
    const reasonPatterns = [
      /(?:motif|raison|danger|risque|problème|contamination|présence)\s*[:\s]+([^\n.]+)/i,
      /(?:salmonell|listeria|e\.\s*coli|cronobacter|allergène|allergen)/i,
    ];

    for (const pattern of reasonPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        reason = match[1]?.trim() || match[0].trim();
        break;
      }
    }

    return {
      source_url: url,
      title,
      description: description.substring(0, 5000),
      reason,
      published_date: publishedDate || new Date().toISOString().split('T')[0],
      brand,
      product_name: productName,
      lot_numbers: lotNumbers,
      expiry_dates: expiryDates,
      image_url: imageUrl,
      is_infant_formula: infantFormula,
    };
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
