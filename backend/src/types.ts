export interface Recall {
  id: number;
  source: 'securite-alimentaire' | 'lu-alert' | 'rasff';
  source_url: string;
  title: string;
  description: string;
  reason: string;
  published_date: string;
  brand: string | null;
  product_name: string;
  lot_numbers: string | null;
  expiry_dates: string | null;
  image_url: string | null;
  is_infant_formula: boolean;
  status: 'active' | 'resolved';
  created_at: string;
  updated_at: string;
}

export interface RecallBarcode {
  id: number;
  recall_id: number;
  barcode: string;
  source: 'scraped' | 'openfoodfacts' | 'manual';
  confidence: number;
  created_at: string;
}

export interface ProductCache {
  barcode: string;
  product_name: string | null;
  brand: string | null;
  categories: string | null;
  image_url: string | null;
  last_fetched: string;
}

export interface ScrapedRecall {
  source_url: string;
  title: string;
  description: string;
  reason: string;
  published_date: string;
  brand: string | null;
  product_name: string;
  lot_numbers: string | null;
  expiry_dates: string | null;
  image_url: string | null;
  is_infant_formula: boolean;
}

export interface OpenFoodFactsProduct {
  code: string;
  product_name: string;
  brands: string;
  categories: string;
  image_url: string;
}

export interface RecallWithBarcodes extends Recall {
  barcodes: RecallBarcode[];
}

export interface BarcodeCheckResult {
  found: boolean;
  product: ProductCache | null;
  recalls: RecallWithBarcodes[];
}
