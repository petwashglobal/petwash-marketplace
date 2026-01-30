import { db } from '../db';
import { logisticsTasks, logisticsVehicles } from '@shared/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { logger } from '../lib/logger';
export class LogisticsService {
    async createTask(data) {
        try {
            const taskNumber = await this.generateTaskNumber();
            const [task] = await db.insert(logisticsTasks).values({
                ...data,
                taskNumber,
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            }).returning();
            logger.info('[LogisticsService] Task created', {
                taskId: task.id,
                taskNumber: task.taskNumber,
                type: task.type,
            });
            return task;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to create task:', error);
            throw error;
        }
    }
    async assignTask(taskId, userId) {
        try {
            const [task] = await db
                .update(logisticsTasks)
                .set({
                assignedToUserId: userId,
                status: 'assigned',
                updatedAt: new Date(),
            })
                .where(eq(logisticsTasks.id, taskId))
                .returning();
            if (!task) {
                throw new Error('Task not found');
            }
            logger.info('[LogisticsService] Task assigned', {
                taskId,
                assignedTo: userId,
            });
            return task;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to assign task:', error);
            throw error;
        }
    }
    async markTaskInProgress(taskId) {
        try {
            const [task] = await db
                .update(logisticsTasks)
                .set({
                status: 'in_progress',
                updatedAt: new Date(),
            })
                .where(eq(logisticsTasks.id, taskId))
                .returning();
            if (!task) {
                throw new Error('Task not found');
            }
            logger.info('[LogisticsService] Task marked in progress', {
                taskId,
            });
            return task;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to mark task in progress:', error);
            throw error;
        }
    }
    async completeTask(taskId) {
        try {
            const [task] = await db
                .update(logisticsTasks)
                .set({
                status: 'completed',
                completedAt: new Date(),
                updatedAt: new Date(),
            })
                .where(eq(logisticsTasks.id, taskId))
                .returning();
            if (!task) {
                throw new Error('Task not found');
            }
            logger.info('[LogisticsService] Task completed', {
                taskId,
            });
            return task;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to complete task:', error);
            throw error;
        }
    }
    async failTask(taskId, reason) {
        try {
            const [task] = await db
                .update(logisticsTasks)
                .set({
                status: 'failed',
                failureReason: reason,
                updatedAt: new Date(),
            })
                .where(eq(logisticsTasks.id, taskId))
                .returning();
            if (!task) {
                throw new Error('Task not found');
            }
            logger.info('[LogisticsService] Task failed', {
                taskId,
                reason,
            });
            return task;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to mark task as failed:', error);
            throw error;
        }
    }
    async listTasksForUser(userId, statuses) {
        try {
            let query = db
                .select()
                .from(logisticsTasks)
                .where(eq(logisticsTasks.assignedToUserId, userId));
            if (statuses && statuses.length > 0) {
                query = query.where(and(eq(logisticsTasks.assignedToUserId, userId), inArray(logisticsTasks.status, statuses)));
            }
            const tasks = await query.orderBy(desc(logisticsTasks.createdAt));
            return tasks;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to list tasks for user:', error);
            throw error;
        }
    }
    async listTasksByStation(stationId, statuses) {
        try {
            let query = db
                .select()
                .from(logisticsTasks)
                .where(eq(logisticsTasks.stationId, stationId));
            if (statuses && statuses.length > 0) {
                query = query.where(and(eq(logisticsTasks.stationId, stationId), inArray(logisticsTasks.status, statuses)));
            }
            const tasks = await query.orderBy(desc(logisticsTasks.createdAt));
            return tasks;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to list tasks by station:', error);
            throw error;
        }
    }
    async getTaskById(taskId) {
        try {
            const [task] = await db
                .select()
                .from(logisticsTasks)
                .where(eq(logisticsTasks.id, taskId))
                .limit(1);
            return task || null;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to get task by id:', error);
            throw error;
        }
    }
    async listAllTasks(filters) {
        try {
            let query = db.select().from(logisticsTasks);
            const conditions = [];
            if (filters?.status) {
                conditions.push(eq(logisticsTasks.status, filters.status));
            }
            if (filters?.type) {
                conditions.push(eq(logisticsTasks.type, filters.type));
            }
            if (filters?.stationId) {
                conditions.push(eq(logisticsTasks.stationId, filters.stationId));
            }
            if (filters?.assignedToUserId) {
                conditions.push(eq(logisticsTasks.assignedToUserId, filters.assignedToUserId));
            }
            if (conditions.length > 0) {
                query = query.where(and(...conditions));
            }
            const tasks = await query.orderBy(desc(logisticsTasks.createdAt));
            return tasks;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to list all tasks:', error);
            throw error;
        }
    }
    async getTaskDashboard() {
        try {
            const allTasks = await db.select().from(logisticsTasks);
            const byStatus = allTasks.reduce((acc, task) => {
                const status = task.status || 'pending';
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {});
            const byType = allTasks.reduce((acc, task) => {
                acc[task.type] = (acc[task.type] || 0) + 1;
                return acc;
            }, {});
            const recentTasks = await db
                .select()
                .from(logisticsTasks)
                .orderBy(desc(logisticsTasks.createdAt))
                .limit(10);
            return {
                total: allTasks.length,
                byStatus,
                byType,
                recentTasks,
            };
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to get task dashboard:', error);
            throw error;
        }
    }
    async createVehicle(data) {
        try {
            const [vehicle] = await db.insert(logisticsVehicles).values({
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
            }).returning();
            logger.info('[LogisticsService] Vehicle created', {
                vehicleId: vehicle.id,
                label: vehicle.label,
            });
            return vehicle;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to create vehicle:', error);
            throw error;
        }
    }
    async updateVehicle(vehicleId, data) {
        try {
            const [vehicle] = await db
                .update(logisticsVehicles)
                .set({
                ...data,
                updatedAt: new Date(),
            })
                .where(eq(logisticsVehicles.id, vehicleId))
                .returning();
            if (!vehicle) {
                throw new Error('Vehicle not found');
            }
            logger.info('[LogisticsService] Vehicle updated', {
                vehicleId,
            });
            return vehicle;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to update vehicle:', error);
            throw error;
        }
    }
    async listVehicles(isActive) {
        try {
            let query = db.select().from(logisticsVehicles);
            if (isActive !== undefined) {
                query = query.where(eq(logisticsVehicles.isActive, isActive));
            }
            const vehicles = await query.orderBy(asc(logisticsVehicles.label));
            return vehicles;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to list vehicles:', error);
            throw error;
        }
    }
    async getVehicleById(vehicleId) {
        try {
            const [vehicle] = await db
                .select()
                .from(logisticsVehicles)
                .where(eq(logisticsVehicles.id, vehicleId))
                .limit(1);
            return vehicle || null;
        }
        catch (error) {
            logger.error('[LogisticsService] Failed to get vehicle by id:', error);
            throw error;
        }
    }
    async generateTaskNumber() {
        const year = new Date().getFullYear();
        const result = await db
            .select({ count: sql `count(*)` })
            .from(logisticsTasks)
            .where(sql `EXTRACT(YEAR FROM created_at) = ${year}`);
        const count = result[0]?.count || 0;
        const nextNumber = (Number(count) + 1).toString().padStart(3, '0');
        return `TASK-${year}-${nextNumber}`;
    }
}
export const logisticsService = new LogisticsService();
