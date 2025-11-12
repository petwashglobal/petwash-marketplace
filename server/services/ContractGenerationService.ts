import { db } from '../db';
import {
  contractTemplates,
  generatedContracts,
  legalEntities,
  type InsertContractTemplate,
  type InsertGeneratedContract,
  type ContractTemplate,
  type GeneratedContract
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

export class ContractGenerationService {
  private templatesCache: Map<string, string> = new Map();

  async loadTemplate(templateId: string): Promise<string> {
    if (this.templatesCache.has(templateId)) {
      return this.templatesCache.get(templateId)!;
    }

    const template = await db
      .select()
      .from(contractTemplates)
      .where(and(
        eq(contractTemplates.templateId, templateId),
        eq(contractTemplates.isActive, true)
      ))
      .limit(1)
      .then(rows => rows[0]);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    this.templatesCache.set(templateId, template.templateContent);
    return template.templateContent;
  }

  async loadTemplateFromFile(filename: string): Promise<string> {
    const templatesDir = path.join(process.cwd(), 'server', 'templates', 'contracts');
    const filePath = path.join(templatesDir, filename);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to load template file: ${filename}`);
    }
  }

  substituteVariables(template: string, variables: Record<string, any>): string {
    let result = template;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value?.toString() || '');
    });

    const conditionalBlockRegex = /{{#if_([^}]+)}}([\s\S]*?){{\/if_\1}}/g;
    result = result.replace(conditionalBlockRegex, (match, condition, content) => {
      const conditionValue = variables[condition];
      return conditionValue ? content : '';
    });

    const notConditionalRegex = /{{#if_not_([^}]+)}}([\s\S]*?){{\/if_not_\1}}/g;
    result = result.replace(notConditionalRegex, (match, condition, content) => {
      const conditionValue = variables[condition];
      return !conditionValue ? content : '';
    });

    return result;
  }

  async generateContract(data: {
    templateId: string;
    entityId?: number;
    contractType: string;
    partyAName: string;
    partyARole?: string;
    partyBName: string;
    partyBRole: string;
    partyBEmail?: string;
    variablesData: Record<string, any>;
    effectiveDate: string;
    expiryDate?: string;
  }): Promise<GeneratedContract> {
    const template = await db
      .select()
      .from(contractTemplates)
      .where(eq(contractTemplates.templateId, data.templateId))
      .limit(1)
      .then(rows => rows[0]);

    if (!template) {
      throw new Error(`Template not found: ${data.templateId}`);
    }

    const templateContent = template.templateContent;
    const generatedContent = this.substituteVariables(templateContent, {
      ...data.variablesData,
      legal_entity_name: data.partyAName,
      signature_date: new Date().toISOString().split('T')[0],
      contract_date: new Date().toISOString().split('T')[0],
    });

    const contractNumber = await this.generateContractNumber(data.contractType);

    const contractData: InsertGeneratedContract = {
      contractNumber,
      templateId: template.id,
      entityId: data.entityId,
      contractType: data.contractType,
      partyAName: data.partyAName,
      partyARole: data.partyARole || 'employer',
      partyBName: data.partyBName,
      partyBRole: data.partyBRole,
      partyBEmail: data.partyBEmail,
      variablesData: data.variablesData,
      generatedContent,
      effectiveDate: new Date(data.effectiveDate),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      signatureStatus: 'pending',
    };

    const [contract] = await db
      .insert(generatedContracts)
      .values(contractData)
      .returning();

    await db
      .update(contractTemplates)
      .set({ usageCount: (template.usageCount || 0) + 1 })
      .where(eq(contractTemplates.id, template.id));

    return contract;
  }

  private async generateContractNumber(contractType: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = contractType.toUpperCase().substring(0, 3);

    const lastContract = await db
      .select()
      .from(generatedContracts)
      .where(eq(generatedContracts.contractType, contractType))
      .orderBy(desc(generatedContracts.id))
      .limit(1)
      .then(rows => rows[0]);

    let sequence = 1;
    if (lastContract) {
      const lastNumber = parseInt(lastContract.contractNumber.split('-').pop() || '0');
      sequence = lastNumber + 1;
    }

    return `CONT-${prefix}-${year}-${sequence.toString().padStart(5, '0')}`;
  }

  async generateOfferLetter(data: {
    entityId?: number;
    employeeName: string;
    employeeEmail: string;
    jobTitle: string;
    department: string;
    salary: number;
    salaryCurrency: string;
    startDate: string;
    managerName: string;
    location: string;
    country: string;
  }): Promise<GeneratedContract> {
    let templateId = 'TMPL-EMP-FT-001';
    if (data.country === 'US') templateId = 'TMPL-EMP-FT-US-001';
    else if (data.country === 'CA') templateId = 'TMPL-EMP-FT-CA-001';
    else if (data.country === 'UK') templateId = 'TMPL-EMP-FT-UK-001';
    else if (data.country === 'AU') templateId = 'TMPL-EMP-FT-AU-001';

    const entity = data.entityId 
      ? await db.select().from(legalEntities).where(eq(legalEntities.id, data.entityId)).limit(1).then(r => r[0])
      : null;

    const variablesData = {
      employee_name: data.employeeName,
      employee_address: 'To be provided',
      employee_id_number: 'To be provided',
      job_title: data.jobTitle,
      department: data.department,
      annual_salary: data.salary.toString(),
      currency_symbol: data.salaryCurrency === 'ILS' ? '₪' : data.salaryCurrency,
      start_date: data.startDate,
      manager_name: data.managerName,
      manager_title: 'Department Manager',
      work_location: data.location,
      legal_entity_name: entity?.legalName || 'Pet Wash™ Ltd',
      company_registration_number: entity?.registrationNumber || 'TBD',
      company_address: entity?.businessAddress || 'TBD',
      probation_period_days: '90',
      probation_notice_days: '7',
      payment_frequency: 'Monthly',
      bonus_percent: '10',
      commission_structure: 'N/A',
      weekly_hours: '40',
      work_schedule: 'Monday - Friday, 9 AM - 6 PM',
      annual_leave_days: '22',
      paid_holidays: '10',
      pension_contribution: '6',
      study_fund_contribution: '2.5',
      health_insurance_details: 'Company-provided health insurance',
      additional_benefits: 'Meal vouchers, gym membership',
      remote_work_policy: 'Hybrid (3 days office, 2 days remote)',
      non_compete_months: '6',
      notice_period_days: '30',
      authorized_signatory_name: 'Nir Hadad',
      authorized_signatory_title: 'CEO',
      country,
    };

    return this.generateContract({
      templateId,
      entityId: data.entityId,
      contractType: 'employment',
      partyAName: entity?.legalName || 'Pet Wash™ Ltd',
      partyARole: 'employer',
      partyBName: data.employeeName,
      partyBRole: 'employee',
      partyBEmail: data.employeeEmail,
      variablesData,
      effectiveDate: data.startDate,
    });
  }

  async generateContractorAgreement(data: {
    entityId?: number;
    contractorName: string;
    contractorEmail: string;
    contractorId: string;
    contractorType: 'walker' | 'sitter' | 'driver' | 'trainer';
    country: string;
    serviceAreas: string[];
    baseRate: number;
    currency: string;
  }): Promise<GeneratedContract> {
    let templateFile = 'contractor-walker-agreement.md';
    if (data.contractorType === 'sitter') templateFile = 'contractor-sitter-agreement.md';

    const templateContent = await this.loadTemplateFromFile(templateFile);

    const platformFee = data.contractorType === 'walker' ? 24 : 10;
    const clientFee = data.contractorType === 'walker' ? 6 : 10;
    const contractorFee = data.contractorType === 'walker' ? 18 : 0;

    const variablesData = {
      contractor_name: data.contractorName,
      contractor_id: data.contractorId,
      contractor_address: 'To be provided',
      legal_entity_name: 'Pet Wash™ Ltd',
      company_registration_number: 'TBD',
      company_address: 'TBD',
      contract_date: new Date().toISOString().split('T')[0],
      service_areas: data.serviceAreas.join(', '),
      service_types: 'Standard walk, Extended walk, Emergency walk',
      max_concurrent_bookings: '5',
      base_rate_per_walk: data.baseRate.toString(),
      extended_rate: (data.baseRate * 1.5).toString(),
      emergency_rate: (data.baseRate * 2).toString(),
      platform_fee_percentage: platformFee.toString(),
      platform_fee_split: `${clientFee}% client + ${contractorFee}% contractor`,
      client_platform_fee: clientFee.toString(),
      walker_platform_fee: contractorFee.toString(),
      payment_cycle: 'Weekly',
      payment_method: 'Bank transfer',
      tax_forms: this.getTaxFormsForCountry(data.country),
      insurance_minimum: '₪1,000,000',
      max_dogs_per_walk: '3',
      cancellation_penalty: '₪50',
      late_policy: 'Fee applies after 15 minutes',
      minimum_rating: '4.5',
      max_response_time: '2',
      minimum_trust_score: '80',
      background_check_provider: 'Checkr',
      reference_count: '3',
      initial_term_months: '12',
      auto_renewal: 'Yes',
      termination_notice_days: '30',
      country: data.country,
      country_upper: data.country.toUpperCase(),
      contractor_classification: this.getContractorClassification(data.country),
      jurisdiction_country: data.country,
      dispute_resolution_method: 'Arbitration',
      authorized_signatory_name: 'Nir Hadad',
      authorized_signatory_title: 'CEO',
      signature_date: new Date().toISOString().split('T')[0],
    };

    const contractNumber = await this.generateContractNumber(data.contractorType);

    const [contract] = await db
      .insert(generatedContracts)
      .values({
        contractNumber,
        templateId: null,
        entityId: data.entityId,
        contractType: data.contractorType,
        partyAName: 'Pet Wash™ Ltd',
        partyARole: 'platform',
        partyBName: data.contractorName,
        partyBRole: 'contractor',
        partyBEmail: data.contractorEmail,
        variablesData,
        generatedContent: this.substituteVariables(templateContent, variablesData),
        effectiveDate: new Date(),
        signatureStatus: 'pending',
      })
      .returning();

    return contract;
  }

  private getTaxFormsForCountry(country: string): string {
    const taxForms: Record<string, string> = {
      US: 'W-9, Form 1099-NEC',
      CA: 'Business Number, T4A',
      UK: 'UTR, Self-Assessment',
      AU: 'ABN, Payment Summary',
      IL: 'Form 101/102, Osek Mursheh',
    };
    return taxForms[country] || 'As required by local law';
  }

  private getContractorClassification(country: string): string {
    const classifications: Record<string, string> = {
      US: 'Independent Contractor (IRS ABC Test)',
      CA: 'Independent Contractor (CRA Guidelines)',
      UK: 'Self-Employed (Outside IR35)',
      AU: 'Independent Contractor (Fair Work Guidelines)',
      IL: 'Independent Contractor (Osek Patur/Mursheh)',
    };
    return classifications[country] || 'Independent Contractor';
  }

  async sendForSignature(contractId: number, docusealApiKey?: string): Promise<{ submissionId: string; signUrl: string }> {
    const contract = await db
      .select()
      .from(generatedContracts)
      .where(eq(generatedContracts.id, contractId))
      .limit(1)
      .then(rows => rows[0]);

    if (!contract) {
      throw new Error('Contract not found');
    }

    if (!docusealApiKey) {
      return {
        submissionId: 'DEMO-' + Date.now(),
        signUrl: '/api/enterprise/contracts/demo-sign/' + contractId,
      };
    }

    return {
      submissionId: 'PENDING-INTEGRATION',
      signUrl: '/api/enterprise/contracts/sign/' + contractId,
    };
  }

  async getContract(contractId: number): Promise<GeneratedContract | null> {
    const [contract] = await db
      .select()
      .from(generatedContracts)
      .where(eq(generatedContracts.id, contractId))
      .limit(1);

    return contract || null;
  }

  async listContracts(filters?: {
    contractType?: string;
    signatureStatus?: string;
    partyBEmail?: string;
    limit?: number;
  }): Promise<GeneratedContract[]> {
    const conditions = [];

    if (filters?.contractType) {
      conditions.push(eq(generatedContracts.contractType, filters.contractType));
    }

    if (filters?.signatureStatus) {
      conditions.push(eq(generatedContracts.signatureStatus, filters.signatureStatus));
    }

    if (filters?.partyBEmail) {
      conditions.push(eq(generatedContracts.partyBEmail, filters.partyBEmail));
    }

    const query = db
      .select()
      .from(generatedContracts)
      .orderBy(desc(generatedContracts.createdAt));

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    if (filters?.limit) {
      query.limit(filters.limit);
    }

    return query;
  }
}

export const contractGenerationService = new ContractGenerationService();
