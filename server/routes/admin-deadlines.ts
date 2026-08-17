// =============================================================================
// Admin Deadlines & Insurance — READ-ONLY governance module
// =============================================================================
// Legal-Deadline Reminder Engine (§13) + Insurance/Utilities Dashboard
// (§19 + §17-utilities) from the CEO Business OS spec.
//
// PURE SELECT. No mutations, no schema changes, no new dependencies.
//
// Auth: validateFirebaseToken (populates req.firebaseUser) + inline
// requireAdmin (super-admin email check via rbac.isSuperAdmin). Mounted at
// /api/admin so the live routes are:
//   GET /api/admin/deadlines         — unified upcoming-deadline feed
//   GET /api/admin/insurance-status  — insurance decision dashboard
//
// HONESTY RULE: every deadline source has its own try/catch and is reported
// as queried-or-not. Insurance status NEVER claims "fully insured" — it only
// reports the factual coverage areas that exist in the data, and explicitly
// marks coverage areas that have NO backing table as "not tracked".
//
// Real tables this module reads (verified in shared/schema*.ts):
//   - station_bills (schema-enterprise.ts)        → utilities/rent/insurance/maintenance bills (dueDate)
//   - station_assets (schema-enterprise.ts)       → equipment warranty + next inspection (warrantyExpiryDate, nextInspectionDate)
//   - pet_wash_stations (schema-enterprise.ts)    → station hardware warranty + next maintenance (warrantyExpiryDate, nextMaintenanceDate)
//   - supplier_contracts (schema-corporate.ts)    → supplier contract expiry (endDate)
//   - compliance_certifications (schema-policy.ts)→ employee certification expiry (expiryDate)
//   - policy_documents (schema-policy.ts)         → policy document expiry (expiryDate)
//   - provider_insurance_documents (schema.ts)    → provider insurance docs (expiresAt)
//   - contractor_insurance (schema.ts)            → contractor insurance renewals (validUntil)
//
// Coverage areas with NO backing table (reported "not tracked yet"):
//   - Company-level liability/property insurance (CEO's own commercial policies — no table)
//   - Public-liability insurance per station (no station-insurance table; only billed via station_bills billType='insurance')
//   - Equipment insurance as a policy (only warranty dates exist, not an insurance policy)
// =============================================================================

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { isSuperAdmin, isSuperAdminVerified } from '../middleware/rbac';
import {
  stationBills,
  stationAssets,
  petWashStations,
} from '@shared/schema-enterprise';
import { supplierContracts, suppliers } from '@shared/schema-corporate';
import { complianceCertifications, policyDocuments } from '@shared/schema-policy';
import { providerInsuranceDocuments, contractorInsurance } from '@shared/schema';
import { eq, and, isNotNull, ne, sql } from 'drizzle-orm';

const router = Router();

// ---- Auth: token first, then super-admin email check -----------------------
router.use(validateFirebaseToken);
function requireAdmin(req: any, res: Response, next: any) {
  // Canonical super-admin gate: SUPER_ADMIN_EMAILS allowlist AND
  // Firebase-verified email. isSuperAdminVerified enforces both;
  // the plain isSuperAdmin(email) primitive is deprecated for gates.
  if (!isSuperAdminVerified(req)) {
return res.status(403).json({ error: 'Full admin access required' });
  
  }
  next();
}
router.use(requireAdmin);

// ---- Severity buckets per the spec's 60/30/14/7 schedule -------------------
// ≤7 critical, ≤14 high, ≤30 medium, ≤60 low. Past-due is "critical".
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

function severityFor(daysUntilValue: number): Severity {
  if (daysUntilValue <= 7) return 'critical';   // includes overdue (negative)
  if (daysUntilValue <= 14) return 'high';
  if (daysUntilValue <= 30) return 'medium';
  if (daysUntilValue <= 60) return 'low';
  return 'info';
}

function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

const HORIZON_DAYS = 90; // look-ahead window; also surfaces overdue (negative)

interface Deadline {
  type: string;
  label: string;
  entity: string;
  dueDate: string;        // ISO yyyy-mm-dd
  daysUntil: number;
  severity: Severity;
}

