import { scrapeAllAlerts } from './securite-alimentaire';
import { upsertRecall, addBarcode } from '../db';
import { findBarcodesForProduct } from '../services/openfoodfacts';

export async function runScraper(): Promise<{ scraped: number; enriched: number }> {
  console.log('Starting scraper run...');

  const recalls = await scrapeAllAlerts();
  let enriched = 0;

  for (const recall of recalls) {
    const recallId = upsertRecall(recall);

    if (recallId > 0) {
      // Try to find barcodes via Open Food Facts
      try {
        const candidates = await findBarcodesForProduct(recall.product_name, recall.brand);
        for (const candidate of candidates) {
          addBarcode(recallId, candidate.barcode, 'openfoodfacts', candidate.confidence);
          enriched++;
        }
      } catch (err) {
        console.error(`Error enriching recall ${recallId}:`, err);
      }

      // Be polite to Open Food Facts API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`Scraper complete: ${recalls.length} recalls processed, ${enriched} barcodes enriched`);
  return { scraped: recalls.length, enriched };
}

if (require.main === module) {
  runScraper()
    .then(result => {
      console.log('Done:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('Scraper failed:', err);
      process.exit(1);
    });
}
