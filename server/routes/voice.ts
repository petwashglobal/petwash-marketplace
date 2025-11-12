// Voice Command API Routes
// Handles voice commands from mobile app

import { Router } from 'express';
import { VoiceCommandService } from '../services/VoiceCommandService';
import { requireAuth } from '../customAuth';
import { logger } from '../lib/logger';

const router = Router();

/**
 * POST /api/voice/command
 * Process voice command from mobile app
 */
router.post('/command', requireAuth, async (req, res) => {
  try {
    const { rawText, stationId } = req.body;
    const employeeUid = req.user!.uid;

    if (!rawText || !stationId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: rawText, stationId',
      });
    }

    const result = await VoiceCommandService.processVoiceCommand(
      rawText,
      stationId,
      employeeUid
    );

    res.json(result);
  } catch (error) {
    logger.error('[Voice API] Command processing failed', error);
    res.status(500).json({
      success: false,
      message: 'Voice command processing failed',
    });
  }
});

/**
 * GET /api/voice/commands
 * Get list of available voice commands
 */
router.get('/commands', requireAuth, async (req, res) => {
  res.json({
    success: true,
    commands: [
      {
        name: 'Start Wash',
        phrases: ['start wash', 'begin wash', 'activate wash'],
        description: 'Starts the washing cycle',
      },
      {
        name: 'Dispense Shampoo',
        phrases: ['dispense shampoo', 'add shampoo', 'shampoo'],
        description: 'Dispenses organic shampoo',
      },
      {
        name: 'Rinse',
        phrases: ['rinse', 'start rinse', 'rinse cycle'],
        description: 'Starts the rinse cycle',
      },
      {
        name: 'Dry',
        phrases: ['dry', 'start dry', 'drying cycle'],
        description: 'Starts the drying cycle',
      },
      {
        name: 'Emergency Stop',
        phrases: ['emergency stop', 'stop now', 'halt'],
        description: 'Immediately stops all operations',
      },
      {
        name: 'Station Status',
        phrases: ['status', 'check status', 'current status'],
        description: 'Gets current station status',
      },
    ],
  });
});

export default router;
