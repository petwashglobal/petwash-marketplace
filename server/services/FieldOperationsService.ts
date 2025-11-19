/**
 * Field Operations Service
 * Handles mobile field operations for technicians including field updates,
 * photo uploads, and station management.
 */

import { db } from '../db';
import { eq, desc, and, sql } from 'drizzle-orm';
import { 
  fieldUpdates, 
  fieldUpdatePhotos, 
  staffDevices,
  stations,
  logisticsTasks,
  locations,
  type FieldUpdate,
  type InsertFieldUpdate,
  type FieldUpdatePhoto,
  type InsertFieldUpdatePhoto,
  type StaffDevice,
  type InsertStaffDevice
} from '@shared/schema';
import { storage } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

export interface CreateFieldUpdateParams {
  stationId: number;
  taskId?: number;
  createdByUserId: string;
  message: string;
  status?: 'before' | 'during' | 'after' | 'issue';
  tags?: string[];
  metadata?: {
    deviceInfo?: any;
    gpsCoords?: { latitude: number; longitude: number };
    [key: string]: any;
  };
}

export interface UploadPhotoParams {
  fieldUpdateId: number;
  file: Express.Multer.File;
}

export interface StationSummaryMobile {
  id: number;
  stationCode: string;
  name: string;
  status: string;
  location: {
    address: string;
    city: string;
    latitude: number;
    longitude: number;
    wazeUrl: string;
    googleMapsUrl: string;
  };
  lastUpdate?: {
    id: number;
    message: string;
    status: string;
    createdAt: Date;
    createdBy: string;
  };
  iotStatus?: any;
  lastHeartbeat?: Date;
}

export interface NearbyStationsParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
}

export class FieldOperationsService {
  
  /**
   * Create a field update with optional photos
   */
  static async createFieldUpdate(
    params: CreateFieldUpdateParams,
    photos?: Express.Multer.File[]
  ): Promise<FieldUpdate & { photos?: FieldUpdatePhoto[] }> {
    try {
      logger.info('[FieldOps] Creating field update', { 
        stationId: params.stationId, 
        userId: params.createdByUserId 
      });

      // Validate photo count
      if (photos && photos.length > 10) {
        throw new Error('Maximum 10 photos allowed per update');
      }

      // Create field update
      const [fieldUpdate] = await db.insert(fieldUpdates).values({
        stationId: params.stationId,
        taskId: params.taskId,
        createdByUserId: params.createdByUserId,
        message: params.message,
        status: params.status,
        tags: params.tags ? JSON.stringify(params.tags) : null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      }).returning();

      logger.info('[FieldOps] Field update created', { 
        fieldUpdateId: fieldUpdate.id 
      });

      // Upload photos if provided
      let uploadedPhotos: FieldUpdatePhoto[] = [];
      if (photos && photos.length > 0) {
        uploadedPhotos = await this.uploadPhotos(fieldUpdate.id, photos);
      }

      return {
        ...fieldUpdate,
        photos: uploadedPhotos,
      };
    } catch (error) {
      logger.error('[FieldOps] Failed to create field update', error);
      throw error;
    }
  }

  /**
   * Upload photos for a field update
   */
  static async uploadPhotos(
    fieldUpdateId: number,
    files: Express.Multer.File[]
  ): Promise<FieldUpdatePhoto[]> {
    try {
      const bucket = storage.bucket();
      const uploadedPhotos: FieldUpdatePhoto[] = [];

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
        const fileName = `field-updates/${fieldUpdateId}/${timestamp}_${file.originalname}`;
        const fileUpload = bucket.file(fileName);

        // Upload to Firebase Storage
        await fileUpload.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
            metadata: {
              fieldUpdateId: String(fieldUpdateId),
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
        const [photoRecord] = await db.insert(fieldUpdatePhotos).values({
          fieldUpdateId,
          fileName: file.originalname,
          fileUrl: signedUrl,
          fileSizeBytes: file.size,
          mimeType: file.mimetype,
        }).returning();

        uploadedPhotos.push(photoRecord);
        
        logger.info('[FieldOps] Photo uploaded', { 
          photoId: photoRecord.id, 
          fileName: file.originalname 
        });
      }

      return uploadedPhotos;
    } catch (error) {
      logger.error('[FieldOps] Failed to upload photos', error);
      throw error;
    }
  }

