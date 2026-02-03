/**
 * Pet Wash™ Google Drive Backup Service
 * 
 * Comprehensive backup and management system using Google Drive
 * Integrates with Google Sheets, Docs, Gmail, Calendar for complete data management
 * 
 * Integration: connection:conn_google-drive_01KCD8P748CE04N3JXP54WZJ30
 */

import { google } from 'googleapis';

let connectionSettings: any;
let serviceAccountAuth: any = null;

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Get auth client - uses service account in production, Replit Connectors in development
 */
async function getAuthClient() {
  // Production: Use service account credentials (works in Cloud Run)
  if (isProduction || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    if (!serviceAccountAuth) {
      const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (!credentialsJson) {
        throw new Error('Google service account credentials not configured for production');
      }
      const credentials = JSON.parse(credentialsJson);
      serviceAccountAuth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/documents',
        ],
      });
    }
    return serviceAccountAuth;
  }
  
  // Development: Use Replit Connectors OAuth flow
  const accessToken = await getAccessTokenFromReplit();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}

async function getAccessTokenFromReplit() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Replit connector tokens not available - use service account in production');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive not connected via Replit Connectors');
  }
  return accessToken;
}

async function getGoogleDriveClient() {
  const auth = await getAuthClient();
  return google.drive({ version: 'v3', auth });
}

async function getGoogleSheetsClient() {
  const auth = await getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

async function getGoogleDocsClient() {
  const auth = await getAuthClient();
  return google.docs({ version: 'v1', auth });
}

export interface BackupResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  webViewLink?: string;
  error?: string;
  timestamp: string;
}

export interface BackupConfig {
  folderName?: string;
  includeTimestamp?: boolean;
}

const PETWASH_BACKUP_FOLDER = 'PetWash_Backups';

export class GoogleDriveBackupService {
  private backupFolderId: string | null = null;

  /**
   * Find or create the Pet Wash backup folder
   */
  async ensureBackupFolder(): Promise<string> {
    if (this.backupFolderId) return this.backupFolderId;

    const drive = await getGoogleDriveClient();

    // Search for existing folder
    const response = await drive.files.list({
      q: `name='${PETWASH_BACKUP_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (response.data.files && response.data.files.length > 0) {
      this.backupFolderId = response.data.files[0].id!;
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

    this.backupFolderId = folder.data.id!;
    return this.backupFolderId;
  }

  /**
   * Backup JSON data to Google Drive
   */
  async backupJSON(data: any, fileName: string, config?: BackupConfig): Promise<BackupResult> {
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
        fileId: file.data.id!,
        fileName: file.data.name!,
        webViewLink: file.data.webViewLink!,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
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
  async createSpreadsheet(title: string, data: any[][], config?: BackupConfig): Promise<BackupResult> {
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

      const fileId = spreadsheet.data.spreadsheetId!;

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
        webViewLink: spreadsheet.data.spreadsheetUrl!,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
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
  async createDocument(title: string, content: string, config?: BackupConfig): Promise<BackupResult> {
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

      const documentId = doc.data.documentId!;

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
    } catch (error: any) {
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
  async listBackups(): Promise<{ files: any[]; error?: string }> {
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
    } catch (error: any) {
      return { files: [], error: error.message };
    }
  }

  /**
   * Full database backup to Google Sheets
   */
  async backupDatabase(tables: { name: string; data: any[] }[]): Promise<BackupResult[]> {
    const results: BackupResult[] = [];
    const timestamp = new Date().toISOString().split('T')[0];

    for (const table of tables) {
      if (table.data.length === 0) continue;

      // Convert to 2D array with headers
      const headers = Object.keys(table.data[0]);
      const rows = table.data.map(row => headers.map(h => row[h]));
      const data = [headers, ...rows];

      const result = await this.createSpreadsheet(
        `PetWash_${table.name}_${timestamp}`,
        data,
        { includeTimestamp: false }
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Backup system logs and reports
   */
  async backupReport(reportName: string, reportContent: string): Promise<BackupResult> {
    return this.createDocument(
      `PetWash_Report_${reportName}`,
      reportContent,
      { includeTimestamp: true }
    );
  }

  /**
   * Get backup folder info and stats
   */
  async getBackupStats(): Promise<{
    folderId: string;
    folderLink: string;
    totalFiles: number;
    latestBackup?: string;
  }> {
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
