import Database from 'better-sqlite3';
import path from 'path';
import { migrate } from './migrate';
import { Recall, RecallBarcode, RecallWithBarcodes, ProductCache, ScrapedRecall } from '../types';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/foodwarnlux.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = migrate(DB_PATH);
  }
  return db;
}

// --- Recalls ---

export function upsertRecall(recall: ScrapedRecall): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO recalls (source, source_url, title, description, reason, published_date,
                         brand, product_name, lot_numbers, expiry_dates, image_url,
                         is_infant_formula, status)
    VALUES ('securite-alimentaire', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    ON CONFLICT(source_url) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      reason = excluded.reason,
      brand = excluded.brand,
      product_name = excluded.product_name,
      lot_numbers = excluded.lot_numbers,
      expiry_dates = excluded.expiry_dates,
      image_url = excluded.image_url,
      is_infant_formula = excluded.is_infant_formula,
      updated_at = datetime('now')
  `);

  const result = stmt.run(
    recall.source_url,
    recall.title,
    recall.description,
    recall.reason,
    recall.published_date,
    recall.brand,
    recall.product_name,
    recall.lot_numbers,
    recall.expiry_dates,
    recall.image_url,
    recall.is_infant_formula ? 1 : 0
  );

  if (result.changes > 0 && result.lastInsertRowid) {
    return Number(result.lastInsertRowid);
  }

  const existing = db.prepare('SELECT id FROM recalls WHERE source_url = ?').get(recall.source_url) as { id: number } | undefined;
  return existing?.id ?? 0;
}

export function getRecalls(options: {
  limit?: number;
  offset?: number;
  search?: string;
  infantFormulaOnly?: boolean;
  status?: string;
}): { recalls: RecallWithBarcodes[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.search) {
    conditions.push('(r.title LIKE ? OR r.product_name LIKE ? OR r.brand LIKE ? OR r.description LIKE ?)');
    const term = `%${options.search}%`;
    params.push(term, term, term, term);
  }

  if (options.infantFormulaOnly) {
    conditions.push('r.is_infant_formula = 1');
  }

  if (options.status) {
    conditions.push('r.status = ?');
    params.push(options.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  const countRow = db.prepare(`SELECT COUNT(*) as count FROM recalls r ${where}`).get(...params) as { count: number };

  const recalls = db.prepare(`
    SELECT r.* FROM recalls r
    ${where}
    ORDER BY r.published_date DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Recall[];

  const recallsWithBarcodes = recalls.map(recall => ({
    ...recall,
    is_infant_formula: Boolean(recall.is_infant_formula),
    barcodes: getBarcodesForRecall(recall.id),
  }));

  return { recalls: recallsWithBarcodes, total: countRow.count };
}

export function getRecallById(id: number): RecallWithBarcodes | null {
  const db = getDb();
  const recall = db.prepare('SELECT * FROM recalls WHERE id = ?').get(id) as Recall | undefined;
  if (!recall) return null;

  return {
    ...recall,
    is_infant_formula: Boolean(recall.is_infant_formula),
    barcodes: getBarcodesForRecall(recall.id),
  };
}

export function getRecallsByBarcode(barcode: string): RecallWithBarcodes[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT r.* FROM recalls r
    INNER JOIN recall_barcodes rb ON r.id = rb.recall_id
    WHERE rb.barcode = ?
    ORDER BY r.published_date DESC
  `).all(barcode) as Recall[];

  return rows.map(recall => ({
    ...recall,
    is_infant_formula: Boolean(recall.is_infant_formula),
    barcodes: getBarcodesForRecall(recall.id),
  }));
}

// --- Barcodes ---

function getBarcodesForRecall(recallId: number): RecallBarcode[] {
  const db = getDb();
  return db.prepare('SELECT * FROM recall_barcodes WHERE recall_id = ?').all(recallId) as RecallBarcode[];
}

export function addBarcode(recallId: number, barcode: string, source: RecallBarcode['source'], confidence: number = 1.0): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO recall_barcodes (recall_id, barcode, source, confidence)
    VALUES (?, ?, ?, ?)
  `).run(recallId, barcode, source, confidence);
}

// --- Products Cache ---

export function getCachedProduct(barcode: string): ProductCache | null {
  const db = getDb();
  return db.prepare('SELECT * FROM products_cache WHERE barcode = ?').get(barcode) as ProductCache | null;
}

export function cacheProduct(product: ProductCache): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO products_cache (barcode, product_name, brand, categories, image_url, last_fetched)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(barcode) DO UPDATE SET
      product_name = excluded.product_name,
      brand = excluded.brand,
      categories = excluded.categories,
      image_url = excluded.image_url,
      last_fetched = datetime('now')
  `).run(product.barcode, product.product_name, product.brand, product.categories, product.image_url);
}

export function getStats(): { total_recalls: number; active_recalls: number; infant_formula_recalls: number; tracked_barcodes: number } {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM recalls').get() as any).c;
  const active = (db.prepare("SELECT COUNT(*) as c FROM recalls WHERE status = 'active'").get() as any).c;
  const infant = (db.prepare('SELECT COUNT(*) as c FROM recalls WHERE is_infant_formula = 1').get() as any).c;
  const barcodes = (db.prepare('SELECT COUNT(DISTINCT barcode) as c FROM recall_barcodes').get() as any).c;
  return { total_recalls: total, active_recalls: active, infant_formula_recalls: infant, tracked_barcodes: barcodes };
}