  /**
   * Upload a single photo to an existing field update
   */
  static async uploadPhoto(params: UploadPhotoParams): Promise<FieldUpdatePhoto> {
    try {
      // Verify field update exists
      const [fieldUpdate] = await db
        .select()
        .from(fieldUpdates)
        .where(eq(fieldUpdates.id, params.fieldUpdateId))
        .limit(1);

      if (!fieldUpdate) {
        throw new Error('Field update not found');
      }

      // Check existing photo count
      const existingPhotos = await db
        .select()
        .from(fieldUpdatePhotos)
        .where(eq(fieldUpdatePhotos.fieldUpdateId, params.fieldUpdateId));

      if (existingPhotos.length >= 10) {
        throw new Error('Maximum 10 photos per update');
      }

      const [photo] = await this.uploadPhotos(params.fieldUpdateId, [params.file]);
      return photo;
    } catch (error) {
      logger.error('[FieldOps] Failed to upload single photo', error);
      throw error;
    }
  }

  /**
   * Get timeline of field updates for a station
   */
  static async getTimelineForStation(stationId: number): Promise<(FieldUpdate & { photos: FieldUpdatePhoto[] })[]> {
    try {
      // Get all field updates for the station
      const updates = await db
        .select()
        .from(fieldUpdates)
        .where(eq(fieldUpdates.stationId, stationId))
        .orderBy(desc(fieldUpdates.createdAt));

      // Get photos for all updates
      const updatesWithPhotos = await Promise.all(
        updates.map(async (update) => {
          const photos = await db
            .select()
            .from(fieldUpdatePhotos)
            .where(eq(fieldUpdatePhotos.fieldUpdateId, update.id));

          return {
            ...update,
            photos,
          };
        })
      );

      logger.info('[FieldOps] Retrieved timeline for station', { 
        stationId, 
        updateCount: updatesWithPhotos.length 
      });

      return updatesWithPhotos;
    } catch (error) {
      logger.error('[FieldOps] Failed to get timeline for station', error);
      throw error;
    }
  }

  /**
   * Get field updates for a specific task
   */
  static async getFieldUpdatesForTask(taskId: number): Promise<(FieldUpdate & { photos: FieldUpdatePhoto[] })[]> {
    try {
      const updates = await db
        .select()
        .from(fieldUpdates)
        .where(eq(fieldUpdates.taskId, taskId))
        .orderBy(desc(fieldUpdates.createdAt));

      const updatesWithPhotos = await Promise.all(
        updates.map(async (update) => {
          const photos = await db
            .select()
            .from(fieldUpdatePhotos)
            .where(eq(fieldUpdatePhotos.fieldUpdateId, update.id));

          return {
            ...update,
            photos,
          };
        })
      );

      logger.info('[FieldOps] Retrieved updates for task', { 
        taskId, 
        updateCount: updatesWithPhotos.length 
      });

      return updatesWithPhotos;
    } catch (error) {
      logger.error('[FieldOps] Failed to get updates for task', error);
      throw error;
    }
  }

  /**
   * Generate Waze navigation URL
   */
  static generateWazeUrl(latitude: number, longitude: number): string {
    return `waze://?ll=${latitude},${longitude}&navigate=yes`;
  }

  /**
   * Generate Google Maps URL
   */
  static generateGoogleMapsUrl(latitude: number, longitude: number): string {
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }

  /**
   * Get mobile-optimized station summary
   */
  static async getStationSummaryForMobile(stationId: number): Promise<StationSummaryMobile> {
    try {
      // Get station with location data
      const [station] = await db
        .select({
          id: stations.id,
          stationCode: stations.stationCode,
          name: stations.name,
          status: stations.status,
          iotStatus: stations.iotStatus,
          lastHeartbeat: stations.lastHeartbeat,
          location: {
            id: locations.id,
            address: locations.address,
            city: locations.city,
            latitude: locations.latitude,
            longitude: locations.longitude,
          },
        })
        .from(stations)
        .leftJoin(locations, eq(stations.locationId, locations.id))
        .where(eq(stations.id, stationId))
        .limit(1);

      if (!station) {
        throw new Error('Station not found');
      }

      // Get most recent field update
      const [lastUpdate] = await db
        .select()
        .from(fieldUpdates)
        .where(eq(fieldUpdates.stationId, stationId))
        .orderBy(desc(fieldUpdates.createdAt))
        .limit(1);

      // Generate navigation URLs
      const wazeUrl = this.generateWazeUrl(
        Number(station.location.latitude), 
        Number(station.location.longitude)
      );
      const googleMapsUrl = this.generateGoogleMapsUrl(
        Number(station.location.latitude), 
        Number(station.location.longitude)
      );

      const summary: StationSummaryMobile = {
        id: station.id,
        stationCode: station.stationCode,
        name: station.name,
        status: station.status || 'unknown',
        location: {
          address: station.location.address || '',
          city: station.location.city || '',
          latitude: Number(station.location.latitude),
          longitude: Number(station.location.longitude),
          wazeUrl,
          googleMapsUrl,
        },
        iotStatus: station.iotStatus as any,
        lastHeartbeat: station.lastHeartbeat || undefined,
      };

      if (lastUpdate) {
        summary.lastUpdate = {
          id: lastUpdate.id,
          message: lastUpdate.message,
          status: lastUpdate.status || '',
          createdAt: lastUpdate.createdAt || new Date(),
          createdBy: lastUpdate.createdByUserId,
        };
      }

      logger.info('[FieldOps] Retrieved station summary', { stationId });
      return summary;
    } catch (error) {
      logger.error('[FieldOps] Failed to get station summary', error);
      throw error;
    }
  }

