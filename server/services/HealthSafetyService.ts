/**
 * Health & Safety Service
 * Handles incident reporting, photo uploads, and H&S analytics
 */

import { db } from '../db';
import { eq, desc, and, gte, lte, sql, count } from 'drizzle-orm';
import { 
  healthSafetyIncidents,
  incidentPhotos,
  stations,
  type HealthSafetyIncident,
  type InsertHealthSafetyIncident,
  type IncidentPhoto,
  type InsertIncidentPhoto
} from '@shared/schema';
import { storage } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { eventPublisher } from './EventPublisher';

export interface ReportIncidentParams {
  stationId: number;
  reportedByUserId: string;
  title: string;
  description: string;
  type: 'slip_and_fall' | 'electrical' | 'water_leak' | 'injury' | 'equipment_malfunction' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ListIncidentsFilters {
  stationId?: number;
  status?: 'open' | 'in_review' | 'resolved' | 'closed';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  type?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface IncidentDashboard {
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  criticalIncidents: number;
  bySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  byStatus: {
    open: number;
    in_review: number;
    resolved: number;
    closed: number;
  };
  byType: {
    slip_and_fall: number;
    electrical: number;
    water_leak: number;
    injury: number;
    equipment_malfunction: number;
    other: number;
  };
  averageResolutionTimeHours?: number;
}

export class HealthSafetyService {
  
  /**
   * Generate unique incident number (INC-YYYY-###)
   */
  static async generateIncidentNumber(): Promise<string> {
    try {
      const year = new Date().getFullYear();
      
      // Get count of incidents this year
      const result = await db
        .select({ count: count() })
        .from(healthSafetyIncidents)
        .where(sql`EXTRACT(YEAR FROM ${healthSafetyIncidents.reportedAt}) = ${year}`);
      
      const incidentCount = result[0]?.count || 0;
      const nextNumber = (incidentCount + 1).toString().padStart(3, '0');
      
      return `INC-${year}-${nextNumber}`;
    } catch (error) {
      logger.error('[HealthSafety] Failed to generate incident number', error);
      throw error;
    }
  }

  /**
   * Report a new incident with optional photos
   */
  static async reportIncident(
    params: ReportIncidentParams,
    photos?: Express.Multer.File[]
  ): Promise<HealthSafetyIncident & { photos?: IncidentPhoto[] }> {
    try {
      logger.info('[HealthSafety] Reporting incident', { 
        stationId: params.stationId, 
        severity: params.severity,
        type: params.type 
      });

      // Validate photo count
      if (photos && (Array.isArray(photos) ? photos.length > 10 : true)) {
        throw new Error('Maximum 10 photos allowed per incident');
      }

      // Generate incident number
      const incidentNumber = await this.generateIncidentNumber();

      // Create incident
      const [incident] = await db.insert(healthSafetyIncidents).values({
        incidentNumber,
        stationId: params.stationId,
        reportedByUserId: params.reportedByUserId,
        title: params.title,
        description: params.description,
        type: params.type,
        severity: params.severity,
        status: 'open',
      }).returning();

      logger.info('[HealthSafety] Incident created', { 
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber
      });

      // Upload photos if provided
      let uploadedPhotos: IncidentPhoto[] = [];
      if (photos && photos.length > 0) {
        uploadedPhotos = await this.uploadPhotos(incident.id, params.reportedByUserId, photos);
      }

      // Publish INCIDENT_REPORTED event
      await eventPublisher.publishEvent(
        'INCIDENT_REPORTED',
        {
          incidentId: incident.id,
          incidentNumber: incident.incidentNumber,
          stationId: incident.stationId,
          severity: incident.severity,
          type: incident.type,
          description: incident.description,
          reportedBy: incident.reportedByUserId,
          photoCount: uploadedPhotos.length,
        },
        {
          aggregateType: 'incident',
          aggregateId: String(incident.id),
          userId: params.reportedByUserId,
        }
      );

      logger.info('[HealthSafety] INCIDENT_REPORTED event published', { 
        incidentId: incident.id 
      });

      return {
        ...incident,
        photos: uploadedPhotos,
      };
    } catch (error) {
      logger.error('[HealthSafety] Failed to report incident', error);
      throw error;
    }
  }

  /**
   * Upload photos for an incident
   */
  static async uploadPhotos(
    incidentId: number,
    uploadedByUserId: string,
    files: Express.Multer.File[]
  ): Promise<IncidentPhoto[]> {
    try {
      const bucket = storage.bucket();
      const uploadedPhotos: IncidentPhoto[] = [];

      for (const file of files) {
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`Photo ${file.originalname} exceeds 5MB limit`);
        }

        // Validate file type
        if (!file.mimetype.match(/^image\/(jpeg|jpg|png|webp)$/)) {
          throw new Error(`Invalid file type: ${file.mimetype}`);
        }

        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `health-safety/${incidentId}/${timestamp}_${file.originalname}`;
        const fileUpload = bucket.file(fileName);

        // Upload to Firebase Storage
        await fileUpload.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
            metadata: {
              incidentId: String(incidentId),
              uploadedBy: uploadedByUserId,
              uploadedAt: new Date().toISOString(),
            },
          },
        });

