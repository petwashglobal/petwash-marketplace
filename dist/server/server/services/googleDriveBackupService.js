/**
 * Pet Wash™ Google Drive Backup Service
 *
 * Comprehensive backup and management system using Google Drive
 * Integrates with Google Sheets, Docs, Gmail, Calendar for complete data management
 *
 * Integration: connection:conn_google-drive_01KCD8P748CE04N3JXP54WZJ30
 */
import { google } from 'googleapis';
let connectionSettings;
async function getAccessToken() {
    if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
        return connectionSettings.settings.access_token;
    }
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY
        ? 'repl ' + process.env.REPL_IDENTITY
        : process.env.WEB_REPL_RENEWAL
            ? 'depl ' + process.env.WEB_REPL_RENEWAL
            : null;
    if (!xReplitToken) {
        throw new Error('X_REPLIT_TOKEN not found for repl/depl');
    }
    connectionSettings = await fetch('https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive', {
        headers: {
            'Accept': 'application/json',
            'X_REPLIT_TOKEN': xReplitToken
        }
    }).then(res => res.json()).then(data => data.items?.[0]);
    const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
    if (!connectionSettings || !accessToken) {
        throw new Error('Google Drive not connected');
    }
    return accessToken;
}
async function getGoogleDriveClient() {
    const accessToken = await getAccessToken();
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
}
async function getGoogleSheetsClient() {
    const accessToken = await getAccessToken();
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.sheets({ version: 'v4', auth: oauth2Client });
}
async function getGoogleDocsClient() {
    const accessToken = await getAccessToken();
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.docs({ version: 'v1', auth: oauth2Client });
}
const PETWASH_BACKUP_FOLDER = 'PetWash_Backups';
export class GoogleDriveBackupService {
    backupFolderId = null;
    /**
     * Find or create the Pet Wash backup folder
     */
    async ensureBackupFolder() {
        if (this.backupFolderId)
            return this.backupFolderId;
        const drive = await getGoogleDriveClient();
        // Search for existing folder
        const response = await drive.files.list({
            q: `name='${PETWASH_BACKUP_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
        });
        if (response.data.files && response.data.files.length > 0) {
            this.backupFolderId = response.data.files[0].id;
            return this.backupFolderId;
        }
        // Create new folder
        const folderMetadata = {
            name: PETWASH_BACKUP_FOLDER,
            mimeType: 'application/vnd.google-apps.folder',
        };
        const folder = await drive.files.create({
            requestBody: folderMetadata,
            fields: 'id',
        });
        this.backupFolderId = folder.data.id;
        return this.backupFolderId;
    }
    /**
     * Backup JSON data to Google Drive
     */
    async backupJSON(data, fileName, config) {
        try {
            const drive = await getGoogleDriveClient();
            const folderId = await this.ensureBackupFolder();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const finalFileName = config?.includeTimestamp
                ? `${fileName}_${timestamp}.json`
                : `${fileName}.json`;
            const fileMetadata = {
                name: finalFileName,
                parents: [folderId],
                mimeType: 'application/json',
            };
            const media = {
                mimeType: 'application/json',
                body: JSON.stringify(data, null, 2),
            };
            const file = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink',
            });
            return {
                success: true,
                fileId: file.data.id,
                fileName: file.data.name,
                webViewLink: file.data.webViewLink,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }
    /**
     * Create a Google Sheet with data
     */
    async createSpreadsheet(title, data, config) {
        try {
            const sheets = await getGoogleSheetsClient();
            const drive = await getGoogleDriveClient();
            const folderId = await this.ensureBackupFolder();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const finalTitle = config?.includeTimestamp
                ? `${title}_${timestamp}`
                : title;
            // Create spreadsheet
            const spreadsheet = await sheets.spreadsheets.create({
                requestBody: {
                    properties: { title: finalTitle },
                    sheets: [{
                            properties: { title: 'Data' },
                            data: [{
                                    rowData: data.map(row => ({
                                        values: row.map(cell => ({
                                            userEnteredValue: { stringValue: String(cell ?? '') }
                                        }))
                                    }))
                                }]
                        }]
                }
            });
            const fileId = spreadsheet.data.spreadsheetId;
            // Move to backup folder
            await drive.files.update({
                fileId: fileId,
                addParents: folderId,
                fields: 'id, parents'
            });
            return {
                success: true,
                fileId: fileId,
                fileName: finalTitle,
                webViewLink: spreadsheet.data.spreadsheetUrl,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }
    /**
     * Create a Google Doc with content
     */
    async createDocument(title, content, config) {
        try {
            const docs = await getGoogleDocsClient();
            const drive = await getGoogleDriveClient();
            const folderId = await this.ensureBackupFolder();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const finalTitle = config?.includeTimestamp
                ? `${title}_${timestamp}`
                : title;
            // Create document
            const doc = await docs.documents.create({
                requestBody: { title: finalTitle }
            });
            const documentId = doc.data.documentId;
            // Add content
            if (content) {
                await docs.documents.batchUpdate({
                    documentId: documentId,
                    requestBody: {
                        requests: [{
                                insertText: {
                                    location: { index: 1 },
                                    text: content
                                }
                            }]
                    }
                });
            }
            // Move to backup folder
            await drive.files.update({
                fileId: documentId,
                addParents: folderId,
                fields: 'id, parents'
            });
            return {
                success: true,
                fileId: documentId,
                fileName: finalTitle,
                webViewLink: `https://docs.google.com/document/d/${documentId}/edit`,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }
    /**
     * List all backup files
     */
    async listBackups() {
        try {
            const drive = await getGoogleDriveClient();
            const folderId = await this.ensureBackupFolder();
            const response = await drive.files.list({
                q: `'${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, mimeType, createdTime, size, webViewLink)',
                orderBy: 'createdTime desc',
                pageSize: 100,
            });
            return { files: response.data.files || [] };
        }
        catch (error) {
            return { files: [], error: error.message };
        }
    }
    /**
     * Full database backup to Google Sheets
     */
    async backupDatabase(tables) {
        const results = [];
        const timestamp = new Date().toISOString().split('T')[0];
        for (const table of tables) {
            if (table.data.length === 0)
                continue;
            // Convert to 2D array with headers
            const headers = Object.keys(table.data[0]);
            const rows = table.data.map(row => headers.map(h => row[h]));
            const data = [headers, ...rows];
            const result = await this.createSpreadsheet(`PetWash_${table.name}_${timestamp}`, data, { includeTimestamp: false });
            results.push(result);
        }
        return results;
    }
    /**
     * Backup system logs and reports
     */
    async backupReport(reportName, reportContent) {
        return this.createDocument(`PetWash_Report_${reportName}`, reportContent, { includeTimestamp: true });
    }
    /**
     * Get backup folder info and stats
     */
    async getBackupStats() {
        const drive = await getGoogleDriveClient();
        const folderId = await this.ensureBackupFolder();
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc',
            pageSize: 1,
        });
        return {
            folderId,
            folderLink: `https://drive.google.com/drive/folders/${folderId}`,
            totalFiles: response.data.files?.length || 0,
            latestBackup: response.data.files?.[0]?.createdTime,
        };
    }
}
export const googleDriveBackupService = new GoogleDriveBackupService();
