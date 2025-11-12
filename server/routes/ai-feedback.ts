// AI Feedback API Routes
// Employee performance tracking and gamification

import { Router } from 'express';
import { EmployeeAIFeedbackService } from '../services/EmployeeAIFeedbackService';
import { requireAuth } from '../customAuth';
import { logger } from '../lib/logger';

const router = Router();

/**
 * POST /api/ai-feedback/task-complete
 * Notify system of task completion and get AI feedback
 */
router.post('/task-complete', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.body;
    const employeeUid = req.user!.uid;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: taskId',
      });
    }

    const feedback = await EmployeeAIFeedbackService.onTaskComplete(
      employeeUid,
      taskId
    );

    res.json({
      success: true,
      feedback,
      message: feedback
        ? 'Reward earned!'
        : 'Task completed successfully',
    });
  } catch (error) {
    logger.error('[AI Feedback API] Task completion failed', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process task completion',
    });
  }
});

/**
 * GET /api/ai-feedback/insights
 * Get AI-generated performance insights
 */
router.get('/insights', requireAuth, async (req, res) => {
  try {
    const employeeUid = req.user!.uid;

    const insights = await EmployeeAIFeedbackService.getPerformanceInsights(
      employeeUid
    );

    res.json({
      success: true,
      insights,
    });
  } catch (error) {
    logger.error('[AI Feedback API] Insights failed', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance insights',
    });
  }
});

/**
 * GET /api/ai-feedback/history
 * Get AI feedback history for employee
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const employeeUid = req.user!.uid;
    const { db: firestore } = require('../lib/firebase-admin');

    const feedbackSnapshot = await firestore
      .collection('ai_feedback_events')
      .where('employeeUid', '==', employeeUid)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const feedbackHistory = feedbackSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate(),
    }));

    res.json({
      success: true,
      feedbackHistory,
    });
  } catch (error) {
    logger.error('[AI Feedback API] History failed', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feedback history',
    });
  }
});

export default router;
