// AI-Driven Employee Feedback and Gamification Service
// Based on user's .NET MAUI code: AI suggests wellness rewards after 5 tasks

import { logger } from '../lib/logger';
import { db as firestore } from '../lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export interface EmployeePerformance {
  employeeUid: string;
  tasksCompletedToday: number;
  tasksCompletedThisWeek: number;
  tasksCompletedThisMonth: number;
  avgTaskDuration: number;
  qualityScore: number;
  customerRatings: number[];
}

export interface AIFeedback {
  type: 'wellness_reward' | 'achievement' | 'encouragement' | 'improvement_tip';
  title: string;
  message: string;
  reward?: {
    type: 'break' | 'bonus' | 'recognition';
    value: string;
  };
  triggeredBy: string;
}

export interface RewardTrigger {
  condition: string;
  threshold: number;
  reward: AIFeedback;
}

export class EmployeeAIFeedbackService {
  // Reward triggers (based on user's code: every 5 tasks = reward)
  private static readonly REWARD_TRIGGERS: RewardTrigger[] = [
    {
      condition: 'tasks_completed',
      threshold: 5,
      reward: {
        type: 'wellness_reward',
        title: 'Great Work!',
        message: 'You\'ve earned a 15-minute coffee break reward!',
        reward: {
          type: 'break',
          value: '15_minutes',
        },
        triggeredBy: '5_tasks_milestone',
      },
    },
    {
      condition: 'tasks_completed',
      threshold: 10,
      reward: {
        type: 'achievement',
        title: 'Outstanding Performance!',
        message: 'You\'ve completed 10 tasks today! Keep up the excellent work!',
        reward: {
          type: 'recognition',
          value: 'top_performer_badge',
        },
        triggeredBy: '10_tasks_milestone',
      },
    },
    {
      condition: 'tasks_completed',
      threshold: 20,
      reward: {
        type: 'wellness_reward',
        title: 'Exceptional Day!',
        message: 'You\'ve earned a ₪50 bonus for exceptional performance!',
        reward: {
          type: 'bonus',
          value: '50_ils',
        },
        triggeredBy: '20_tasks_milestone',
      },
    },
    {
      condition: 'quality_score',
      threshold: 4.5,
      reward: {
        type: 'achievement',
        title: 'Quality Champion!',
        message: 'Your quality score is exceptional! Customers love your work!',
        reward: {
          type: 'recognition',
          value: 'quality_star',
        },
        triggeredBy: 'high_quality_score',
      },
    },
  ];

  /**
   * Record task completion and check for AI feedback triggers
   * This is called from mobile app when employee completes a task
   */
  static async onTaskComplete(
    employeeUid: string,
    taskId: string
  ): Promise<AIFeedback | null> {
    try {
      // Get employee performance
      const performance = await this.getEmployeePerformance(employeeUid);

      // Increment task count
      performance.tasksCompletedToday += 1;

      // Update performance in Firestore
      await this.updatePerformance(employeeUid, performance);

      // Check for reward triggers
      const feedback = await this.checkRewardTriggers(performance);

      if (feedback) {
        // Log feedback event
        await this.logFeedbackEvent(employeeUid, feedback);

        // Send push notification to employee
        await this.sendPushNotification(employeeUid, feedback);

        logger.info('[AI Feedback] Reward triggered', {
          employeeUid,
          feedbackType: feedback.type,
          trigger: feedback.triggeredBy,
        });
      }

      return feedback;
    } catch (error) {
      logger.error('[AI Feedback] Task completion processing failed', error);
      return null;
    }
  }

  /**
   * Check if any reward triggers are met
   */
  private static async checkRewardTriggers(
    performance: EmployeePerformance
  ): Promise<AIFeedback | null> {
    for (const trigger of this.REWARD_TRIGGERS) {
      if (trigger.condition === 'tasks_completed') {
        // Check if tasks completed is exactly the threshold (not every time)
        if (performance.tasksCompletedToday === trigger.threshold) {
          return trigger.reward;
        }
        
        // Also check for multiples (every 5 tasks: 5, 10, 15, 20, etc.)
        if (
          trigger.threshold === 5 &&
          performance.tasksCompletedToday % 5 === 0 &&
          performance.tasksCompletedToday > 0
        ) {
          return trigger.reward;
        }
      }

      if (trigger.condition === 'quality_score') {
        if (performance.qualityScore >= trigger.threshold) {
          return trigger.reward;
        }
      }
    }

    return null;
  }

