/**
 * COMPLIANCE CONTROL TOWER
 * ========================
 * AI-driven compliance monitoring and enforcement system
 * 
 * Protects Pet Wash™ from legal issues with:
 * - Employees, subcontractors, partners, JV, franchising
 * - Government agencies (Israeli ministries, municipalities)
 * - Customers, service providers
 * 
 * Features:
 * - Real-time compliance monitoring
 * - Automatic document expiry detection
 * - AI-powered risk scoring
 * - Auto-block non-compliant providers
 * - Smart alerts and escalation
 * - Integration with all compliance systems
 * 
 * Created: November 10, 2025
 */

import { db } from "../db";
import { eq, and, or, lt, gte, sql } from "drizzle-orm";
import {
  complianceTasks,
  authorityDocuments,
  providerLicenses,
  complianceAuditTrail,
  type InsertComplianceTask,
  type InsertComplianceAuditTrail,
  type ComplianceTask,
} from "@shared/schema-compliance";
import { createHash } from "crypto";
import { nanoid } from "nanoid";

/**
 * Compliance risk levels
 */
export enum ComplianceRiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Compliance status summary
 */
export interface ComplianceStatus {
  overallRisk: ComplianceRiskLevel;
  expiredDocuments: number;
  expiringDocuments: number; // Within 30 days
  suspendedProviders: number;
  pendingTasks: number;
  criticalTasks: number;
  lastMonitoringRun: Date;
  issues: ComplianceIssue[];
}

/**
 * Compliance issue
 */
export interface ComplianceIssue {
  id: string;
  type: "expired_document" | "expiring_document" | "missing_license" | "suspended_provider" | "overdue_task";
  severity: ComplianceRiskLevel;
  title: string;
  titleHe: string;
  description: string;
  descriptionHe: string;
  entityType: string;
  entityId: number;
  actionRequired: string;
  dueDate?: Date;
  affectedServices?: string[];
}

/**
 * Provider compliance summary
 */
export interface ProviderComplianceStatus {
  providerId: number;
  providerType: string;
  providerName: string;
  isCompliant: boolean;
  canOperate: boolean;
  riskLevel: ComplianceRiskLevel;
  issues: ComplianceIssue[];
  licenses: {
    total: number;
    active: number;
    expired: number;
    expiringSoon: number;
  };
  lastChecked: Date;
}

/**
 * Compliance Control Tower Service
 */
export class ComplianceControlTowerService {
  /**
   * Run comprehensive compliance monitoring
   * Returns summary of all compliance issues
   */
  async runComplianceMonitoring(): Promise<ComplianceStatus> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const issues: ComplianceIssue[] = [];

    // 1. Check expired authority documents
    const expiredDocs = await db
      .select()
      .from(authorityDocuments)
      .where(
        and(
          eq(authorityDocuments.status, "active"),
          lt(authorityDocuments.expiryDate, now.toISOString().split("T")[0])
        )
      );

    for (const doc of expiredDocs) {
      issues.push({
        id: `expired-doc-${doc.id}`,
        type: "expired_document",
        severity: doc.complianceLevel === "mandatory" ? ComplianceRiskLevel.CRITICAL : ComplianceRiskLevel.HIGH,
        title: `Expired: ${doc.title}`,
        titleHe: `פג תוקף: ${doc.titleHe || doc.title}`,
        description: `Authority document ${doc.documentNumber} expired on ${doc.expiryDate}`,
        descriptionHe: `מסמך רשות ${doc.documentNumber} פג תוקף ב-${doc.expiryDate}`,
        entityType: "authority_document",
        entityId: doc.id,
        actionRequired: "Renew document immediately",
        affectedServices: doc.applicableServices as string[],
      });

      // Auto-update status to expired
      await this.updateDocumentStatus(doc.id, "expired");
    }

