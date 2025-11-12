import { Router } from 'express';
import { auth } from '../lib/firebase-admin';
import { db } from '../db';
import { logger } from '../lib/observability';
import type { Request, Response } from 'express';

const router = Router();

router.get('/synthetic/auth-check', async (req: Request, res: Response) => {
  const checks: any[] = [];
  const startTime = Date.now();
  
  try {
    const webauthnStart = Date.now();
    try {
      const response = await fetch(`${req.protocol}://${req.get('host')}/api/auth/webauthn/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'synthetic-check@petwash.co.il' })
      });
      
      checks.push({
        name: 'webauthn_endpoint',
        status: response.ok ? 'pass' : 'fail',
        latency_ms: Date.now() - webauthnStart,
        status_code: response.status
      });
    } catch (error: any) {
      checks.push({
        name: 'webauthn_endpoint',
        status: 'error',
        latency_ms: Date.now() - webauthnStart,
        error: error.message
      });
    }
    
    const firestoreStart = Date.now();
    try {
      await auth.listUsers(1);
      checks.push({
        name: 'firebase_auth',
        status: 'pass',
        latency_ms: Date.now() - firestoreStart
      });
    } catch (error: any) {
      checks.push({
        name: 'firebase_auth',
        status: 'error',
        latency_ms: Date.now() - firestoreStart,
        error: error.message
      });
    }
    
    const dbStart = Date.now();
    try {
      const { sql } = await import('drizzle-orm');
      await db.execute(sql`SELECT 1`);
      checks.push({
        name: 'postgresql',
        status: 'pass',
        latency_ms: Date.now() - dbStart
      });
    } catch (error: any) {
      checks.push({
        name: 'postgresql',
        status: 'error',
        latency_ms: Date.now() - dbStart,
        error: error.message
      });
    }
    
    const allPassed = checks.every(c => c.status === 'pass');
    const totalLatency = Date.now() - startTime;
    
    const result = {
      status: allPassed ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      total_latency_ms: totalLatency,
      checks,
      environment: process.env.NODE_ENV || 'development'
    };
    
    if (!allPassed) {
      logger.warn('Synthetic check failed', { checks });
    }
    
    res.status(allPassed ? 200 : 503).json(result);
  } catch (error: any) {
    logger.error('Synthetic check error', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

router.get('/synthetic/e2e-login', async (req: Request, res: Response) => {
  const testEmail = 'synthetic-test@petwash.co.il';
  const testPassword = process.env.SYNTHETIC_TEST_PASSWORD || 'SyntheticTest123!';
  
  const steps: any[] = [];
  const startTime = Date.now();
  
  try {
    const createUserStart = Date.now();
    try {
      await auth.getUserByEmail(testEmail);
      steps.push({
        step: 'get_test_user',
        status: 'pass',
        latency_ms: Date.now() - createUserStart
      });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        try {
          await auth.createUser({
            email: testEmail,
            password: testPassword,
            emailVerified: true
          });
          steps.push({
            step: 'create_test_user',
            status: 'pass',
            latency_ms: Date.now() - createUserStart
          });
        } catch (createError: any) {
          steps.push({
            step: 'create_test_user',
            status: 'error',
            latency_ms: Date.now() - createUserStart,
            error: createError.message
          });
          throw createError;
        }
      } else {
        throw error;
      }
    }
    
    const tokenStart = Date.now();
    try {
      const userRecord = await auth.getUserByEmail(testEmail);
      const customToken = await auth.createCustomToken(userRecord.uid);
      steps.push({
        step: 'generate_token',
        status: 'pass',
        latency_ms: Date.now() - tokenStart
      });
    } catch (error: any) {
      steps.push({
        step: 'generate_token',
        status: 'error',
        latency_ms: Date.now() - tokenStart,
        error: error.message
      });
      throw error;
    }
    
    const allPassed = steps.every(s => s.status === 'pass');
    const totalLatency = Date.now() - startTime;
    
    const result = {
      status: allPassed ? 'pass' : 'fail',
      timestamp: new Date().toISOString(),
      total_latency_ms: totalLatency,
      steps,
      target_latency_ms: 3000,
      within_target: totalLatency < 3000
    };
    
    if (!allPassed || totalLatency >= 3000) {
      logger.warn('E2E login check failed or slow', { result });
    }
    
    res.json(result);
  } catch (error: any) {
    logger.error('E2E login check error', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      total_latency_ms: Date.now() - startTime,
      steps,
      error: error.message
    });
  }
});

export default router;
