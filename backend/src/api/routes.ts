import { Router, Request, Response } from 'express';
import { getRecalls, getRecallById, getRecallsByBarcode, addBarcode, getStats } from '../db';
import { lookupBarcode } from '../services/openfoodfacts';
import { BarcodeCheckResult } from '../types';

const router = Router();

/**
 * GET /api/recalls
 * List recalls with optional filters
 * Query params: limit, offset, search, infant_formula, status
 */
router.get('/recalls', (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string | undefined;
    const infantFormulaOnly = req.query.infant_formula === 'true';
    const status = req.query.status as string | undefined;

    const result = getRecalls({ limit, offset, search, infantFormulaOnly, status });
    res.json({
      data: result.recalls,
      total: result.total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Error fetching recalls:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/recalls/infant-formula
 * Dedicated endpoint for infant formula recalls
 */
router.get('/recalls/infant-formula', (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string | undefined;

    const result = getRecalls({ limit, offset, search, infantFormulaOnly: true });
    res.json({
      data: result.recalls,
      total: result.total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Error fetching infant formula recalls:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/recalls/barcode/:barcode
 * Check if a barcode matches any recalled product
 */
router.get('/recalls/barcode/:barcode', async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;

    // Validate barcode format (EAN-8, EAN-13, UPC-A)
    if (!/^\d{8,13}$/.test(barcode)) {
      res.status(400).json({ error: 'Invalid barcode format. Must be 8-13 digits.' });
      return;
    }

    // Check our recall database
    const recalls = getRecallsByBarcode(barcode);

    // Look up product info from Open Food Facts
    const product = await lookupBarcode(barcode);

    const result: BarcodeCheckResult = {
      found: recalls.length > 0,
      product,
      recalls,
    };

    res.json(result);
  } catch (err) {
    console.error('Error checking barcode:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/recalls/:id
 * Get a single recall by ID
 */
router.get('/recalls/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid recall ID' });
      return;
    }

    const recall = getRecallById(id);
    if (!recall) {
      res.status(404).json({ error: 'Recall not found' });
      return;
    }

    res.json(recall);
  } catch (err) {
    console.error('Error fetching recall:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/recalls/:id/barcodes
 * Manually associate a barcode with a recall
 * Body: { barcode: string }
 */
router.post('/recalls/:id/barcodes', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { barcode } = req.body;

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid recall ID' });
      return;
    }

    if (!barcode || !/^\d{8,13}$/.test(barcode)) {
      res.status(400).json({ error: 'Invalid barcode format. Must be 8-13 digits.' });
      return;
    }

    const recall = getRecallById(id);
    if (!recall) {
      res.status(404).json({ error: 'Recall not found' });
      return;
    }

    addBarcode(id, barcode, 'manual', 1.0);
    res.json({ success: true, message: 'Barcode associated with recall' });
  } catch (err) {
    console.error('Error adding barcode:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/stats
 * Get dashboard statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
