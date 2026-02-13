import { storage } from '../storage';
import { domainEvents } from '@shared/schema';
import { db } from '../db';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

export type PlatformService = 'wash' | 'sitter' | 'walk' | 'trek' | 'all';

export interface GiftCardConfig {
  value: number;
  currency: string;
  purchaserEmail: string;
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  message?: string;
  eligibleServices: PlatformService[];
  expiresInMonths?: number;
}

export interface RevenueDistribution {
  service: PlatformService;
  percentage: number;
  amount: number;
  department: string;
}

export interface DistributionReport {
  giftCardId: string;
  totalValue: number;
  distributions: RevenueDistribution[];
  aiReasoning?: string;
  generatedAt: Date;
  digitalStamp: string;
}

const SERVICE_DEPARTMENTS: Record<PlatformService, string> = {
  wash: 'K9000 Operations',
  sitter: '⁦Sitter Suite™⁩ Division',
  walk: '⁦Walk My Pet™⁩ Division', 
  trek: '⁦PetTrek™⁩ Logistics',
  all: 'Central Treasury'
};

const DEFAULT_DISTRIBUTION: Record<PlatformService, number> = {
  wash: 40,
  sitter: 25,
  walk: 20,
  trek: 15,
  all: 0
};

export class GiftOrchestrationService {
  private genAI: GoogleGenerativeAI | null = null;
  
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async createMultiServiceGiftCard(config: GiftCardConfig): Promise<{
    giftCardId: string;
    publicCode: string;
    qrCodeData: string;
  }> {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + (config.expiresInMonths || 24));

    const result = await storage.createVoucher({
      type: 'STORED_VALUE',
      currency: config.currency,
      amount: config.value.toString(),
      purchaserEmail: config.purchaserEmail,
      recipientEmail: config.recipientEmail,
      expiresAt,
      eligibleServices: config.eligibleServices
    });

    await this.emitDomainEvent('gift.issued', {
      giftCardId: result.voucherId,
      value: config.value,
      currency: config.currency,
      eligibleServices: config.eligibleServices,
      recipientEmail: config.recipientEmail,
      recipientName: config.recipientName,
      senderName: config.senderName,
      message: config.message
    });

