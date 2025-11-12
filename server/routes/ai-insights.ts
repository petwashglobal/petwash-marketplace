/**
 * AI Insights Dashboard Routes
 * Admin-only routes to view user behavior and AI learning analytics
 */

import express from 'express';
import { getUserBehaviorInsights, getProblematicFAQs } from '../ai-learning-system';
import { logger } from '../lib/logger';
import { db as adminDb } from '../lib/firebase-admin';

const router = express.Router();

// Note: Admin limiter is applied in routes.ts before mounting this router
// So these routes are already protected

/**
 * GET /api/ai-insights/overview
 * Get overall AI behavior analytics
 */
router.get('/overview', async (req, res) => {
  try {
    const language = (req.query.language as 'he' | 'en') || undefined;
    
    const insights = await getUserBehaviorInsights(language);
    
    res.json({
      success: true,
      insights
    });
  } catch (error) {
    logger.error('[AI Insights] Failed to get overview', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AI insights'
    });
  }
});

/**
 * GET /api/ai-insights/problematic-faqs
 * Get FAQs that need improvement
 */
router.get('/problematic-faqs', async (req, res) => {
  try {
    const language = (req.query.language as 'he' | 'en') || undefined;
    
    const problematicFAQs = await getProblematicFAQs(language);
    
    res.json({
      success: true,
      problematicFAQs
    });
  } catch (error) {
    logger.error('[AI Insights] Failed to get problematic FAQs', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch problematic FAQs'
    });
  }
});

/**
 * GET /api/ai-insights/topic-breakdown
 * Get detailed breakdown by topic
 */
router.get('/topic-breakdown', async (req, res) => {
  try {
    const language = (req.query.language as 'he' | 'en') || undefined;
    
    // Get all topics
    let query = adminDb.collection('ai_topic_stats').orderBy('count', 'desc');
    if (language) {
      query = query.where('language', '==', language) as any;
    }
    
    const snapshot = await query.get();
    
    const topics = snapshot.docs.map(doc => ({
      topic: doc.data().topic,
      count: doc.data().count,
      language: doc.data().language,
      lastAsked: doc.data().lastAsked?.toDate().toISOString()
    }));
    
    res.json({
      success: true,
      topics
    });
  } catch (error) {
    logger.error('[AI Insights] Failed to get topic breakdown', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch topic breakdown'
    });
  }
});

/**
 * GET /api/ai-insights/recent-interactions
 * Get recent chat interactions (anonymized)
 */
router.get('/recent-interactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const language = (req.query.language as 'he' | 'en') || undefined;
    
    let query = adminDb
      .collection('ai_chat_interactions')
      .orderBy('timestamp', 'desc')
      .limit(limit);
    
    if (language) {
      query = query.where('language', '==', language) as any;
    }
    
    const snapshot = await query.get();
    
    const interactions = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        topic: data.topic,
        language: data.language,
        hasFollowUp: !!data.followUpQuestion,
        timeToRead: data.timeToRead,
        timestamp: data.timestamp?.toDate().toISOString(),
        // Don't expose actual questions/answers for privacy
        questionPreview: data.userQuestion?.substring(0, 50) + '...'
      };
    });
    
    res.json({
      success: true,
      interactions
    });
  } catch (error) {
    logger.error('[AI Insights] Failed to get recent interactions', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent interactions'
    });
  }
});

/**
 * GET /api/ai-insights/satisfaction-trends
 * Get satisfaction trends over time
 */
router.get('/satisfaction-trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const language = (req.query.language as 'he' | 'en') || undefined;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    let query = adminDb
      .collection('ai_faq_learning')
      .where('lastUpdated', '>', startDate)
      .orderBy('lastUpdated', 'desc');
    
    if (language) {
      query = query.where('language', '==', language) as any;
    }
    
    const snapshot = await query.get();
    
    // Group by day
    const trendsByDay: { [key: string]: { total: number; avgSatisfaction: number; count: number } } = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const dateKey = data.lastUpdated?.toDate().toISOString().split('T')[0];
      
      if (dateKey) {
        if (!trendsByDay[dateKey]) {
          trendsByDay[dateKey] = { total: 0, avgSatisfaction: 0, count: 0 };
        }
        
        trendsByDay[dateKey].total += data.avgSatisfaction;
        trendsByDay[dateKey].count += 1;
        trendsByDay[dateKey].avgSatisfaction = trendsByDay[dateKey].total / trendsByDay[dateKey].count;
      }
    });
    
    const trends = Object.entries(trendsByDay).map(([date, stats]) => ({
      date,
      avgSatisfaction: stats.avgSatisfaction,
      interactions: stats.count
    })).sort((a, b) => a.date.localeCompare(b.date));
    
    res.json({
      success: true,
      trends
    });
  } catch (error) {
    logger.error('[AI Insights] Failed to get satisfaction trends', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch satisfaction trends'
    });
  }
});

export default router;