  /**
   * Get employee performance data
   */
  private static async getEmployeePerformance(
    employeeUid: string
  ): Promise<EmployeePerformance> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's completed tasks
    const tasksSnapshot = await firestore
      .collection('wash_tasks')
      .where('assignedToUid', '==', employeeUid)
      .where('status', '==', 'completed')
      .where('completedAt', '>=', Timestamp.fromDate(today))
      .get();

    const tasksCompletedToday = tasksSnapshot.size;

    // Get quality score from recent customer ratings
    const ratingsSnapshot = await firestore
      .collection('customer_ratings')
      .where('employeeUid', '==', employeeUid)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const ratings = ratingsSnapshot.docs.map((doc) => doc.data().rating);
    const qualityScore =
      ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;

    return {
      employeeUid,
      tasksCompletedToday,
      tasksCompletedThisWeek: 0, // TODO: Calculate
      tasksCompletedThisMonth: 0, // TODO: Calculate
      avgTaskDuration: 0, // TODO: Calculate
      qualityScore,
      customerRatings: ratings,
    };
  }

  /**
   * Update employee performance
   */
  private static async updatePerformance(
    employeeUid: string,
    performance: EmployeePerformance
  ): Promise<void> {
    await firestore
      .collection('employee_performance')
      .doc(employeeUid)
      .set(
        {
          ...performance,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
  }

  /**
   * Log AI feedback event
   */
  private static async logFeedbackEvent(
    employeeUid: string,
    feedback: AIFeedback
  ): Promise<void> {
    await firestore.collection('ai_feedback_events').add({
      employeeUid,
      feedback,
      timestamp: Timestamp.now(),
      acknowledged: false,
      retentionUntil: Timestamp.fromDate(
        new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000) // 7 years
      ),
    });
  }

  /**
   * Send push notification with AI feedback
   */
  private static async sendPushNotification(
    employeeUid: string,
    feedback: AIFeedback
  ): Promise<void> {
    // Get employee's FCM token
    const employeeDoc = await firestore.collection('users').doc(employeeUid).get();
    const fcmToken = employeeDoc.data()?.fcmToken;

    if (!fcmToken) {
      logger.warn('[AI Feedback] No FCM token for employee', { employeeUid });
      return;
    }

    // Send notification via Firebase Cloud Messaging
    const admin = require('firebase-admin');
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: feedback.title,
        body: feedback.message,
      },
      data: {
        type: 'ai_feedback',
        feedbackType: feedback.type,
        reward: JSON.stringify(feedback.reward || {}),
      },
    });

    logger.info('[AI Feedback] Push notification sent', { employeeUid });
  }

  /**
   * Get AI-generated performance insights
   */
  static async getPerformanceInsights(
    employeeUid: string
  ): Promise<string[]> {
    const performance = await this.getEmployeePerformance(employeeUid);
    const insights: string[] = [];

    // Task completion insights
    if (performance.tasksCompletedToday >= 15) {
      insights.push('🔥 You\'re having an exceptional day!');
    } else if (performance.tasksCompletedToday >= 10) {
      insights.push('⭐ Great productivity today!');
    } else if (performance.tasksCompletedToday < 5) {
      insights.push('💪 Let\'s aim for 5+ tasks today!');
    }

    // Quality insights
    if (performance.qualityScore >= 4.5) {
      insights.push('🌟 Your quality score is outstanding!');
    } else if (performance.qualityScore < 3.5) {
      insights.push('📈 Focus on customer satisfaction for better ratings');
    }

    // Encouragement
    if (performance.tasksCompletedToday % 5 === 4) {
      insights.push('🎯 One more task to earn a reward!');
    }

    return insights;
  }
}
