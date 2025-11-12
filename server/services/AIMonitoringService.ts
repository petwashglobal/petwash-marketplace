/**
 * AI MONITORING SERVICE - Automated Quality Assurance
 * 
 * Purpose: Background AI monitoring for:
 * 1. Translation/i18n string consistency (all 6 languages)
 * 2. Error detection (faults, conflicts, duplications)
 * 3. Code quality issues (security, performance, bugs)
 * 4. Real-time alerts for critical problems
 * 
 * Runs: Continuously in background, non-blocking
 * Reports: Logs to console + Slack webhook (if configured)
 */

import { logger } from '../lib/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

interface MonitoringIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'translation' | 'error' | 'duplication' | 'security' | 'performance';
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
  timestamp: Date;
}

class AIMonitoringService {
  private issues: MonitoringIssue[] = [];
  private isRunning = false;
  private isScanning = false; // Guard against overlapping scans
  private checkInterval = 15 * 60 * 1000; // 15 minutes (reduced load)

  /**
   * Start the AI monitoring service
   */
  async start() {
    if (this.isRunning) {
      logger.warn('[AI Monitor] Already running');
      return;
    }

    this.isRunning = true;
    logger.info('[AI Monitor] 🤖 Starting automated quality monitoring...');

    // Run initial check
    await this.runAllChecks();

    // Schedule periodic checks
    setInterval(() => {
      this.runAllChecks().catch(error => {
        logger.error('[AI Monitor] Check failed:', error);
      });
    }, this.checkInterval);

    logger.info('[AI Monitor] ✅ Monitoring active');
  }