        // Generate signed URL (valid for 1 year)
        const [signedUrl] = await fileUpload.getSignedUrl({
          action: 'read',
          expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
        });

        // Save photo record to database
        const [photoRecord] = await db.insert(incidentPhotos).values({
          incidentId,
          fileName: file.originalname,
          fileUrl: signedUrl,
          fileSizeBytes: file.size,
          mimeType: file.mimetype,
          uploadedByUserId,
        }).returning();

        uploadedPhotos.push(photoRecord);
        
        logger.info('[HealthSafety] Photo uploaded', { 
          photoId: photoRecord.id, 
          fileName: file.originalname 
        });
      }

      return uploadedPhotos;
    } catch (error) {
      logger.error('[HealthSafety] Failed to upload photos', error);
      throw error;
    }
  }

  /**
   * Upload a single photo to an existing incident
   */
  static async uploadIncidentPhoto(
    incidentId: number,
    uploadedByUserId: string,
    file: Express.Multer.File
  ): Promise<IncidentPhoto> {
    try {
      // Verify incident exists
      const [incident] = await db
        .select()
        .from(healthSafetyIncidents)
        .where(eq(healthSafetyIncidents.id, incidentId))
        .limit(1);

      if (!incident) {
        throw new Error('Incident not found');
      }

      // Check existing photo count
      const existingPhotos = await db
        .select()
        .from(incidentPhotos)
        .where(eq(incidentPhotos.incidentId, incidentId));

      if (existingPhotos.length >= 10) {
        throw new Error('Maximum 10 photos per incident');
      }

      const [photo] = await this.uploadPhotos(incidentId, uploadedByUserId, [file]);
      return photo;
    } catch (error) {
      logger.error('[HealthSafety] Failed to upload single photo', error);
      throw error;
    }
  }

  /**
   * Get incident by ID with photos
   */
  static async getIncidentById(incidentId: number): Promise<(HealthSafetyIncident & { photos: IncidentPhoto[] }) | null> {
    try {
      const [incident] = await db
        .select()
        .from(healthSafetyIncidents)
        .where(eq(healthSafetyIncidents.id, incidentId))
        .limit(1);

      if (!incident) {
        return null;
      }

      const photos = await db
        .select()
        .from(incidentPhotos)
        .where(eq(incidentPhotos.incidentId, incidentId));

      return {
        ...incident,
        photos,
      };
    } catch (error) {
      logger.error('[HealthSafety] Failed to get incident by ID', error);
      throw error;
    }
  }

  /**
   * List incidents with filters
   */
  static async listIncidents(
    filters: ListIncidentsFilters = {}
  ): Promise<(HealthSafetyIncident & { photos: IncidentPhoto[] })[]> {
    try {
      let query = db.select().from(healthSafetyIncidents);

      const conditions = [];

      if (filters.stationId) {
        conditions.push(eq(healthSafetyIncidents.stationId, filters.stationId));
      }

      if (filters.status) {
        conditions.push(eq(healthSafetyIncidents.status, filters.status));
      }

      if (filters.severity) {
        conditions.push(eq(healthSafetyIncidents.severity, filters.severity));
      }

      if (filters.type) {
        conditions.push(eq(healthSafetyIncidents.type, filters.type));
      }

      if (filters.fromDate) {
        conditions.push(gte(healthSafetyIncidents.reportedAt, filters.fromDate));
      }

      if (filters.toDate) {
        conditions.push(lte(healthSafetyIncidents.reportedAt, filters.toDate));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const incidents = await query.orderBy(desc(healthSafetyIncidents.reportedAt));

      // Get photos for all incidents
      const incidentsWithPhotos = await Promise.all(
        incidents.map(async (incident) => {
          const photos = await db
            .select()
            .from(incidentPhotos)
            .where(eq(incidentPhotos.incidentId, incident.id));

          return {
            ...incident,
            photos,
          };
        })
      );

      logger.info('[HealthSafety] Listed incidents', { 
        count: incidentsWithPhotos.length,
        filters 
      });

      return incidentsWithPhotos;
    } catch (error) {
      logger.error('[HealthSafety] Failed to list incidents', error);
      throw error;
    }
  }

  /**
   * Update incident status
   */
  static async updateIncidentStatus(
    incidentId: number,
    status: 'open' | 'in_review' | 'resolved' | 'closed',
    notes?: string
  ): Promise<HealthSafetyIncident> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (notes) {
        updateData.actionTaken = notes;
      }

      const [updated] = await db
        .update(healthSafetyIncidents)
        .set(updateData)
        .where(eq(healthSafetyIncidents.id, incidentId))
        .returning();

      if (!updated) {
        throw new Error('Incident not found');
      }

      logger.info('[HealthSafety] Incident status updated', { 
        incidentId, 
        status 
      });

      return updated;
    } catch (error) {
      logger.error('[HealthSafety] Failed to update incident status', error);
      throw error;
    }
  }

  /**
   * Assign incident to a user (H&S team member)
   */
  static async assignIncident(
    incidentId: number,
    assignedToUserId: string
  ): Promise<HealthSafetyIncident> {
    try {
      const [updated] = await db
        .update(healthSafetyIncidents)
        .set({
          resolvedByUserId: assignedToUserId,
          status: 'in_review',
          updatedAt: new Date(),
        })
        .where(eq(healthSafetyIncidents.id, incidentId))
        .returning();

      if (!updated) {
        throw new Error('Incident not found');
      }

      logger.info('[HealthSafety] Incident assigned', { 
        incidentId, 
        assignedTo: assignedToUserId 
      });

      return updated;
    } catch (error) {
      logger.error('[HealthSafety] Failed to assign incident', error);
      throw error;
    }
  }

  /**
   * Resolve incident
   */
  static async resolveIncident(
    incidentId: number,
    resolutionNotes: string,
    resolvedByUserId: string
  ): Promise<HealthSafetyIncident> {
    try {
      const [incident] = await db
        .update(healthSafetyIncidents)
        .set({
          status: 'resolved',
          resolutionNotes,
          resolvedByUserId,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(healthSafetyIncidents.id, incidentId))
        .returning();

      if (!incident) {
        throw new Error('Incident not found');
      }

      logger.info('[HealthSafety] Incident resolved', { 
        incidentId,
        resolvedBy: resolvedByUserId 
      });

      // Publish INCIDENT_RESOLVED event
      await eventPublisher.publishEvent(
        'INCIDENT_RESOLVED',
        {
          incidentId: incident.id,
          incidentNumber: incident.incidentNumber,
          stationId: incident.stationId,
          severity: incident.severity,
          resolutionNotes,
          resolvedBy: resolvedByUserId,
        },
        {
          aggregateType: 'incident',
          aggregateId: String(incident.id),
          userId: resolvedByUserId,
        }
      );

      logger.info('[HealthSafety] INCIDENT_RESOLVED event published', { 
        incidentId 
      });

      return incident;
    } catch (error) {
      logger.error('[HealthSafety] Failed to resolve incident', error);
      throw error;
    }
  }

  /**
   * Get dashboard analytics
   */
  static async getIncidentDashboard(): Promise<IncidentDashboard> {
    try {
      const allIncidents = await db.select().from(healthSafetyIncidents);

      const dashboard: IncidentDashboard = {
        totalIncidents: allIncidents.length,
        openIncidents: allIncidents.filter(i => i.status === 'open').length,
        resolvedIncidents: allIncidents.filter(i => i.status === 'resolved' || i.status === 'closed').length,
        criticalIncidents: allIncidents.filter(i => i.severity === 'critical').length,
        bySeverity: {
          low: allIncidents.filter(i => i.severity === 'low').length,
          medium: allIncidents.filter(i => i.severity === 'medium').length,
          high: allIncidents.filter(i => i.severity === 'high').length,
          critical: allIncidents.filter(i => i.severity === 'critical').length,
        },
        byStatus: {
          open: allIncidents.filter(i => i.status === 'open').length,
          in_review: allIncidents.filter(i => i.status === 'in_review').length,
          resolved: allIncidents.filter(i => i.status === 'resolved').length,
          closed: allIncidents.filter(i => i.status === 'closed').length,
        },
        byType: {
          slip_and_fall: allIncidents.filter(i => i.type === 'slip_and_fall').length,
          electrical: allIncidents.filter(i => i.type === 'electrical').length,
          water_leak: allIncidents.filter(i => i.type === 'water_leak').length,
          injury: allIncidents.filter(i => i.type === 'injury').length,
          equipment_malfunction: allIncidents.filter(i => i.type === 'equipment_malfunction').length,
          other: allIncidents.filter(i => i.type === 'other').length,
        },
      };

      // Calculate average resolution time
      const resolvedIncidents = allIncidents.filter(
        i => i.resolvedAt && i.reportedAt
      );

      if (resolvedIncidents.length > 0) {
        const totalResolutionTimeMs = resolvedIncidents.reduce((sum, incident) => {
          const reportedTime = new Date(incident.reportedAt!).getTime();
          const resolvedTime = new Date(incident.resolvedAt!).getTime();
          return sum + (resolvedTime - reportedTime);
        }, 0);

        const averageResolutionTimeMs = totalResolutionTimeMs / resolvedIncidents.length;
        dashboard.averageResolutionTimeHours = averageResolutionTimeMs / (1000 * 60 * 60);
      }

      logger.info('[HealthSafety] Dashboard generated', { 
        totalIncidents: dashboard.totalIncidents 
      });

      return dashboard;
    } catch (error) {
      logger.error('[HealthSafety] Failed to generate dashboard', error);
      throw error;
    }
  }
}