  /**
   * Get nearby stations using Haversine formula
   */
  static async getNearbyStations(params: NearbyStationsParams): Promise<StationSummaryMobile[]> {
    try {
      const radiusKm = params.radiusKm || 50; // Default 50km radius

      // Use raw SQL for Haversine distance calculation
      const nearbyStations = await db.execute(sql`
        SELECT 
          s.id,
          s.station_code,
          s.name,
          s.status,
          s.iot_status,
          s.last_heartbeat,
          l.address,
          l.city,
          l.latitude,
          l.longitude,
          (
            6371 * acos(
              cos(radians(${params.latitude})) * 
              cos(radians(l.latitude)) * 
              cos(radians(l.longitude) - radians(${params.longitude})) + 
              sin(radians(${params.latitude})) * 
              sin(radians(l.latitude))
            )
          ) AS distance_km
        FROM stations s
        LEFT JOIN locations l ON s.location_id = l.id
        WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
        HAVING distance_km <= ${radiusKm}
        ORDER BY distance_km ASC
        LIMIT 50
      `);

      const summaries: StationSummaryMobile[] = (nearbyStations.rows as any[]).map((row) => ({
        id: row.id,
        stationCode: row.station_code,
        name: row.name,
        status: row.status || 'unknown',
        location: {
          address: row.address || '',
          city: row.city || '',
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          wazeUrl: this.generateWazeUrl(Number(row.latitude), Number(row.longitude)),
          googleMapsUrl: this.generateGoogleMapsUrl(Number(row.latitude), Number(row.longitude)),
        },
        iotStatus: row.iot_status,
        lastHeartbeat: row.last_heartbeat,
      }));

      logger.info('[FieldOps] Found nearby stations', { 
        count: summaries.length, 
        radiusKm 
      });

      return summaries;
    } catch (error) {
      logger.error('[FieldOps] Failed to get nearby stations', error);
      throw error;
    }
  }

  /**
   * Register or update staff device for push notifications
   */
  static async registerDevice(device: InsertStaffDevice): Promise<StaffDevice> {
    try {
      // Check if device already exists
      const [existing] = await db
        .select()
        .from(staffDevices)
        .where(
          and(
            eq(staffDevices.userId, device.userId),
            eq(staffDevices.platform, device.platform)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing device
        const [updated] = await db
          .update(staffDevices)
          .set({
            deviceModel: device.deviceModel,
            osVersion: device.osVersion,
            appVersion: device.appVersion,
            pushToken: device.pushToken,
            lastSeenAt: new Date(),
          })
          .where(eq(staffDevices.id, existing.id))
          .returning();

        logger.info('[FieldOps] Device updated', { deviceId: updated.id });
        return updated;
      } else {
        // Create new device
        const [created] = await db
          .insert(staffDevices)
          .values(device)
          .returning();

        logger.info('[FieldOps] Device registered', { deviceId: created.id });
        return created;
      }
    } catch (error) {
      logger.error('[FieldOps] Failed to register device', error);
      throw error;
    }
  }

  /**
   * Update push token for a device
   */
  static async updatePushToken(deviceId: number, pushToken: string): Promise<StaffDevice> {
    try {
      const [updated] = await db
        .update(staffDevices)
        .set({
          pushToken,
          lastSeenAt: new Date(),
        })
        .where(eq(staffDevices.id, deviceId))
        .returning();

      if (!updated) {
        throw new Error('Device not found');
      }

      logger.info('[FieldOps] Push token updated', { deviceId });
      return updated;
    } catch (error) {
      logger.error('[FieldOps] Failed to update push token', error);
      throw error;
    }
  }
}
