import express from 'express';
import { logisticsService } from '../services/LogisticsService';
import { insertLogisticsTaskSchema, updateLogisticsTaskSchema, insertLogisticsVehicleSchema, updateLogisticsVehicleSchema } from '@shared/schema';
import { logger } from '../lib/logger';
import { z } from 'zod';

const router = express.Router();

router.post('/tasks', async (req, res) => {
  try {
    const validatedData = insertLogisticsTaskSchema.parse(req.body);
    
    const userId = req.firebaseUser?.uid || req.user?.uid || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const task = await logisticsService.createTask({
      ...validatedData,
      createdByUserId: userId,
    });

    res.status(201).json(task);
  } catch (error) {
    logger.error('[Logistics Routes] Error creating task:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const { status, type, stationId, assignedToUserId } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (type) filters.type = type as string;
    if (stationId) filters.stationId = parseInt(stationId as string);
    if (assignedToUserId) filters.assignedToUserId = assignedToUserId as string;

    const tasks = await logisticsService.listAllTasks(filters);

    res.json(tasks);
  } catch (error) {
    logger.error('[Logistics Routes] Error listing tasks:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

router.get('/tasks/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await logisticsService.getTaskById(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    logger.error('[Logistics Routes] Error getting task:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

router.patch('/tasks/:id/assign', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const task = await logisticsService.assignTask(taskId, userId);

    res.json(task);
  } catch (error) {
    logger.error('[Logistics Routes] Error assigning task:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  }
});

router.patch('/tasks/:id/start', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await logisticsService.markTaskInProgress(taskId);

    res.json(task);
  } catch (error) {
    logger.error('[Logistics Routes] Error starting task:', error);
    res.status(500).json({ error: 'Failed to start task' });
  }
});

router.patch('/tasks/:id/complete', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await logisticsService.completeTask(taskId);

    res.json(task);
  } catch (error) {
    logger.error('[Logistics Routes] Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

router.patch('/tasks/:id/fail', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const task = await logisticsService.failTask(taskId, reason);

    res.json(task);
  } catch (error) {
    logger.error('[Logistics Routes] Error failing task:', error);
    res.status(500).json({ error: 'Failed to mark task as failed' });
  }
});

router.get('/user/:userId/tasks', async (req, res) => {
  try {
    const { userId } = req.params;
    const { statuses } = req.query;

    const statusArray = statuses ? (statuses as string).split(',') : undefined;

    const tasks = await logisticsService.listTasksForUser(userId, statusArray);

    res.json(tasks);
  } catch (error) {
    logger.error('[Logistics Routes] Error listing user tasks:', error);
    res.status(500).json({ error: 'Failed to list user tasks' });
  }
});

router.get('/station/:stationId/tasks', async (req, res) => {
  try {
    const stationId = parseInt(req.params.stationId);
    const { statuses } = req.query;

    const statusArray = statuses ? (statuses as string).split(',') : undefined;

    const tasks = await logisticsService.listTasksByStation(stationId, statusArray);

    res.json(tasks);
  } catch (error) {
    logger.error('[Logistics Routes] Error listing station tasks:', error);
    res.status(500).json({ error: 'Failed to list station tasks' });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const dashboard = await logisticsService.getTaskDashboard();

    res.json(dashboard);
  } catch (error) {
    logger.error('[Logistics Routes] Error getting dashboard:', error);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

router.post('/vehicles', async (req, res) => {
  try {
    const validatedData = insertLogisticsVehicleSchema.parse(req.body);

    const vehicle = await logisticsService.createVehicle(validatedData);

    res.status(201).json(vehicle);
  } catch (error) {
    logger.error('[Logistics Routes] Error creating vehicle:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

router.get('/vehicles', async (req, res) => {
  try {
    const { isActive } = req.query;

    const activeFilter = isActive !== undefined ? isActive === 'true' : undefined;

    const vehicles = await logisticsService.listVehicles(activeFilter);

    res.json(vehicles);
  } catch (error) {
    logger.error('[Logistics Routes] Error listing vehicles:', error);
    res.status(500).json({ error: 'Failed to list vehicles' });
  }
});

router.get('/vehicles/:id', async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);
    const vehicle = await logisticsService.getVehicleById(vehicleId);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json(vehicle);
  } catch (error) {
    logger.error('[Logistics Routes] Error getting vehicle:', error);
    res.status(500).json({ error: 'Failed to get vehicle' });
  }
});

router.patch('/vehicles/:id', async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);
    const validatedData = updateLogisticsVehicleSchema.parse(req.body);

    const vehicle = await logisticsService.updateVehicle(vehicleId, validatedData);

    res.json(vehicle);
  } catch (error) {
    logger.error('[Logistics Routes] Error updating vehicle:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

router.get('/mobile/my-tasks', async (req, res) => {
  try {
    const userId = req.firebaseUser?.uid || req.user?.uid || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tasks = await logisticsService.listTasksForUser(userId, ['assigned', 'in_progress']);

    const optimizedTasks = tasks.map(task => ({
      id: task.id,
      taskNumber: task.taskNumber,
      type: task.type,
      status: task.status,
      description: task.description,
      stationId: task.stationId,
      preferredWindowStart: task.preferredWindowStart,
      preferredWindowEnd: task.preferredWindowEnd,
      createdAt: task.createdAt,
    }));

    res.json(optimizedTasks);
  } catch (error) {
    logger.error('[Logistics Routes] Error getting mobile tasks:', error);
    res.status(500).json({ error: 'Failed to get mobile tasks' });
  }
});

export default router;
