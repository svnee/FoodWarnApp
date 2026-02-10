import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import routes from './api/routes';
import { getDb } from './db';
import { runScraper } from './scraper/run';

const PORT = parseInt(process.env.PORT || '3000');
const SCRAPE_SCHEDULE = process.env.SCRAPE_SCHEDULE || '0 */6 * * *'; // Every 6 hours

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Initialize database
getDb();

// Schedule periodic scraping
cron.schedule(SCRAPE_SCHEDULE, async () => {
  console.log(`[${new Date().toISOString()}] Running scheduled scrape...`);
  try {
    const result = await runScraper();
    console.log(`[${new Date().toISOString()}] Scheduled scrape complete:`, result);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Scheduled scrape failed:`, err);
  }
});

app.listen(PORT, () => {
  console.log(`FoodWarnLux API server running on port ${PORT}`);
  console.log(`Scraping schedule: ${SCRAPE_SCHEDULE}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /health`);
  console.log(`  GET  /api/recalls`);
  console.log(`  GET  /api/recalls/infant-formula`);
  console.log(`  GET  /api/recalls/barcode/:barcode`);
  console.log(`  GET  /api/recalls/:id`);
  console.log(`  POST /api/recalls/:id/barcodes`);
  console.log(`  GET  /api/stats`);
});

export default app;
