#!/usr/bin/env node
/**
 * ===================================================================
 * PetWash™ 2025 - Replit Deployment Blocker
 * ===================================================================
 * 
 * MASTER DIRECTIVE: Replit is DEVELOPMENT ENVIRONMENT ONLY.
 * 
 * Production deployments MUST go through:
 * GitHub → Google Cloud (Firebase Hosting / Cloud Run)
 * 
 * This script blocks ANY attempt to deploy from Replit to production.
 * ===================================================================
 */

console.error(`
╔═══════════════════════════════════════════════════════════════╗
║                  ❌ REPLIT DEPLOY BLOCKED                     ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Replit is a DEVELOPMENT ENVIRONMENT ONLY.                    ║
║                                                               ║
║  Production deployments MUST use the official pipeline:      ║
║                                                               ║
║  ✅ GitHub → Google Cloud (Firebase Hosting / Cloud Run)     ║
║                                                               ║
║  To deploy to production:                                    ║
║  1. Commit and push your changes to GitHub                   ║
║  2. GitHub Actions will automatically:                       ║
║     - Run preflight guardian (luxury 2025 compliance)        ║
║     - Run tests                                              ║
║     - Build the application                                  ║
║     - Deploy to Google Cloud                                 ║
║                                                               ║
║  Official Production:                                        ║
║  🌐 petwash.co.il                                            ║
║  🔐 Firebase Project: signinpetwash                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

process.exit(1);