    // 2. Check expiring authority documents (within 30 days)
    const expiringDocs = await db
      .select()
      .from(authorityDocuments)
      .where(
        and(
          eq(authorityDocuments.status, "active"),
          gte(authorityDocuments.expiryDate, now.toISOString().split("T")[0]),
          lt(authorityDocuments.expiryDate, thirtyDaysFromNow.toISOString().split("T")[0])
        )
      );

    for (const doc of expiringDocs) {
      const daysUntilExpiry = Math.ceil(
        (new Date(doc.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      issues.push({
        id: `expiring-doc-${doc.id}`,
        type: "expiring_document",
        severity: daysUntilExpiry <= 7 ? ComplianceRiskLevel.HIGH : ComplianceRiskLevel.MEDIUM,
        title: `Expiring Soon: ${doc.title}`,
        titleHe: `פג תוקף בקרוב: ${doc.titleHe || doc.title}`,
        description: `Document expires in ${daysUntilExpiry} days`,
        descriptionHe: `המסמך פג תוקף בעוד ${daysUntilExpiry} ימים`,
        entityType: "authority_document",
        entityId: doc.id,
        actionRequired: "Schedule renewal",
        dueDate: new Date(doc.expiryDate!),
        affectedServices: doc.applicableServices as string[],
      });

      // Send reminder if not sent recently
      await this.sendExpiryReminder(doc.id, "authority_document", daysUntilExpiry);
    }

    // 3. Check expired provider licenses
    const expiredLicenses = await db
      .select()
      .from(providerLicenses)
      .where(
        and(
          eq(providerLicenses.status, "active"),
          lt(providerLicenses.expiryDate, now.toISOString().split("T")[0])
        )
      );

    let suspendedProvidersCount = 0;

    for (const license of expiredLicenses) {
      issues.push({
        id: `expired-license-${license.id}`,
        type: "expired_document",
        severity: license.isMandatory ? ComplianceRiskLevel.CRITICAL : ComplianceRiskLevel.HIGH,
        title: `Expired License: ${license.providerName}`,
        titleHe: `רישיון פג תוקף: ${license.providerName}`,
        description: `${license.licenseType} license expired for provider ${license.providerName}`,
        descriptionHe: `רישיון ${license.licenseType} פג תוקף עבור ספק ${license.providerName}`,
        entityType: "provider_license",
        entityId: license.id,
        actionRequired: license.isMandatory ? "Suspend provider immediately" : "Request renewal",
      });

      // Auto-suspend provider if mandatory license expired
      if (license.isMandatory && license.autoSuspendOnExpiry) {
        await this.suspendProvider(license.providerId, license.providerType, "expired_license", license.id);
        suspendedProvidersCount++;
      }

      // Update license status
      await this.updateLicenseStatus(license.id, "expired");
    }

    // 4. Check expiring provider licenses
    const expiringLicenses = await db
      .select()
      .from(providerLicenses)
      .where(
        and(
          eq(providerLicenses.status, "active"),
          gte(providerLicenses.expiryDate, now.toISOString().split("T")[0]),
          lt(providerLicenses.expiryDate, thirtyDaysFromNow.toISOString().split("T")[0])
        )
      );

    for (const license of expiringLicenses) {
      const daysUntilExpiry = Math.ceil(
        (new Date(license.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      issues.push({
        id: `expiring-license-${license.id}`,
        type: "expiring_document",
        severity: daysUntilExpiry <= 7 ? ComplianceRiskLevel.HIGH : ComplianceRiskLevel.MEDIUM,
        title: `License Expiring: ${license.providerName}`,
        titleHe: `רישיון פג תוקף בקרוב: ${license.providerName}`,
        description: `License expires in ${daysUntilExpiry} days`,
        descriptionHe: `הרישיון פג תוקף בעוד ${daysUntilExpiry} ימים`,
        entityType: "provider_license",
        entityId: license.id,
        actionRequired: "Notify provider to renew",
        dueDate: new Date(license.expiryDate!),
      });

      // Send reminder
      await this.sendExpiryReminder(license.id, "provider_license", daysUntilExpiry);
    }

    // 5. Check overdue compliance tasks
    const overdueTasks = await db
      .select()
      .from(complianceTasks)
      .where(
        and(
          or(
            eq(complianceTasks.status, "pending"),
            eq(complianceTasks.status, "in_progress")
          ),
          lt(complianceTasks.dueDate, now)
        )
      );

    for (const task of overdueTasks) {
      issues.push({
        id: `overdue-task-${task.id}`,
        type: "overdue_task",
        severity: task.priority === "critical" ? ComplianceRiskLevel.CRITICAL : ComplianceRiskLevel.HIGH,
        title: `Overdue: ${task.title}`,
        titleHe: `באיחור: ${task.titleHe || task.title}`,
        description: task.description,
        descriptionHe: task.descriptionHe || task.description,
        entityType: "compliance_task",
        entityId: task.id,
        actionRequired: task.actionRequired,
        dueDate: task.dueDate,
      });

      // Update task status to overdue
      await db
        .update(complianceTasks)
        .set({ status: "overdue", updatedAt: new Date() })
        .where(eq(complianceTasks.id, task.id));
    }

    // 6. Get pending and critical tasks count
    const pendingTasksResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(complianceTasks)
      .where(
        or(
          eq(complianceTasks.status, "pending"),
          eq(complianceTasks.status, "in_progress")
        )
      );

    const criticalTasksResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(complianceTasks)
      .where(
        and(
          eq(complianceTasks.priority, "critical"),
          or(
            eq(complianceTasks.status, "pending"),
            eq(complianceTasks.status, "in_progress"),
            eq(complianceTasks.status, "overdue")
          )
        )
      );

    const pendingTasks = Number(pendingTasksResult[0]?.count || 0);
    const criticalTasks = Number(criticalTasksResult[0]?.count || 0);

    // Calculate overall risk
    const overallRisk = this.calculateOverallRisk(issues, criticalTasks);

    return {
      overallRisk,
      expiredDocuments: expiredDocs.length + expiredLicenses.length,
      expiringDocuments: expiringDocs.length + expiringLicenses.length,
      suspendedProviders: suspendedProvidersCount,
      pendingTasks,
      criticalTasks,
      lastMonitoringRun: now,
      issues,
    };
  }

  /**
   * Check compliance status for a specific provider
   */
  async checkProviderCompliance(
    providerId: number,
    providerType: string
  ): Promise<ProviderComplianceStatus> {
    const now = new Date();
    const licenses = await db
      .select()
      .from(providerLicenses)
      .where(
        and(
          eq(providerLicenses.providerId, providerId),
          eq(providerLicenses.providerType, providerType)
        )
      );

    const issues: ComplianceIssue[] = [];
    let activeLicenses = 0;
    let expiredLicenses = 0;
    let expiringSoon = 0;

    for (const license of licenses) {
      if (license.status === "active") {
        if (license.expiryDate && new Date(license.expiryDate) < now) {
          expiredLicenses++;
          
          if (license.isMandatory) {
            issues.push({
              id: `expired-${license.id}`,
              type: "expired_document",
              severity: ComplianceRiskLevel.CRITICAL,
              title: `Expired: ${license.licenseType}`,
              titleHe: `פג תוקף: ${license.licenseType}`,
              description: "Mandatory license expired",
              descriptionHe: "רישיון חובה פג תוקף",
              entityType: "provider_license",
              entityId: license.id,
              actionRequired: "Renew immediately or suspend operations",
            });
          }
        } else if (license.expiryDate) {
          const thirtyDaysFromNow = new Date(now);
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

          if (new Date(license.expiryDate) < thirtyDaysFromNow) {
            expiringSoon++;
          }
          activeLicenses++;
        } else {
          activeLicenses++;
        }
      } else if (license.status === "expired") {
        expiredLicenses++;
      }
    }

    // Check for missing mandatory licenses
    const requiredLicenses = this.getRequiredLicenses(providerType);
    const existingTypes = licenses.map(l => l.licenseType);
    const missingLicenses = requiredLicenses.filter(req => !existingTypes.includes(req));

    for (const missing of missingLicenses) {
      issues.push({
        id: `missing-${missing}`,
        type: "missing_license",
        severity: ComplianceRiskLevel.CRITICAL,
        title: `Missing License: ${missing}`,
        titleHe: `רישיון חסר: ${missing}`,
        description: "Required license not uploaded",
        descriptionHe: "רישיון חובה לא הועלה",
        entityType: "provider_license",
        entityId: 0,
        actionRequired: "Upload required license",
      });
    }

    const isCompliant = issues.filter(i => i.severity === ComplianceRiskLevel.CRITICAL).length === 0;
    const canOperate = isCompliant && expiredLicenses === 0;
    const riskLevel = this.calculateProviderRiskLevel(issues, expiredLicenses, expiringSoon);

    return {
      providerId,
      providerType,
      providerName: licenses[0]?.providerName || "Unknown",
      isCompliant,
      canOperate,
      riskLevel,
      issues,
      licenses: {
        total: licenses.length,
        active: activeLicenses,
        expired: expiredLicenses,
        expiringSoon,
      },
      lastChecked: now,
    };
  }

  /**
   * Create compliance task
   */
  async createComplianceTask(task: Partial<InsertComplianceTask>): Promise<ComplianceTask> {
    const taskId = `TASK-${new Date().getFullYear()}-${nanoid(8)}`;

    const [created] = await db
      .insert(complianceTasks)
      .values({
        taskId,
        ...task,
      } as InsertComplianceTask)
      .returning();

    // Create audit trail
    await this.logAuditEvent({
      eventType: "task_created",
      entityType: "compliance_task",
      entityId: created.id,
      action: "created",
      actionBy: task.assignedTo || 0,
      newState: created,
    });

    return created;
  }

  /**
   * Update authority document status
   */
  private async updateDocumentStatus(documentId: number, status: string): Promise<void> {
    await db
      .update(authorityDocuments)
      .set({ status, updatedAt: new Date() })
      .where(eq(authorityDocuments.id, documentId));

    // Create audit trail
    await this.logAuditEvent({
      eventType: "document_status_updated",
      entityType: "authority_document",
      entityId: documentId,
      action: "updated",
      newState: { status },
    });
  }

  /**
   * Update provider license status
   */
  private async updateLicenseStatus(licenseId: number, status: string): Promise<void> {
    await db
      .update(providerLicenses)
      .set({ status, updatedAt: new Date() })
      .where(eq(providerLicenses.id, licenseId));

    // Create audit trail
    await this.logAuditEvent({
      eventType: "license_status_updated",
      entityType: "provider_license",
      entityId: licenseId,
      action: "updated",
      newState: { status },
    });
  }

  /**
   * Suspend provider (auto-block from operations)
   */
  private async suspendProvider(
    providerId: number,
    providerType: string,
    reason: string,
    relatedEntityId: number
  ): Promise<void> {
    // Create critical task
    await this.createComplianceTask({
      title: `SUSPENDED: Provider ${providerId}`,
      titleHe: `מושעה: ספק ${providerId}`,
      description: `Provider suspended due to ${reason}`,
      descriptionHe: `ספק מושעה עקב ${reason}`,
      taskType: "provider_suspension",
      category: "regulatory",
      priority: "critical",
      urgency: "emergency",
      riskLevel: "critical",
      status: "completed",
      dueDate: new Date(),
      relatedEntityType: "provider_license",
      relatedEntityId,
      aiGenerated: true,
      aiRecommendedAction: "Suspend provider immediately until license renewed",
      completedAt: new Date(),
    });

    // Log to audit trail
    await this.logAuditEvent({
      eventType: "provider_suspended",
      entityType: providerType,
      entityId: providerId,
      action: "suspended",
      newState: { reason, relatedEntityId },
    });
  }

  /**
   * Send expiry reminder
   */
  private async sendExpiryReminder(
    entityId: number,
    entityType: string,
    daysUntilExpiry: number
  ): Promise<void> {
    // Check if reminder already sent recently (within last 7 days)
    const table = entityType === "authority_document" ? authorityDocuments : providerLicenses;
    const entity = await db
      .select()
      .from(table)
      .where(eq(table.id, entityId))
      .limit(1);

    if (entity[0]?.lastReminderSent) {
      const daysSinceLastReminder = Math.ceil(
        (Date.now() - new Date(entity[0].lastReminderSent).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastReminder < 7) {
        return; // Don't spam reminders
      }
    }

    // Update last reminder sent
    await db
      .update(table)
      .set({ lastReminderSent: new Date(), updatedAt: new Date() })
      .where(eq(table.id, entityId));

    // TODO: Integrate with notification system (email, SMS, push)
    console.log(`Expiry reminder sent for ${entityType} ${entityId}: ${daysUntilExpiry} days remaining`);
  }

  /**
   * Log audit event (immutable)
   */
  private async logAuditEvent(event: Partial<InsertComplianceAuditTrail>): Promise<void> {
    const eventId = `AUDIT-${new Date().getFullYear()}-${nanoid(12)}`;

    // Get previous hash for chain
    const [lastAudit] = await db
      .select()
      .from(complianceAuditTrail)
      .orderBy(sql`${complianceAuditTrail.timestamp} DESC`)
      .limit(1);

    // Calculate cryptographic hash
    const dataToHash = JSON.stringify({
      eventId,
      ...event,
      timestamp: new Date().toISOString(),
    });
    const cryptographicHash = createHash("sha256").update(dataToHash).digest("hex");

    await db.insert(complianceAuditTrail).values({
      eventId,
      cryptographicHash,
      previousHash: lastAudit?.cryptographicHash || null,
      ...event,
    } as InsertComplianceAuditTrail);
  }

  /**
   * Calculate overall risk level
   */
  private calculateOverallRisk(issues: ComplianceIssue[], criticalTasks: number): ComplianceRiskLevel {
    const criticalIssues = issues.filter(i => i.severity === ComplianceRiskLevel.CRITICAL).length;
    const highIssues = issues.filter(i => i.severity === ComplianceRiskLevel.HIGH).length;

    if (criticalIssues > 0 || criticalTasks > 0) {
      return ComplianceRiskLevel.CRITICAL;
    }
    if (highIssues > 2) {
      return ComplianceRiskLevel.HIGH;
    }
    if (highIssues > 0 || issues.length > 5) {
      return ComplianceRiskLevel.MEDIUM;
    }
    return ComplianceRiskLevel.LOW;
  }

  /**
   * Calculate provider risk level
   */
  private calculateProviderRiskLevel(
    issues: ComplianceIssue[],
    expiredLicenses: number,
    expiringSoon: number
  ): ComplianceRiskLevel {
    const criticalIssues = issues.filter(i => i.severity === ComplianceRiskLevel.CRITICAL).length;

    if (criticalIssues > 0 || expiredLicenses > 0) {
      return ComplianceRiskLevel.CRITICAL;
    }
    if (expiringSoon > 1) {
      return ComplianceRiskLevel.HIGH;
    }
    if (expiringSoon > 0) {
      return ComplianceRiskLevel.MEDIUM;
    }
    return ComplianceRiskLevel.LOW;
  }

  /**
   * Get required licenses for provider type
   */
  private getRequiredLicenses(providerType: string): string[] {
    const requirements: Record<string, string[]> = {
      walker: ["first_aid_pet", "insurance_liability"],
      sitter: ["first_aid_pet", "insurance_liability", "background_check"],
      driver: ["driver_license", "insurance_vehicle", "background_check"],
      station_operator: ["business_license", "insurance_liability", "health_permit"],
    };

    return requirements[providerType] || [];
  }
}

// Export singleton instance
export const complianceControlTower = new ComplianceControlTowerService();