    return {
      giftCardId: result.voucherId,
      publicCode: result.codePlain,
      qrCodeData: JSON.stringify({
        type: 'petwash_gift',
        id: result.voucherId,
        code: result.codePlain,
        value: config.value,
        services: config.eligibleServices
      })
    };
  }

  async redeemGiftCard(
    giftCardId: string,
    amount: number,
    service: PlatformService,
    ownerUid: string,
    locationId?: string
  ): Promise<{
    success: boolean;
    remainingBalance: number;
    redemptionId: string;
  }> {
    const redemptionId = `RDM-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const result = await storage.redeemVoucher({
      voucherId: giftCardId,
      amount: amount.toString(),
      ownerUid,
      nayaxSessionId: redemptionId,
      locationId
    });

    if (!result.success) {
      throw new Error(result.error || 'Redemption failed');
    }

    await this.emitDomainEvent('gift.redeemed', {
      giftCardId,
      redemptionId,
      service,
      amount,
      remainingBalance: parseFloat(result.remainingAmount || '0'),
      locationId
    });

    return {
      success: true,
      remainingBalance: parseFloat(result.remainingAmount || '0'),
      redemptionId
    };
  }

  async generateAIDistributionReport(
    giftCardId: string,
    redemptionHistory: { service: PlatformService; amount: number }[]
  ): Promise<DistributionReport> {
    const totalValue = redemptionHistory.reduce((sum, r) => sum + r.amount, 0);
    let distributions: RevenueDistribution[] = [];
    let aiReasoning = '';

    if (this.genAI && redemptionHistory.length > 0) {
      try {
        const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        
        const prompt = `Analyze this PetWash gift card redemption data and recommend fair revenue distribution:

Gift Card ID: ${giftCardId}
Total Redeemed: ₪${totalValue}

Redemption History:
${redemptionHistory.map(r => `- ${r.service}: ₪${r.amount}`).join('\n')}

Service Departments:
- wash (K9000 Operations): Self-service pet wash stations
- sitter (⁦Sitter Suite™⁩): Premium pet sitting services
- walk (⁦Walk My Pet™⁩): Professional dog walking
- trek (⁦PetTrek™⁩): Pet transport/adventure

Based on actual usage, recommend percentage split. Consider:
1. Actual redemption amounts per service
2. Operational costs (wash has higher equipment costs)
3. Labor intensity (sitting/walking are labor-intensive)
4. Platform fees (5% central treasury)

Return ONLY valid JSON: {"distributions": [{"service": "wash", "percentage": 40}, ...], "reasoning": "brief explanation"}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiReasoning = parsed.reasoning || '';
          
          distributions = (parsed.distributions || []).map((d: any) => ({
            service: d.service as PlatformService,
            percentage: d.percentage,
            amount: Math.round((d.percentage / 100) * totalValue * 100) / 100,
            department: SERVICE_DEPARTMENTS[d.service as PlatformService] || 'Unknown'
          }));
        }
      } catch (error) {
        console.error('[AI Distribution] Falling back to default distribution:', error);
      }
    }

    if (distributions.length === 0) {
      const serviceUsage: Record<string, number> = {};
      redemptionHistory.forEach(r => {
        serviceUsage[r.service] = (serviceUsage[r.service] || 0) + r.amount;
      });

      const usedServices = Object.keys(serviceUsage) as PlatformService[];
      if (usedServices.length > 0) {
        distributions = usedServices.map(service => ({
          service,
          percentage: Math.round((serviceUsage[service] / totalValue) * 100),
          amount: serviceUsage[service],
          department: SERVICE_DEPARTMENTS[service]
        }));
      } else {
        distributions = Object.entries(DEFAULT_DISTRIBUTION)
          .filter(([_, pct]) => pct > 0)
          .map(([service, percentage]) => ({
            service: service as PlatformService,
            percentage,
            amount: Math.round((percentage / 100) * totalValue * 100) / 100,
            department: SERVICE_DEPARTMENTS[service as PlatformService]
          }));
      }
      aiReasoning = 'Distribution based on actual service usage proportions.';
    }

    const digitalStamp = this.generateDigitalStamp(giftCardId, distributions, totalValue);

    const report: DistributionReport = {
      giftCardId,
      totalValue,
      distributions,
      aiReasoning,
      generatedAt: new Date(),
      digitalStamp
    };

    await this.emitDomainEvent('distribution.calculated', {
      giftCardId,
      report
    });

    return report;
  }

  async generateMonthlySettlementReport(): Promise<{
    period: string;
    totalGiftRevenue: number;
    byDepartment: Record<string, number>;
    reportUrl?: string;
  }> {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    return {
      period,
      totalGiftRevenue: 0,
      byDepartment: {
        'K9000 Operations': 0,
        '⁦Sitter Suite™⁩ Division': 0,
        '⁦Walk My Pet™⁩ Division': 0,
        '⁦PetTrek™⁩ Logistics': 0,
        'Central Treasury': 0
      }
    };
  }

  private generateDigitalStamp(
    giftCardId: string,
    distributions: RevenueDistribution[],
    totalValue: number
  ): string {
    const payload = {
      id: giftCardId,
      total: totalValue,
      distributions: distributions.map(d => ({ s: d.service, p: d.percentage })),
      ts: Date.now()
    };
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    return `STAMP-${hash.substring(0, 16).toUpperCase()}`;
  }

  private async emitDomainEvent(eventType: string, payload: any) {
    try {
      await db.insert(domainEvents).values({
        eventId: crypto.randomUUID(),
        eventType,
        aggregateType: 'gift',
        aggregateId: payload.giftCardId,
        payload,
        metadata: { source: 'GiftOrchestrationService' }
      });
    } catch (error) {
      console.error('[GiftOrchestration] Failed to emit domain event:', error);
    }
  }
}

export const giftOrchestrationService = new GiftOrchestrationService();