/**
 * Pet Wash™ Google Backup API Routes
 *
 * Endpoints for managing Google Drive backups
 * Supports JSON, Sheets, Docs, and full database backups
 */
import { Router } from 'express';
import { googleDriveBackupService } from '../services/googleDriveBackupService';
import { storage } from '../storage';
const router = Router();
/**
 * GET /api/backup/status
 * Get backup system status and folder info
 */
router.get('/status', async (req, res) => {
    try {
        const stats = await googleDriveBackupService.getBackupStats();
        res.json({
            success: true,
            data: {
                connected: true,
                ...stats
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            connected: false
        });
    }
});
/**
 * GET /api/backup/list
 * List all backup files
 */
router.get('/list', async (req, res) => {
    try {
        const result = await googleDriveBackupService.listBackups();
        res.json({
            success: true,
            files: result.files,
            count: result.files.length
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * POST /api/backup/json
 * Backup JSON data to Google Drive
 */
router.post('/json', async (req, res) => {
    try {
        const { data, fileName, includeTimestamp = true } = req.body;
        if (!data || !fileName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: data, fileName'
            });
        }
        const result = await googleDriveBackupService.backupJSON(data, fileName, { includeTimestamp });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * POST /api/backup/spreadsheet
 * Create a Google Sheet backup
 */
router.post('/spreadsheet', async (req, res) => {
    try {
        const { title, data, includeTimestamp = true } = req.body;
        if (!data || !title) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: title, data (2D array)'
            });
        }
        const result = await googleDriveBackupService.createSpreadsheet(title, data, { includeTimestamp });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * POST /api/backup/document
 * Create a Google Doc backup
 */
router.post('/document', async (req, res) => {
    try {
        const { title, content, includeTimestamp = true } = req.body;
        if (!title) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: title'
            });
        }
        const result = await googleDriveBackupService.createDocument(title, content || '', { includeTimestamp });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * POST /api/backup/report
 * Create a system report backup
 */
router.post('/report', async (req, res) => {
    try {
        const { reportName, content } = req.body;
        if (!reportName || !content) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: reportName, content'
            });
        }
        const result = await googleDriveBackupService.backupReport(reportName, content);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * POST /api/backup/full
 * Full system backup - users, bookings, pets, etc.
 */
router.post('/full', async (req, res) => {
    try {
        const tables = [];
        // Backup users
        try {
            const users = await storage.getAllUsers?.() || [];
            if (users.length > 0) {
                tables.push({ name: 'users', data: users.map(u => ({ ...u, password: '[REDACTED]' })) });
            }
        }
        catch (e) {
            console.log('Users backup skipped');
        }
        // Backup pets
        try {
            const pets = await storage.getAllPets?.() || [];
            if (pets.length > 0) {
                tables.push({ name: 'pets', data: pets });
            }
        }
        catch (e) {
            console.log('Pets backup skipped');
        }
        // Backup bookings
        try {
            const bookings = await storage.getAllBookings?.() || [];
            if (bookings.length > 0) {
                tables.push({ name: 'bookings', data: bookings });
            }
        }
        catch (e) {
            console.log('Bookings backup skipped');
        }
        // Backup stations
        try {
            const stations = await storage.getAllStations?.() || [];
            if (stations.length > 0) {
                tables.push({ name: 'stations', data: stations });
            }
        }
        catch (e) {
            console.log('Stations backup skipped');
        }
        if (tables.length === 0) {
            return res.json({
                success: true,
                message: 'No data to backup',
                results: []
            });
        }
        const results = await googleDriveBackupService.backupDatabase(tables);
        const successCount = results.filter(r => r.success).length;
        const stats = await googleDriveBackupService.getBackupStats();
        res.json({
            success: true,
            message: `Backed up ${successCount}/${tables.length} tables`,
            results,
            folderLink: stats.folderLink
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
export default router;
