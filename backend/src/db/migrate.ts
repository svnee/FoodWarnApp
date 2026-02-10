import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/foodwarnlux.db');

export function migrate(dbPath: string = DB_PATH): Database.Database {
  const fs = require('fs');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS recalls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL CHECK(source IN ('securite-alimentaire', 'lu-alert', 'rasff')),
      source_url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      published_date TEXT NOT NULL,
      brand TEXT,
      product_name TEXT NOT NULL,
      lot_numbers TEXT,
      expiry_dates TEXT,
      image_url TEXT,
      is_infant_formula INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'resolved')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recall_barcodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recall_id INTEGER NOT NULL REFERENCES recalls(id) ON DELETE CASCADE,
      barcode TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('scraped', 'openfoodfacts', 'manual')),
      confidence REAL NOT NULL DEFAULT 1.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(recall_id, barcode)
    );

    CREATE TABLE IF NOT EXISTS products_cache (
      barcode TEXT PRIMARY KEY,
      product_name TEXT,
      brand TEXT,
      categories TEXT,
      image_url TEXT,
      last_fetched TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_recalls_published ON recalls(published_date DESC);
    CREATE INDEX IF NOT EXISTS idx_recalls_infant ON recalls(is_infant_formula) WHERE is_infant_formula = 1;
    CREATE INDEX IF NOT EXISTS idx_recalls_source ON recalls(source);
    CREATE INDEX IF NOT EXISTS idx_recalls_status ON recalls(status);
    CREATE INDEX IF NOT EXISTS idx_barcodes_barcode ON recall_barcodes(barcode);
    CREATE INDEX IF NOT EXISTS idx_barcodes_recall ON recall_barcodes(recall_id);
  `);

  console.log('Database migrated successfully at', dbPath);
  return db;
}

if (require.main === module) {
  migrate();
}
