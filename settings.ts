import { Router } from 'express';
import { query } from '../database/pool.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { successResponse } from '../utils/errors.js';

const router = Router();

// Public settings (for frontend branding)
router.get('/public', async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT key, value FROM panel_settings WHERE key IN ($1, $2, $3, $4, $5, $6, $7)`,
      ['panel_name', 'panel_tagline', 'primary_color', 'secondary_color', 'allow_registration', 'maintenance_mode', 'default_theme']
    );

    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    settings.panel_name = settings.panel_name || 'CAVRIX';
    settings.panel_tagline = settings.panel_tagline || 'Powering Your Game Infrastructure';
    settings.primary_color = settings.primary_color || '#6366f1';
    settings.secondary_color = settings.secondary_color || '#8b5cf6';
    settings.allow_registration = settings.allow_registration ?? 'true';
    settings.maintenance_mode = settings.maintenance_mode ?? 'false';
    settings.default_theme = settings.default_theme || 'dark';

    res.json(successResponse(settings));
  } catch (error) {
    next(error);
  }
});

// Admin settings
router.get('/', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT key, value FROM panel_settings ORDER BY key`);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(successResponse(settings));
  } catch (error) {
    next(error);
  }
});

router.put('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const settings = req.body;

    for (const [key, value] of Object.entries(settings)) {
      await query(
        `INSERT INTO panel_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, String(value)]
      );
    }

    res.json(successResponse(null, 'Settings updated.'));
  } catch (error) {
    next(error);
  }
});

export default router;
