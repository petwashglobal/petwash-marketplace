import { logger } from '../lib/logger';

/**
 * DocuSeal E-Signature Service
 * Free, open-source alternative to DocuSign
 * Supports Hebrew (עברית), Arabic, and 14 languages total
 * 
 * Documentation: https://www.docuseal.com/docs/api
 * GitHub: https://github.com/docusealco/docuseal
 */

interface DocuSealConfig {
  apiKey: string;
  baseUrl: string; // Self-hosted URL or 'https://api.docuseal.com'
}

interface CreateSubmissionRequest {
  templateSlug: string; // Template identifier from DocuSeal dashboard
  signerEmail: string;
  signerName: string;
  language?: string; // 'en' | 'he' | 'ar' | 'es' | 'fr' | 'ru' | etc.
  sendEmail?: boolean;
  expiresIn?: number; // Days until expiration
  metadata?: Record<string, any>;
}

interface SubmissionResponse {
  id: string; // Submission ID
  slug: string; // URL slug
  status: string; // 'pending' | 'sent' | 'opened' | 'completed'
  submitters: Array<{
    id: string;
    email: string;
    name: string;
    status: string;
    embedSrc: string; // Direct signing URL
  }>;
  documents: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export class DocuSealService {
  private config: DocuSealConfig;

  constructor() {
    this.config = {
      apiKey: process.env.DOCUSEAL_API_KEY || '',
      baseUrl: process.env.DOCUSEAL_BASE_URL || 'https://api.docuseal.com'
    };

    if (!this.config.apiKey) {
      logger.warn('[DocuSeal] ⚠️ API key not configured - using demo mode');
      logger.info('[DocuSeal] Set DOCUSEAL_API_KEY and DOCUSEAL_BASE_URL environment variables');
      logger.info('[DocuSeal] Get API key from: https://www.docuseal.com or self-host at https://github.com/docusealco/docuseal');
    } else {
      logger.info('[DocuSeal] ✅ E-signature service initialized');
      logger.info('[DocuSeal] Base URL:', this.config.baseUrl);
    }
  }

  /**
   * Create a signing submission (sends document for signature)
   * Supports Hebrew and all Pet Wash™ languages
   */
  async createSubmission(request: CreateSubmissionRequest): Promise<SubmissionResponse> {
    if (!this.config.apiKey) {
      throw new Error('DocuSeal API key not configured. Set DOCUSEAL_API_KEY environment variable.');
    }

    try {
      const { DocusealApi } = await import('@docuseal/api');
      const docuseal = new DocusealApi({ key: this.config.apiKey });

      // Create submission
      const submission = await docuseal.createSubmission({
        template_slug: request.templateSlug,
        send_email: request.sendEmail !== false, // Default true
        expires_in: request.expiresIn || 30, // 30 days default
        submitters: [
          {
            role: 'First Party',
            email: request.signerEmail,
            name: request.signerName
          }
        ],
        metadata: request.metadata || {}
      });

      logger.info('[DocuSeal] ✅ Submission created:', {
        submissionId: submission.id,
        email: request.signerEmail,
        language: request.language || 'auto-detect'
      });

      return {
        id: submission.id.toString(),
        slug: submission.slug,
        status: submission.status,
        submitters: submission.submitters.map((s: any) => ({
          id: s.id.toString(),
          email: s.email,
          name: s.name,
          status: s.status,
          embedSrc: s.embed_src
        })),
        documents: submission.documents.map((d: any) => ({
          id: d.id.toString(),
          name: d.name,
          url: d.url
        })),
        createdAt: submission.created_at,
        updatedAt: submission.updated_at
      };

    } catch (error: any) {
      logger.error('[DocuSeal] ❌ Failed to create submission:', error.message);
      throw new Error(`Failed to create DocuSeal submission: ${error.message}`);
    }
  }

  /**
   * Get submission status
   */
  async getSubmission(submissionId: string): Promise<SubmissionResponse> {
    if (!this.config.apiKey) {
      throw new Error('DocuSeal API key not configured');
    }

    try {
      const { DocusealApi } = await import('@docuseal/api');
      const docuseal = new DocusealApi({ key: this.config.apiKey });

      const submission = await docuseal.getSubmission(parseInt(submissionId));

      return {
        id: submission.id.toString(),
        slug: submission.slug,
        status: submission.status,
        submitters: submission.submitters.map((s: any) => ({
          id: s.id.toString(),
          email: s.email,
          name: s.name,
          status: s.status,
          embedSrc: s.embed_src
        })),
        documents: submission.documents.map((d: any) => ({
          id: d.id.toString(),
          name: d.name,
          url: d.url
        })),
        createdAt: submission.created_at,
        updatedAt: submission.updated_at
      };

    } catch (error: any) {
      logger.error('[DocuSeal] ❌ Failed to get submission:', error.message);
      throw new Error(`Failed to get DocuSeal submission: ${error.message}`);
    }
  }

  /**
   * Get signing URL for mobile embedding
   * Returns direct link for mobile browser access
   */
  getSigningUrl(submissionResponse: SubmissionResponse, language?: string): string {
    const submitter = submissionResponse.submitters[0];
    if (!submitter) {
      throw new Error('No submitter found in submission');
    }

    // Return embed URL with optional language parameter
    let url = submitter.embedSrc;
    
    if (language) {
      url += `&lang=${language}`; // Append language code
    }

    return url;
  }

  /**
   * Generate HTML embed code for web integration
   */
  getEmbedCode(submissionResponse: SubmissionResponse, language?: string): string {
    const signingUrl = this.getSigningUrl(submissionResponse, language);
    
    return `<docuseal-form 
  data-src="${signingUrl}"
  data-email="${submissionResponse.submitters[0].email}"
  data-language="${language || 'auto'}"
  style="width:100%; height:100%; border:none;"
></docuseal-form>`;
  }
}

export const docuSealService = new DocuSealService();
