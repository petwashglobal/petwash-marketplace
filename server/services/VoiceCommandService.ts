// Voice Command Processing Service
// Handles voice commands for hands-free station control
// Based on user's React Native code: "Voice Command: Dispense Shampoo"

import { logger } from '../lib/logger';
import { db as firestore } from '../lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export interface VoiceCommand {
  command: string;
  stationId: string;
  employeeUid: string;
  timestamp: Date;
  confidence: number;
  rawText: string;
}

export interface VoiceCommandResult {
  success: boolean;
  action: string;
  message: string;
  executed: boolean;
}

export class VoiceCommandService {
  private static readonly VALID_COMMANDS = {
    // Station Control Commands
    'START_WASH': ['start wash', 'begin wash', 'activate wash'],
    'STOP_WASH': ['stop wash', 'halt wash', 'cancel wash'],
    'DISPENSE_SHAMPOO': ['dispense shampoo', 'add shampoo', 'shampoo'],
    'RINSE': ['rinse', 'start rinse', 'rinse cycle'],
    'DRY': ['dry', 'start dry', 'drying cycle'],
    'EMERGENCY_STOP': ['emergency stop', 'stop now', 'halt'],
    
    // Status Commands
    'STATUS': ['status', 'check status', 'current status'],
    'NEXT_TASK': ['next task', 'next appointment', 'what\'s next'],
    
    // Maintenance Commands
    'MAINTENANCE_MODE': ['maintenance mode', 'service mode'],
    'OPERATIONAL': ['operational', 'ready', 'activate'],
  };

  /**
   * Process voice command from mobile app
   * This is called when user presses the voice button in React Native
   */
  static async processVoiceCommand(
    rawText: string,
    stationId: string,
    employeeUid: string
  ): Promise<VoiceCommandResult> {
    try {
      logger.info('[VoiceCommand] Processing voice input', {
        rawText,
        stationId,
        employeeUid,
      });

      // Normalize text
      const normalizedText = rawText.toLowerCase().trim();

      // Match command
      const matchedCommand = this.matchCommand(normalizedText);
      if (!matchedCommand) {
        return {
          success: false,
          action: 'UNKNOWN',
          message: 'Command not recognized. Try "dispense shampoo" or "start wash"',
          executed: false,
        };
      }

      // Execute command
      const result = await this.executeCommand(
        matchedCommand,
        stationId,
        employeeUid
      );

      // Log to audit trail
      await this.logVoiceCommand({
        command: matchedCommand,
        stationId,
        employeeUid,
        timestamp: new Date(),
        confidence: 0.95,
        rawText,
      });

      return result;
    } catch (error) {
      logger.error('[VoiceCommand] Processing failed', error);
      return {
        success: false,
        action: 'ERROR',
        message: 'Voice command processing failed',
        executed: false,
      };
    }
  }

  /**
   * Match voice input to known commands
   */
  private static matchCommand(text: string): string | null {
    for (const [command, phrases] of Object.entries(this.VALID_COMMANDS)) {
      for (const phrase of phrases) {
        if (text.includes(phrase)) {
          return command;
        }
      }
    }
    return null;
  }

