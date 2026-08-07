import { Router, Response } from 'express';
import { query } from '../db/init';
import { AuthRequest } from '../middleware/auth';
import {
  isAIConfigured,
  getCzechTaxAdvice,
} from '../services/aiProvider';

export const aiRouter: ReturnType<typeof Router> = Router();

// Check if AI features are available
aiRouter.get('/status', async (req: AuthRequest, res: Response) => {
  // Check if AI is enabled in settings
  const settingsResult = await query(
    'SELECT ai_enabled FROM settings WHERE user_id = $1',
    [req.userId]
  );
  const aiEnabled = settingsResult.rows.length > 0 ? (settingsResult.rows[0].ai_enabled ?? true) : true;

  const configured = aiEnabled && await isAIConfigured(req.userId!);
  res.json({
    available: configured,
    features: {
      taxAdvisor: true,
    },
  });
});

// Czech tax advisor chat
aiRouter.post('/tax-advisor', async (req: AuthRequest, res: Response) => {
  try {
    const configured = await isAIConfigured(req.userId!);
    if (!configured) {
      return res.status(503).json({ error: 'AI features not configured. Please add your API key in Settings.' });
    }

    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (question.length > 500) {
      return res.status(400).json({ error: 'Question is too long (max 500 characters)' });
    }

    const response = await getCzechTaxAdvice(req.userId!, question);
    res.json(response);
  } catch (error) {
    console.error('Tax advisor error:', error);
    res.status(500).json({ error: 'Failed to get tax advice' });
  }
});

export default aiRouter;