  /**
   * Run all monitoring checks (with concurrency guard)
   */
  private async runAllChecks() {
    // Guard against overlapping scans
    if (this.isScanning) {
      logger.debug('[AI Monitor] Scan already in progress, skipping...');
      return;
    }

    this.isScanning = true;
    logger.debug('[AI Monitor] Running checks...');
    this.issues = [];

    try {
      await Promise.all([
        this.checkTranslations(),
        this.checkDuplicateCode(),
        this.checkErrorPatterns(),
        this.checkSecurityIssues(),
      ]);

      this.reportIssues();
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Check translation consistency across 6 languages
   */
  private async checkTranslations() {
    try {
      const i18nPath = path.join(process.cwd(), 'client/src/lib/i18n.ts');
      const content = await fs.readFile(i18nPath, 'utf-8');

      // Extract translation keys
      const keyPattern = /'([^']+)':\s*\{/g;
      const keys: string[] = [];
      let match;
      while ((match = keyPattern.exec(content)) !== null) {
        keys.push(match[1]);
      }

      // Check for missing languages (should have en, he, ar, ru, fr, es)
      const requiredLanguages = ['en', 'he', 'ar', 'ru', 'fr', 'es'];
      const missingTranslations: string[] = [];

      for (const key of keys) {
        const keyRegex = new RegExp(`'${key}':\\s*\\{([^}]+)\\}`, 'g');
        const keyMatch = keyRegex.exec(content);
        
        if (keyMatch) {
          const langs = keyMatch[1];
          for (const lang of requiredLanguages) {
            if (!langs.includes(`${lang}:`)) {
              missingTranslations.push(`${key} missing ${lang}`);
            }
          }
        }
      }

      if (missingTranslations.length > 0) {
        this.issues.push({
          severity: 'warning',
          category: 'translation',
          file: 'client/src/lib/i18n.ts',
          message: `Found ${missingTranslations.length} incomplete translations`,
          suggestion: 'Add missing language keys: ' + missingTranslations.slice(0, 3).join(', '),
          timestamp: new Date(),
        });
      }

      // Check for inline ternaries in pages (should use t() instead)
      const pagesDir = path.join(process.cwd(), 'client/src/pages');
      const files = await fs.readdir(pagesDir);
      
      for (const file of files) {
        if (file.endsWith('.tsx')) {
          const filePath = path.join(pagesDir, file);
          const pageContent = await fs.readFile(filePath, 'utf-8');
          const ternaryCount = (pageContent.match(/language === ['"]he['"] \?/g) || []).length;
          
          if (ternaryCount > 5) {
            this.issues.push({
              severity: 'warning',
              category: 'translation',
              file: `client/src/pages/${file}`,
              message: `Found ${ternaryCount} inline language ternaries (should use t() function)`,
              suggestion: 'Refactor to use centralized i18n: t("key", language)',
              timestamp: new Date(),
            });
          }
        }
      }
    } catch (error) {
      logger.error('[AI Monitor] Translation check failed:', error);
    }
  }

  /**
   * Check for duplicate code patterns
   */
  private async checkDuplicateCode() {
    try {
      // Check for duplicate imports
      const clientDir = path.join(process.cwd(), 'client/src');
      const files = await this.getFiles(clientDir, '.tsx');
      
      const importPatterns = new Map<string, string[]>();

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const imports = content.match(/import .+ from ['"].+['"]/g) || [];
        
        for (const imp of imports) {
          if (!importPatterns.has(imp)) {
            importPatterns.set(imp, []);
          }
          importPatterns.get(imp)!.push(file);
        }
      }

      // Report suspiciously common imports (might indicate duplicate code)
      for (const [imp, files] of importPatterns) {
        if (files.length > 20 && imp.includes('./')) {
          this.issues.push({
            severity: 'info',
            category: 'duplication',
            file: 'Multiple files',
            message: `Import "${imp}" used in ${files.length} files - consider shared utility`,
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      logger.error('[AI Monitor] Duplication check failed:', error);
    }
  }

  /**
   * Check for error patterns and anti-patterns
   */
  private async checkErrorPatterns() {
    try {
      // Check for swallowed errors (empty catch blocks)
      const srcDir = path.join(process.cwd(), 'client/src');
      const files = await this.getFiles(srcDir, '.tsx', '.ts');

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Check for empty catch blocks
          if (line.includes('} catch') && i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine === '}' || nextLine === '// ignore') {
              this.issues.push({
                severity: 'warning',
                category: 'error',
                file: file.replace(process.cwd(), ''),
                line: i + 1,
                message: 'Empty catch block - errors silently swallowed',
                suggestion: 'Add error logging or user feedback',
                timestamp: new Date(),
              });
            }
          }

          // Check for missing error boundaries in React components
          if (line.includes('export') && line.includes('function') && content.includes('useState')) {
            if (!content.includes('ErrorBoundary')) {
              // Only warn for complex components
              const complexityScore = (content.match(/useState|useEffect|useQuery/g) || []).length;
              if (complexityScore > 3) {
                this.issues.push({
                  severity: 'info',
                  category: 'error',
                  file: file.replace(process.cwd(), ''),
                  message: 'Complex component without error boundary',
                  suggestion: 'Wrap in ErrorBoundary for better error handling',
                  timestamp: new Date(),
                });
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('[AI Monitor] Error pattern check failed:', error);
    }
  }

  /**
   * Check for security issues (OPTIMIZED - only scan source directories)
   */
  private async checkSecurityIssues() {
    try {
      // PERFORMANCE FIX: Only scan specific source directories, not entire project
      const targetDirs = [
        path.join(process.cwd(), 'client/src'),
        path.join(process.cwd(), 'server'),
      ];

      const dangerousPatterns = [
        { pattern: /apiKey\s*[:=]\s*['"][^'"]{20,}['"]/, message: 'Possible hardcoded API key' },
        { pattern: /password\s*[:=]\s*['"][^'"]+['"]/, message: 'Possible hardcoded password' },
        { pattern: /secret\s*[:=]\s*['"][^'"]{20,}['"]/, message: 'Possible hardcoded secret' },
        { pattern: /token\s*[:=]\s*['"][^'"]{30,}['"]/, message: 'Possible hardcoded token' },
      ];

      for (const dir of targetDirs) {
        const files = await this.getFiles(dir, '.ts', '.tsx', '.js');
        
        // Limit to 50 files per directory to avoid performance issues
        for (const file of files.slice(0, 50)) {
          const content = await fs.readFile(file, 'utf-8');
          
          for (const { pattern, message } of dangerousPatterns) {
            if (pattern.test(content)) {
              this.issues.push({
                severity: 'critical',
                category: 'security',
                file: file.replace(process.cwd(), ''),
                message,
                suggestion: 'Use environment variables (process.env or import.meta.env)',
                timestamp: new Date(),
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('[AI Monitor] Security check failed:', error);
    }
  }

  /**
   * Report all found issues
   */
  private reportIssues() {
    if (this.issues.length === 0) {
      logger.info('[AI Monitor] ✅ No issues found');
      return;
    }

    const critical = this.issues.filter(i => i.severity === 'critical');
    const warnings = this.issues.filter(i => i.severity === 'warning');
    const info = this.issues.filter(i => i.severity === 'info');

    logger.warn(`[AI Monitor] 📊 Found ${this.issues.length} issues:`, {
      critical: critical.length,
      warnings: warnings.length,
      info: info.length,
    });

    // Log critical issues immediately
    if (critical.length > 0) {
      logger.error('[AI Monitor] 🚨 CRITICAL ISSUES:');
      for (const issue of critical) {
        logger.error(`  - ${issue.file}: ${issue.message}`);
        if (issue.suggestion) {
          logger.error(`    💡 ${issue.suggestion}`);
        }
      }
    }

    // Log top warnings
    if (warnings.length > 0) {
      logger.warn('[AI Monitor] ⚠️  TOP WARNINGS:');
      for (const issue of warnings.slice(0, 5)) {
        logger.warn(`  - ${issue.file}: ${issue.message}`);
      }
      if (warnings.length > 5) {
        logger.warn(`  ... and ${warnings.length - 5} more warnings`);
      }
    }

    // Send to Slack if configured
    this.sendToSlack(critical, warnings);
  }

  /**
   * Send critical issues to Slack
   */
  private async sendToSlack(critical: MonitoringIssue[], warnings: MonitoringIssue[]) {
    const webhookUrl = process.env.ALERTS_SLACK_WEBHOOK;
    if (!webhookUrl || critical.length === 0) return;

    try {
      const message = {
        text: `🤖 AI Monitor Alert: ${critical.length} critical issues found`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Critical Issues (${critical.length})*\n${critical.map(i => `• ${i.file}: ${i.message}`).join('\n')}`,
            },
          },
        ],
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch (error) {
      logger.error('[AI Monitor] Failed to send Slack alert:', error);
    }
  }

  /**
   * Get all files recursively (OPTIMIZED - exclude heavy directories)
   */
  private async getFiles(dir: string, ...extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    
    // PERFORMANCE FIX: Blacklist of directories to skip
    const excludeDirs = [
      'node_modules',
      'dist',
      'build',
      '.git',
      '.vite',
      'attached_assets',
      'docs',
      'public',
      'logs',
      '.next',
      'coverage',
    ];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (!entry.name.startsWith('.') && !excludeDirs.includes(entry.name)) {
            files.push(...await this.getFiles(fullPath, ...extensions));
          }
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Silently skip inaccessible directories
    }
    
    return files;
  }

  /**
   * Get current issues summary
   */
  getSummary() {
    return {
      total: this.issues.length,
      critical: this.issues.filter(i => i.severity === 'critical').length,
      warnings: this.issues.filter(i => i.severity === 'warning').length,
      info: this.issues.filter(i => i.severity === 'info').length,
      categories: {
        translation: this.issues.filter(i => i.category === 'translation').length,
        error: this.issues.filter(i => i.category === 'error').length,
        duplication: this.issues.filter(i => i.category === 'duplication').length,
        security: this.issues.filter(i => i.category === 'security').length,
        performance: this.issues.filter(i => i.category === 'performance').length,
      },
    };
  }
}

// Export singleton instance
export const aiMonitor = new AIMonitoringService();