  /**
   * Execute the matched command
   */
  private static async executeCommand(
    command: string,
    stationId: string,
    employeeUid: string
  ): Promise<VoiceCommandResult> {
    switch (command) {
      case 'DISPENSE_SHAMPOO':
        // Send command to K9000 station
        await this.sendStationCommand(stationId, 'dispense_shampoo', {
          amount: 'standard',
          product: 'organic_shampoo',
        });
        return {
          success: true,
          action: 'DISPENSE_SHAMPOO',
          message: 'Dispensing organic shampoo',
          executed: true,
        };

      case 'START_WASH':
        await this.sendStationCommand(stationId, 'start_cycle', {
          cycle: 'full_wash',
        });
        return {
          success: true,
          action: 'START_WASH',
          message: 'Starting wash cycle',
          executed: true,
        };

      case 'STOP_WASH':
        await this.sendStationCommand(stationId, 'stop_cycle', {});
        return {
          success: true,
          action: 'STOP_WASH',
          message: 'Stopping wash cycle',
          executed: true,
        };

      case 'RINSE':
        await this.sendStationCommand(stationId, 'start_rinse', {});
        return {
          success: true,
          action: 'RINSE',
          message: 'Starting rinse cycle',
          executed: true,
        };

      case 'DRY':
        await this.sendStationCommand(stationId, 'start_dry', {});
        return {
          success: true,
          action: 'DRY',
          message: 'Starting drying cycle',
          executed: true,
        };

      case 'EMERGENCY_STOP':
        await this.sendStationCommand(stationId, 'emergency_stop', {});
        return {
          success: true,
          action: 'EMERGENCY_STOP',
          message: 'Emergency stop activated',
          executed: true,
        };

      case 'MAINTENANCE_MODE':
        await this.updateStationStatus(stationId, 'maintenance');
        return {
          success: true,
          action: 'MAINTENANCE_MODE',
          message: 'Station set to maintenance mode',
          executed: true,
        };

      case 'OPERATIONAL':
        await this.updateStationStatus(stationId, 'operational');
        return {
          success: true,
          action: 'OPERATIONAL',
          message: 'Station is now operational',
          executed: true,
        };

      case 'STATUS':
        const status = await this.getStationStatus(stationId);
        return {
          success: true,
          action: 'STATUS',
          message: `Station is ${status}`,
          executed: false,
        };

      case 'NEXT_TASK':
        const nextTask = await this.getNextTask(employeeUid);
        return {
          success: true,
          action: 'NEXT_TASK',
          message: nextTask || 'No tasks scheduled',
          executed: false,
        };

      default:
        return {
          success: false,
          action: 'UNKNOWN',
          message: 'Command not supported',
          executed: false,
        };
    }
  }

  /**
   * Send command to K9000 station (IoT integration)
   */
  private static async sendStationCommand(
    stationId: string,
    action: string,
    params: Record<string, any>
  ): Promise<void> {
    // Update Firestore station control document
    await firestore.collection('station_commands').add({
      stationId,
      action,
      params,
      timestamp: Timestamp.now(),
      status: 'pending',
      source: 'voice_command',
    });

    logger.info('[VoiceCommand] Station command sent', {
      stationId,
      action,
      params,
    });
  }

  /**
   * Update station status
   */
  private static async updateStationStatus(
    stationId: string,
    status: string
  ): Promise<void> {
    await firestore
      .collection('stations')
      .doc(stationId)
      .update({
        status,
        updatedAt: Timestamp.now(),
        updatedBy: 'voice_command',
      });
  }

  /**
   * Get station status
   */
  private static async getStationStatus(stationId: string): Promise<string> {
    const doc = await firestore.collection('stations').doc(stationId).get();
    return doc.data()?.status || 'unknown';
  }

  /**
   * Get next task for employee
   */
  private static async getNextTask(employeeUid: string): Promise<string | null> {
    const tasksSnapshot = await firestore
      .collection('wash_tasks')
      .where('assignedToUid', '==', employeeUid)
      .where('status', '==', 'pending')
      .orderBy('scheduledTime', 'asc')
      .limit(1)
      .get();

    if (tasksSnapshot.empty) {
      return null;
    }

    const task = tasksSnapshot.docs[0].data();
    const time = task.scheduledTime.toDate().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${task.petName} at ${time}`;
  }

  /**
   * Log voice command for audit trail
   */
  private static async logVoiceCommand(command: VoiceCommand): Promise<void> {
    await firestore.collection('voice_command_logs').add({
      ...command,
      timestamp: Timestamp.fromDate(command.timestamp),
      retentionUntil: Timestamp.fromDate(
        new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000) // 7 years
      ),
    });
  }
}
