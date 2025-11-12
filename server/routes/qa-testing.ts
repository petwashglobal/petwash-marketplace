/**
 * QA Testing API Routes
 * Comprehensive endpoint testing and reporting
 */

import { Router } from 'express';
import { logger } from '../lib/logger';
import { runEndpointQA } from '../qa-endpoint-test';
import { runLinkCheck } from '../qa-link-checker';
import { sendLuxuryEmail } from '../email/luxury-email-service';

const router = Router();

/**
 * Run comprehensive endpoint QA tests
 */
router.get('/run-tests', async (req, res) => {
  try {
    logger.info('[QA API] Starting comprehensive endpoint tests...');

    const { results, htmlReport } = await runEndpointQA();

    res.json({
      success: true,
      ...results,
      reportAvailable: true
    });
  } catch (error: any) {
    logger.error('[QA API] Failed to run tests', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get QA report as HTML
 */
router.get('/report', async (req, res) => {
  try {
    logger.info('[QA API] Generating HTML report...');

    const { htmlReport } = await runEndpointQA();

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlReport);
  } catch (error: any) {
    logger.error('[QA API] Failed to generate report', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Send QA report to email
 */
router.post('/send-report', async (req, res) => {
  try {
    const { email } = req.body;
    const recipientEmail = email || 'Nir.h@petwash.co.il';

    logger.info('[QA API] Generating and sending QA report to CEO', { email: recipientEmail });

    const { results, htmlReport } = await runEndpointQA();

    await sendLuxuryEmail({
      to: recipientEmail,
      subject: `🔍 Pet Wash™ - Endpoint QA Report ${new Date().toLocaleDateString()}`,
      html: htmlReport
    });

    res.json({
      success: true,
      message: `QA Report sent to ${recipientEmail}`,
      summary: results.summary
    });
  } catch (error: any) {
    logger.error('[QA API] Failed to send QA report', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Check all links, routes, and assets
 */
router.get('/check-links', async (req, res) => {
  try {
    logger.info('[QA API] Running comprehensive link check...');

    const { results } = await runLinkCheck();

    res.json({
      success: true,
      ...results
    });
  } catch (error: any) {
    logger.error('[QA API] Failed to check links', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get link check report as HTML
 */
router.get('/links-report', async (req, res) => {
  try {
    logger.info('[QA API] Generating link check HTML report...');

    const { htmlReport } = await runLinkCheck();

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlReport);
  } catch (error: any) {
    logger.error('[QA API] Failed to generate link report', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
