import fetch from 'node-fetch';
import { ProductCache } from '../types';
import { getCachedProduct, cacheProduct } from '../db';

const API_BASE = 'https://world.openfoodfacts.org';
const USER_AGENT = 'FoodWarnLux/1.0 (contact@foodwarnlux.lu)';

// Cache TTL: 7 days
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isCacheExpired(product: ProductCache): boolean {
  const fetched = new Date(product.last_fetched).getTime();
  return Date.now() - fetched > CACHE_TTL_MS;
}

export async function lookupBarcode(barcode: string): Promise<ProductCache | null> {
  // Check local cache first
  const cached = getCachedProduct(barcode);
  if (cached && !isCacheExpired(cached)) {
    return cached;
  }

  try {
    const response = await fetch(`${API_BASE}/api/v0/product/${barcode}.json`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      return cached || null;
    }

    const data = await response.json() as any;

    if (data.status !== 1 || !data.product) {
      // Product not found in Open Food Facts
      return cached || null;
    }

    const product: ProductCache = {
      barcode,
      product_name: data.product.product_name || data.product.product_name_fr || null,
      brand: data.product.brands || null,
      categories: data.product.categories || null,
      image_url: data.product.image_url || data.product.image_front_url || null,
      last_fetched: new Date().toISOString(),
    };

    cacheProduct(product);
    return product;
  } catch (err) {
    console.error(`Error looking up barcode ${barcode}:`, err);
    return cached || null;
  }
}

export async function searchProducts(query: string, page: number = 1): Promise<ProductCache[]> {
  try {
    const response = await fetch(
      `${API_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page=${page}&page_size=10&countries_tags_en=luxembourg`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!response.ok) return [];

    const data = await response.json() as any;

    if (!data.products || data.products.length === 0) {
      // Retry without country filter — some Luxembourg products aren't tagged
      const fallbackResponse = await fetch(
        `${API_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page=${page}&page_size=10`,
        { headers: { 'User-Agent': USER_AGENT } }
      );

      if (!fallbackResponse.ok) return [];
      const fallbackData = await fallbackResponse.json() as any;
      if (!fallbackData.products) return [];

      return fallbackData.products.map((p: any) => ({
        barcode: p.code,
        product_name: p.product_name || p.product_name_fr || null,
        brand: p.brands || null,
        categories: p.categories || null,
        image_url: p.image_url || p.image_front_url || null,
        last_fetched: new Date().toISOString(),
      }));
    }

    return data.products.map((p: any) => ({
      barcode: p.code,
      product_name: p.product_name || p.product_name_fr || null,
      brand: p.brands || null,
      categories: p.categories || null,
      image_url: p.image_url || p.image_front_url || null,
      last_fetched: new Date().toISOString(),
    }));
  } catch (err) {
    console.error(`Error searching products for "${query}":`, err);
    return [];
  }
}

/**
 * Try to match a recall product to barcodes via Open Food Facts
 * Returns candidate barcodes with confidence scores
 */
export async function findBarcodesForProduct(
  productName: string,
  brand: string | null
): Promise<Array<{ barcode: string; confidence: number }>> {
  const query = brand ? `${brand} ${productName}` : productName;
  const products = await searchProducts(query);

  if (products.length === 0) return [];

  const results: Array<{ barcode: string; confidence: number }> = [];
  const nameLower = productName.toLowerCase();
  const brandLower = brand?.toLowerCase() || '';

  for (const product of products) {
    let confidence = 0.3; // Base confidence for search match

    const pName = (product.product_name || '').toLowerCase();
    const pBrand = (product.brand || '').toLowerCase();

    // Boost confidence for name similarity
    if (pName.includes(nameLower) || nameLower.includes(pName)) {
      confidence += 0.3;
    }

    // Boost confidence for brand match
    if (brandLower && pBrand && (pBrand.includes(brandLower) || brandLower.includes(pBrand))) {
      confidence += 0.3;
    }

    if (confidence >= 0.5) {
      results.push({ barcode: product.barcode, confidence: Math.min(confidence, 1.0) });
      cacheProduct(product);
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}
