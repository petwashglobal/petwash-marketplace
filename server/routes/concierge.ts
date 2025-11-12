import { Router, type Request, type Response } from 'express';
import { 
  createConciergeRequest,
  generateProactiveAlerts,
  createPremiumOnboarding,
  type PetCareConciergeRequest 
} from '../utils/appleCX';
import type { AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

/**
 * POST /api/concierge/request - Create Pet Care Concierge request
 */
router.post('/request', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const requestData: PetCareConciergeRequest = {
      userId,
      ...req.body,
    };
    const result = createConciergeRequest(requestData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create concierge request' });
  }
});

/**
 * GET /api/concierge/alerts - Get proactive alerts for user
 */
router.get('/alerts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    // In production, fetch from loyalty profile
    const mockActivity = {
      lastWashDate: new Date('2025-10-20'),
      averageWashInterval: 21,
      petAge: 5,
      totalWashes: 12,
    };
    const alerts = generateProactiveAlerts(userId, mockActivity);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * GET /api/concierge/onboarding - Get premium onboarding experience
 */
router.get('/onboarding', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const onboarding = createPremiumOnboarding(userId);
    res.json(onboarding);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get onboarding' });
  }
});

export default router;
