import { db } from "../db";
import { platforms, domainEvents } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import type { PlatformFeature, PlatformConfig } from "../middleware/platformContext";
import { clearPlatformCache } from "../middleware/platformContext";

export interface PlatformCreateInput {
  id: string;
  name: string;
  nameHe?: string;
  description?: string;
  descriptionHe?: string;
  platformFeePercent?: number;
  bookingMode?: "SINGLE_SLOT" | "MULTI_DAY" | "ARRIVAL_WINDOW";
  features?: PlatformFeature[];
  nayaxEnabled?: boolean;
}

export interface PlatformUpdateInput {
  name?: string;
  nameHe?: string;
  description?: string;
  descriptionHe?: string;
  isActive?: boolean;
  platformFeePercent?: number;
  bookingMode?: string;
  features?: PlatformFeature[];
  settings?: Record<string, unknown>;
  nayaxEnabled?: boolean;
}

const PETWASH_PLATFORMS: PlatformCreateInput[] = [
  {
    id: "SITTER_SUITE",
    name: "The Sitter Suite™",
    nameHe: "חבילת הסיטר™",
    description: "Premium pet sitting marketplace with Meet & Greet, 72-hour escrow, and verified sitters",
    descriptionHe: "שוק שמרטפים מובחר עם פגישת היכרות, נאמנות 72 שעות, ושמרטפים מאומתים",
    platformFeePercent: 15,
    bookingMode: "MULTI_DAY",
    features: ["marketplace", "bookings", "payments", "docs_verification", "search", "reviews", "chat", "escrow", "meet_greet"],
  },
  {
    id: "WALK_MY_PET",
    name: "Walk My Pet™",
    nameHe: "הולך את הכלב שלי™",
    description: "On-demand dog walking with real-time GPS tracking",
    descriptionHe: "שירות הליכת כלבים לפי דרישה עם מעקב GPS בזמן אמת",
    platformFeePercent: 20,
    bookingMode: "SINGLE_SLOT",
    features: ["marketplace", "bookings", "payments", "search", "reviews", "gps_tracking"],
  },
  {
    id: "PET_TREK",
    name: "PetTrek™",
    nameHe: "פטטרק™",
    description: "Premium pet transportation with climate-controlled vehicles",
    descriptionHe: "הסעות חיות מחמד פרימיום עם רכבים ממוזגים",
    platformFeePercent: 18,
    bookingMode: "ARRIVAL_WINDOW",
    features: ["marketplace", "bookings", "payments", "search", "logistics", "gps_tracking"],
  },
  {
    id: "K9000_WASH",
    name: "K9000™ Self-Wash",
    nameHe: "K9000™ שטיפה עצמית",
    description: "IoT-enabled premium self-service pet washing stations",
    descriptionHe: "תחנות שטיפה עצמית לחיות מחמד עם טכנולוגיית IoT",
    platformFeePercent: 0,
    bookingMode: "SINGLE_SLOT",
    features: ["bookings", "payments", "search"],
    nayaxEnabled: true,
  },
  {
    id: "PAW_FINDER",
    name: "Paw Finder™",
    nameHe: "מחפש כפה™",
    description: "Lost & found pet network with community alerts",
    descriptionHe: "רשת חיות אבודות ונמצאות עם התראות קהילתיות",
    platformFeePercent: 0,
    bookingMode: "SINGLE_SLOT",
    features: ["marketplace", "search", "chat"],
  },
  {
    id: "PLUSH_LAB",
    name: "The Plush Lab™",
    nameHe: "מעבדת הפלאש™",
    description: "AI-powered custom pet avatar and plush toy creation",
    descriptionHe: "יצירת אווטארים ובובות פלאש מותאמות אישית עם AI",
    platformFeePercent: 25,
    bookingMode: "SINGLE_SLOT",
    features: ["marketplace", "payments", "search", "ai_verification"],
  },
  {
    id: "TRAINING",
    name: "Pet Training™",
    nameHe: "אילוף חיות מחמד™",
    description: "Professional pet training and behavior modification",
    descriptionHe: "אילוף מקצועי ושינוי התנהגות לחיות מחמד",
    platformFeePercent: 15,
    bookingMode: "SINGLE_SLOT",
    features: ["marketplace", "bookings", "payments", "search", "reviews"],
  },
  {
    id: "GROOMING",
    name: "Pet Grooming™",
    nameHe: "טיפוח חיות מחמד™",
    description: "Mobile and salon pet grooming services",
    descriptionHe: "שירותי טיפוח ניידים ובסלון לחיות מחמד",
    platformFeePercent: 15,
    bookingMode: "SINGLE_SLOT",
    features: ["marketplace", "bookings", "payments", "search", "reviews"],
  },
  {
    id: "DAYCARE",
    name: "Pet Daycare™",
    nameHe: "משמרת יום לחיות מחמד™",
    description: "Daily pet care with live updates and webcam access",
    descriptionHe: "טיפול יומי בחיות מחמד עם עדכונים חיים וגישה למצלמות",
    platformFeePercent: 15,
    bookingMode: "SINGLE_SLOT",
    features: ["marketplace", "bookings", "payments", "search", "reviews", "escrow"],
  },
];

