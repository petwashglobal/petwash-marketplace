import { logger } from '../lib/logger';
export class DocuSealService {
    config;
    constructor() {
        this.config = {
            apiKey: process.env.DOCUSEAL_API_KEY || '',
            baseUrl: process.env.DOCUSEAL_BASE_URL || 'https://api.docuseal.com'
        };
        if (!this.config.apiKey) {
            logger.warn('[DocuSeal] ⚠️ API key not configured - using demo mode');
            logger.info('[DocuSeal] Set DOCUSEAL_API_KEY and DOCUSEAL_BASE_URL environment variables');
            logger.info('[DocuSeal] Get API key from: https://www.docuseal.com or self-host at https://github.com/docusealco/docuseal');
        }
        else {
            logger.info('[DocuSeal] ✅ E-signature service initialized');
            logger.info('[DocuSeal] Base URL:', this.config.baseUrl);
        }
    }
    /**
     * Create a signing submission (sends document for signature)
     * Supports Hebrew and all Pet Wash™ languages
     */
    async createSubmission(request) {
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
                submitters: submission.submitters.map((s) => ({
                    id: s.id.toString(),
                    email: s.email,
                    name: s.name,
                    status: s.status,
                    embedSrc: s.embed_src
                })),
                documents: submission.documents.map((d) => ({
                    id: d.id.toString(),
                    name: d.name,
                    url: d.url
                })),
                createdAt: submission.created_at,
                updatedAt: submission.updated_at
            };
        }
        catch (error) {
            logger.error('[DocuSeal] ❌ Failed to create submission:', error.message);
            throw new Error(`Failed to create DocuSeal submission: ${error.message}`);
        }
    }
    /**
     * Get submission status
     */
    async getSubmission(submissionId) {
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
                submitters: submission.submitters.map((s) => ({
                    id: s.id.toString(),
                    email: s.email,
                    name: s.name,
                    status: s.status,
                    embedSrc: s.embed_src
                })),
                documents: submission.documents.map((d) => ({
                    id: d.id.toString(),
                    name: d.name,
                    url: d.url
                })),
                createdAt: submission.created_at,
                updatedAt: submission.updated_at
            };
        }
        catch (error) {
            logger.error('[DocuSeal] ❌ Failed to get submission:', error.message);
            throw new Error(`Failed to get DocuSeal submission: ${error.message}`);
        }
    }
    /**
     * Get signing URL for mobile embedding
     * Returns direct link for mobile browser access
     */
    getSigningUrl(submissionResponse, language) {
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
    getEmbedCode(submissionResponse, language) {
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