function toIso(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

// ===========================================================================
// GET /api/admin/deadlines — unified upcoming-deadline feed
// ===========================================================================
router.get('/deadlines', async (_req: Request, res: Response) => {
  const deadlines: Deadline[] = [];
  const sources: Array<{ source: string; ok: boolean; count: number; reason?: string }> = [];

  const within = (n: number | null): n is number => n !== null && n <= HORIZON_DAYS;

  // --- 1. Station bills (utilities / rent / insurance / maintenance) ---------
  try {
    const rows = await db
      .select({
        id: stationBills.id,
        billType: stationBills.billType,
        vendor: stationBills.vendor,
        dueDate: stationBills.dueDate,
        status: stationBills.status,
        stationName: petWashStations.stationName,
        totalAmount: stationBills.totalAmount,
        currency: stationBills.currency,
      })
      .from(stationBills)
      .leftJoin(petWashStations, eq(stationBills.stationId, petWashStations.id))
      .where(and(isNotNull(stationBills.dueDate), ne(stationBills.status, 'paid')));
    let count = 0;
    for (const r of rows) {
      const du = daysUntil(r.dueDate);
      if (!within(du)) continue;
      const amt = r.totalAmount ? ` (${r.currency || 'ILS'} ${r.totalAmount})` : '';
      deadlines.push({
        type: `station_bill_${r.billType}`,
        label: `${r.billType} bill due — ${r.vendor}${amt}`,
        entity: r.stationName || `Station #${r.id}`,
        dueDate: toIso(r.dueDate!),
        daysUntil: du,
        severity: severityFor(du),
      });
      count++;
    }
    sources.push({ source: 'station_bills', ok: true, count });
  } catch (e: any) {
    sources.push({ source: 'station_bills', ok: false, count: 0, reason: e?.message || 'query failed' });
  }

  // --- 2. Station equipment warranty + next inspection ----------------------
  try {
    const rows = await db
      .select({
        id: stationAssets.id,
        assetName: stationAssets.assetName,
        warrantyExpiryDate: stationAssets.warrantyExpiryDate,
        nextInspectionDate: stationAssets.nextInspectionDate,
        stationName: petWashStations.stationName,
        status: stationAssets.status,
      })
      .from(stationAssets)
      .leftJoin(petWashStations, eq(stationAssets.stationId, petWashStations.id))
      .where(ne(stationAssets.status, 'disposed'));
    let count = 0;
    for (const r of rows) {
      const entity = r.stationName ? `${r.stationName} — ${r.assetName}` : r.assetName;
      const duW = daysUntil(r.warrantyExpiryDate);
      if (within(duW)) {
        deadlines.push({
          type: 'equipment_warranty',
          label: `Equipment warranty expiry — ${r.assetName}`,
          entity,
          dueDate: toIso(r.warrantyExpiryDate!),
          daysUntil: duW,
          severity: severityFor(duW),
        });
        count++;
      }
      const duI = daysUntil(r.nextInspectionDate);
      if (within(duI)) {
        deadlines.push({
          type: 'equipment_inspection',
          label: `Equipment inspection due — ${r.assetName}`,
          entity,
          dueDate: toIso(r.nextInspectionDate!),
          daysUntil: duI,
          severity: severityFor(duI),
        });
        count++;
      }
    }
    sources.push({ source: 'station_assets', ok: true, count });
  } catch (e: any) {
    sources.push({ source: 'station_assets', ok: false, count: 0, reason: e?.message || 'query failed' });
  }

  // --- 3. Station hardware warranty + next maintenance ----------------------
  try {
    const rows = await db
      .select({
        id: petWashStations.id,
        stationName: petWashStations.stationName,
        warrantyExpiryDate: petWashStations.warrantyExpiryDate,
        nextMaintenanceDate: petWashStations.nextMaintenanceDate,
      })
      .from(petWashStations);
    let count = 0;
    for (const r of rows) {
      const duW = daysUntil(r.warrantyExpiryDate);
      if (within(duW)) {
        deadlines.push({
          type: 'station_warranty',
          label: 'Station hardware warranty expiry',
          entity: r.stationName,
          dueDate: toIso(r.warrantyExpiryDate!),
          daysUntil: duW,
          severity: severityFor(duW),
        });
        count++;
      }
      const duM = daysUntil(r.nextMaintenanceDate);
      if (within(duM)) {
        deadlines.push({
          type: 'station_maintenance',
          label: 'Station scheduled maintenance due',
          entity: r.stationName,
          dueDate: toIso(r.nextMaintenanceDate!),
          daysUntil: duM,
          severity: severityFor(duM),
        });
        count++;
      }
    }
    sources.push({ source: 'pet_wash_stations', ok: true, count });
  } catch (e: any) {
    sources.push({ source: 'pet_wash_stations', ok: false, count: 0, reason: e?.message || 'query failed' });
  }

  // --- 4. Supplier contract expiry + renewal confirmation -------------------
  try {
    const rows = await db
      .select({
        id: supplierContracts.id,
        title: supplierContracts.title,
        contractNumber: supplierContracts.contractNumber,
        endDate: supplierContracts.endDate,
        autoRenewal: supplierContracts.autoRenewal,
        status: supplierContracts.status,
        supplierName: suppliers.companyName,
      })
      .from(supplierContracts)
      .leftJoin(suppliers, eq(supplierContracts.supplierId, suppliers.id))
      .where(and(isNotNull(supplierContracts.endDate), eq(supplierContracts.status, 'active')));
    let count = 0;
    for (const r of rows) {
      const du = daysUntil(r.endDate);
      if (!within(du)) continue;
      deadlines.push({
        type: r.autoRenewal ? 'supplier_contract_renewal' : 'supplier_contract_expiry',
        label: r.autoRenewal
          ? `Supplier contract auto-renews — ${r.title} (confirm terms)`
          : `Supplier contract expiry — ${r.title}`,
        entity: r.supplierName || r.contractNumber,
        dueDate: toIso(r.endDate!),
        daysUntil: du,
        severity: severityFor(du),
      });
      count++;
    }
    sources.push({ source: 'supplier_contracts', ok: true, count });
  } catch (e: any) {
    sources.push({ source: 'supplier_contracts', ok: false, count: 0, reason: e?.message || 'query failed' });
  }

  // --- 5. Compliance certification expiry -----------------------------------
  try {
    const rows = await db
      .select({
        id: complianceCertifications.id,
        certificationType: complianceCertifications.certificationType,
        issuedBy: complianceCertifications.issuedBy,
        expiryDate: complianceCertifications.expiryDate,
        status: complianceCertifications.status,
        employeeId: complianceCertifications.employeeId,
      })
      .from(complianceCertifications)
      .where(eq(complianceCertifications.status, 'active'));
    let count = 0;
    for (const r of rows) {
      const du = daysUntil(r.expiryDate);
      if (!within(du)) continue;
      deadlines.push({
        type: 'certification_expiry',
        label: `Certification expiry — ${r.certificationType} (${r.issuedBy})`,
        entity: `Employee #${r.employeeId}`,
        dueDate: toIso(r.expiryDate!),
        daysUntil: du,
        severity: severityFor(du),
      });
      count++;
    }
    sources.push({ source: 'compliance_certifications', ok: true, count });
  } catch (e: any) {
    sources.push({ source: 'compliance_certifications', ok: false, count: 0, reason: e?.message || 'query failed' });
  }

  // --- 6. Policy document expiry --------------------------------------------
  try {
    const rows = await db
      .select({
        id: policyDocuments.id,
        title: policyDocuments.title,
        category: policyDocuments.category,
        expiryDate: policyDocuments.expiryDate,
        isActive: policyDocuments.isActive,
      })
      .from(policyDocuments)
      .where(and(isNotNull(policyDocuments.expiryDate), eq(policyDocuments.isActive, true)));
    let count = 0;
    for (const r of rows) {
      const du = daysUntil(r.expiryDate);
      if (!within(du)) continue;
      deadlines.push({
        type: 'policy_document_expiry',
        label: `Policy document expiry — ${r.title} (${r.category})`,
        entity: r.title,
        dueDate: toIso(r.expiryDate!),
        daysUntil: du,
        severity: severityFor(du),
      });
      count++;
    }
    sources.push({ source: 'policy_documents', ok: true, count });
  } catch (e: any) {
    sources.push({ source: 'policy_documents', ok: false, count: 0, reason: e?.message || 'query failed' });
  }

  // --- 7. Provider insurance document expiry --------------------------------
  try {
    const rows = await db
      .select({
        id: providerInsuranceDocuments.id,
        providerId: providerInsuranceDocuments.providerId,
        docType: providerInsuranceDocuments.docType,
        insurer: providerInsuranceDocuments.insurer,
        expiresAt: providerInsuranceDocuments.expiresAt,
        status: providerInsuranceDocuments.status,
      })
      .from(providerInsuranceDocuments)
      .where(and(isNotNull(providerInsuranceDocuments.expiresAt), eq(providerInsuranceDocuments.status, 'active')));
    let count = 0;
    for (const r of rows) {
      const du = daysUntil(r.expiresAt);
      if (!within(du)) continue;
      deadlines.push({
        type: 'provider_insurance_expiry',
        label: `Provider insurance expiry — ${r.docType}${r.insurer ? ` (${r.insurer})` : ''}`,
        entity: `Provider ${r.providerId}`,
        dueDate: toIso(r.expiresAt!),
        daysUntil: du,
        severity: severityFor(du),
      });
      count++;
    }
    sources.push({ source: 'provider_insurance_documents', ok: true, count });
  } catch (e: any) {
    sources.push({ source: 'provider_insurance_documents', ok: false, count: 0, reason: e?.message || 'query failed' });
  }

  // --- 8. Contractor insurance renewal --------------------------------------
  try {
    const rows = await db
      .select({
        id: contractorInsurance.id,
        contractorId: contractorInsurance.contractorId,
        providerName: contractorInsurance.providerName,
        validUntil: contractorInsurance.validUntil,
      })
      .from(contractorInsurance)
      .where(isNotNull(contractorInsurance.validUntil));
    let count = 0;
    for (const r of rows) {
      const du = daysUntil(r.validUntil);
      if (!within(du)) continue;
      deadlines.push({
        type: 'contractor_insurance_renewal',
        label: `Contractor insurance renewal${r.providerName ? ` — ${r.providerName}` : ''}`,
        entity: `Contractor ${r.contractorId}`,
        dueDate: toIso(r.validUntil!),
        daysUntil: du,
        severity: severityFor(du),
      });
      count++;
    }
    sources.push({ source: 'contractor_insurance', ok: true, count });
  } catch (e: any) {
    sources.push({ source: 'contractor_insurance', ok: false, count: 0, reason: e?.message || 'query failed' });
  }

  // Sort soonest-first (overdue first, then by daysUntil ascending).
  deadlines.sort((a, b) => a.daysUntil - b.daysUntil);

  // Honest list of deadline categories the spec wants but we do NOT track.
  const notTracked = [
    'Company-level annual legal/regulatory filings (no dedicated deadlines table)',
    'Business operating license / municipal permit renewals (no permit table)',
    'Domain / SSL / trademark renewals (not modelled in DB)',
  ];

  res.json({
    generatedAt: new Date().toISOString(),
    horizonDays: HORIZON_DAYS,
    schedule: { critical: '<=7d', high: '<=14d', medium: '<=30d', low: '<=60d' },
    total: deadlines.length,
    deadlines,
    sources,         // which sources were queried successfully + counts
    notTracked,      // honest list of what is NOT tracked yet
  });
});

// ===========================================================================
// GET /api/admin/insurance-status — insurance decision dashboard
// ===========================================================================
router.get('/insurance-status', async (_req: Request, res: Response) => {
  const policies: Array<{
    insurer: string | null;
    type: string;
    coveredEntity: string;
    startDate: string | null;
    endDate: string | null;
    renewalDaysUntil: number | null;
    status: 'active' | 'expiring' | 'expired' | 'unknown';
    documentPresent: boolean;
    source: string;
  }> = [];
  const sources: Array<{ source: string; ok: boolean; count: number; reason?: string }> = [];

  const statusFor = (du: number | null): 'active' | 'expiring' | 'expired' | 'unknown' => {
    if (du === null) return 'unknown';
    if (du < 0) return 'expired';
    if (du <= 30) return 'expiring';
    return 'active';
  };

  // --- Provider insurance documents -----------------------------------------
  try {
    const rows = await db
      .select({
        providerId: providerInsuranceDocuments.providerId,
        docType: providerInsuranceDocuments.docType,
        insurer: providerInsuranceDocuments.insurer,
        issuedAt: providerInsuranceDocuments.issuedAt,
        expiresAt: providerInsuranceDocuments.expiresAt,
        status: providerInsuranceDocuments.status,
        fileRef: providerInsuranceDocuments.fileRef,
      })
      .from(providerInsuranceDocuments);
    for (const r of rows) {
      const du = daysUntil(r.expiresAt);
      policies.push({
        insurer: r.insurer,
        type: r.docType,
        coveredEntity: `Provider ${r.providerId}`,
        startDate: r.issuedAt ? toIso(r.issuedAt) : null,
        endDate: r.expiresAt ? toIso(r.expiresAt) : null,
        renewalDaysUntil: du,
        status: r.status === 'expired' ? 'expired' : statusFor(du),
        documentPresent: !!r.fileRef,
        source: 'provider_insurance_documents',
      });
    }
    sources.push({ source: 'provider_insurance_documents', ok: true, count: rows.length });
  } catch (e: any) {
    sources.push({ source: 'provider_insurance_documents', ok: false, count: 0, reason: e?.message || 'query failed' });
  }

  // --- Contractor insurance --------------------------------------------------
  try {
    const rows = await db
      .select({
        contractorId: contractorInsurance.contractorId,
        providerName: contractorInsurance.providerName,
        policyNumber: contractorInsurance.policyNumber,
        validFrom: contractorInsurance.validFrom,
        validUntil: contractorInsurance.validUntil,
        documentId: contractorInsurance.documentId,
        coversThirdParty: contractorInsurance.coversThirdParty,
        coversProfessionalLiability: contractorInsurance.coversProfessionalLiability,
        coversAnimalsUnderCare: contractorInsurance.coversAnimalsUnderCare,
      })
      .from(contractorInsurance);
    for (const r of rows) {
      const du = daysUntil(r.validUntil);
      const covers = [
        r.coversThirdParty ? 'third-party' : null,
        r.coversProfessionalLiability ? 'professional-liability' : null,
        r.coversAnimalsUnderCare ? 'animals-under-care' : null,
      ].filter(Boolean).join(', ');
      policies.push({
        insurer: r.providerName,
        type: `contractor_liability${covers ? ` (${covers})` : ''}`,
        coveredEntity: `Contractor ${r.contractorId}`,
        startDate: r.validFrom ? toIso(r.validFrom) : null,
        endDate: r.validUntil ? toIso(r.validUntil) : null,
        renewalDaysUntil: du,
        status: statusFor(du),
        documentPresent: !!r.documentId,
        source: 'contractor_insurance',
      });
    }
    sources.push({ source: 'contractor_insurance', ok: true, count: rows.length });
  } catch (e: any) {
    sources.push({ source: 'contractor_insurance', ok: false, count: 0, reason: e?.message || 'query failed' });
  }

  // --- Station-level insurance billed via station_bills (billType=insurance) -
  // This proves an insurance bill exists/is paid — it is NOT proof of an
  // active policy. Reported as a supporting signal only.
  let stationInsuranceBillCount = 0;
  try {
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(stationBills)
      .where(eq(stationBills.billType, 'insurance'));
    stationInsuranceBillCount = rows[0]?.c ?? 0;
    sources.push({ source: 'station_bills(insurance)', ok: true, count: stationInsuranceBillCount });
  } catch (e: any) {
    sources.push({ source: 'station_bills(insurance)', ok: false, count: 0, reason: e?.message || 'query failed' });
  }

  // Summarise policies.
  const summary = {
    total: policies.length,
    active: policies.filter(p => p.status === 'active').length,
    expiring: policies.filter(p => p.status === 'expiring').length,
    expired: policies.filter(p => p.status === 'expired').length,
    unknown: policies.filter(p => p.status === 'unknown').length,
    missingDocument: policies.filter(p => !p.documentPresent).length,
  };

  // HONEST coverage-area map — only what the DB can actually back.
  // NEVER claim "fully insured". Each area declares tracked:true/false.
  const coverageAreas = [
    {
      area: 'Provider liability / professional indemnity',
      tracked: true,
      backedBy: 'provider_insurance_documents',
      note: 'Per-provider documents with insurer + expiry; status from data.',
    },
    {
      area: 'Contractor liability (third-party / professional / animals-under-care)',
      tracked: true,
      backedBy: 'contractor_insurance',
      note: 'Per-contractor policies with validity window + coverage flags.',
    },
    {
      area: 'Company-level commercial / property insurance',
      tracked: false,
      backedBy: null,
      note: 'No dedicated company-insurance table. CEO holds these policies externally — NOT verifiable from this system.',
    },
    {
      area: 'Public-liability insurance per station',
      tracked: false,
      backedBy: 'station_bills (insurance bills only)',
      note: `Only ${stationInsuranceBillCount} insurance BILL record(s) exist; a paid bill is not proof of an active policy. No station-policy table.`,
    },
    {
      area: 'Equipment / hardware insurance',
      tracked: false,
      backedBy: 'station_assets (warranty only)',
      note: 'Only warranty dates are stored, not an insurance policy. Equipment insurance is NOT tracked.',
    },
  ];

  res.json({
    generatedAt: new Date().toISOString(),
    disclaimer:
      'This dashboard reports ONLY insurance records present in the database. ' +
      'Absence of a record does not mean a risk is uninsured, and presence does not certify adequate coverage. ' +
      'This is NOT a statement that the company is fully insured.',
    summary,
    policies,
    coverageAreas,
    sources,
  });
});

export default router;