export class PlatformService {
  private static instance: PlatformService;

  private constructor() {}

  static getInstance(): PlatformService {
    if (!PlatformService.instance) {
      PlatformService.instance = new PlatformService();
    }
    return PlatformService.instance;
  }

  async listPlatforms(includeInactive = false): Promise<PlatformConfig[]> {
    const query = includeInactive
      ? db.select().from(platforms)
      : db.select().from(platforms).where(eq(platforms.isActive, true));

    const results = await query;

    return results.map((p) => this.mapToPlatformConfig(p));
  }

  async getPlatformById(id: string): Promise<PlatformConfig | null> {
    const [result] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.id, id))
      .limit(1);

    if (!result) return null;
    return this.mapToPlatformConfig(result);
  }

  async createPlatform(input: PlatformCreateInput, actorUserId?: string): Promise<PlatformConfig> {
    const settings = {
      features: input.features || [],
    };

    const [result] = await db
      .insert(platforms)
      .values({
        id: input.id.toUpperCase(),
        name: input.name,
        nameHe: input.nameHe,
        description: input.description,
        descriptionHe: input.descriptionHe,
        isActive: true,
        platformFeePercent: input.platformFeePercent?.toString() || "15",
        bookingMode: input.bookingMode || "SINGLE_SLOT",
        nayaxEnabled: input.nayaxEnabled || false,
        settings,
      })
      .returning();

    await this.logEvent("platform.created", "platform", result.id, { input }, actorUserId);
    clearPlatformCache(result.id);

    return this.mapToPlatformConfig(result);
  }

  async updatePlatform(id: string, input: PlatformUpdateInput, actorUserId?: string): Promise<PlatformConfig | null> {
    const existing = await this.getPlatformById(id);
    if (!existing) return null;

    const updateData: Record<string, unknown> = {
      updatedAt: sql`NOW()`,
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.nameHe !== undefined) updateData.nameHe = input.nameHe;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.descriptionHe !== undefined) updateData.descriptionHe = input.descriptionHe;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.platformFeePercent !== undefined) updateData.platformFeePercent = input.platformFeePercent.toString();
    if (input.bookingMode !== undefined) updateData.bookingMode = input.bookingMode;
    if (input.nayaxEnabled !== undefined) updateData.nayaxEnabled = input.nayaxEnabled;

    if (input.features !== undefined || input.settings !== undefined) {
      const currentSettings = existing.settings || {};
      const newSettings = {
        ...currentSettings,
        ...(input.settings || {}),
        ...(input.features ? { features: input.features } : {}),
      };
      updateData.settings = newSettings;
    }

    const [result] = await db
      .update(platforms)
      .set(updateData as any)
      .where(eq(platforms.id, id))
      .returning();

    await this.logEvent("platform.updated", "platform", id, { input }, actorUserId);
    clearPlatformCache(id);

    return this.mapToPlatformConfig(result);
  }

  async seedDefaultPlatforms(): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const platform of PETWASH_PLATFORMS) {
      const existing = await this.getPlatformById(platform.id);
      if (existing) {
        skipped++;
        continue;
      }

      await this.createPlatform(platform, "system");
      created++;
    }

    return { created, skipped };
  }

  async toggleFeature(platformId: string, feature: PlatformFeature, enabled: boolean, actorUserId?: string): Promise<boolean> {
    const platform = await this.getPlatformById(platformId);
    if (!platform) return false;

    const currentFeatures = platform.features || [];
    let newFeatures: PlatformFeature[];

    if (enabled && !currentFeatures.includes(feature)) {
      newFeatures = [...currentFeatures, feature];
    } else if (!enabled) {
      newFeatures = currentFeatures.filter((f) => f !== feature);
    } else {
      return true;
    }

    await this.updatePlatform(platformId, { features: newFeatures }, actorUserId);
    await this.logEvent("platform.feature_toggled", "platform", platformId, { feature, enabled }, actorUserId);

    return true;
  }

  private mapToPlatformConfig(row: typeof platforms.$inferSelect): PlatformConfig {
    const settings = (row.settings as Record<string, unknown>) || {};
    const features = (settings.features as PlatformFeature[]) || [];

    return {
      id: row.id,
      name: row.name,
      nameHe: row.nameHe,
      description: row.description,
      descriptionHe: row.descriptionHe,
      isActive: row.isActive ?? true,
      platformFeePercent: parseFloat(row.platformFeePercent?.toString() || "15"),
      bookingMode: row.bookingMode || "SINGLE_SLOT",
      features,
      settings,
    };
  }

  private async logEvent(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    actorUserId?: string
  ) {
    const eventId = crypto.randomUUID();
    await db.insert(domainEvents).values({
      eventId,
      eventType,
      aggregateType,
      aggregateId,
      payload,
      metadata: { actorUserId },
      occurredAt: sql`NOW()`,
    });
  }
}

export const platformService = PlatformService.getInstance();
