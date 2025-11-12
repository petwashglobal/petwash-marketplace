import { Router } from 'express';
import { z } from 'zod';
import { contractGenerationService } from '../services/ContractGenerationService';
import { validateFirebaseToken } from '../middleware/firebase-auth';

const router = Router();

const generateOfferLetterSchema = z.object({
  entityId: z.number().optional(),
  employeeName: z.string().min(1),
  employeeEmail: z.string().email(),
  jobTitle: z.string().min(1),
  department: z.string().min(1),
  salary: z.number().positive(),
  salaryCurrency: z.string().default('ILS'),
  startDate: z.string(),
  managerName: z.string().min(1),
  location: z.string().min(1),
  country: z.string().min(2).max(2),
});

const generateContractorAgreementSchema = z.object({
  entityId: z.number().optional(),
  contractorName: z.string().min(1),
  contractorEmail: z.string().email(),
  contractorId: z.string().min(1),
  contractorType: z.enum(['walker', 'sitter', 'driver', 'trainer']),
  country: z.string().min(2).max(2),
  serviceAreas: z.array(z.string()).min(1),
  baseRate: z.number().positive(),
  currency: z.string().default('ILS'),
});

router.post('/generate/offer-letter', validateFirebaseToken, async (req, res) => {
  try {
    const data = generateOfferLetterSchema.parse(req.body);

    const contract = await contractGenerationService.generateOfferLetter(data);

    res.json({
      success: true,
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        partyBName: contract.partyBName,
        effectiveDate: contract.effectiveDate,
        signatureStatus: contract.signatureStatus,
      },
    });
  } catch (error: any) {
    console.error('[Contracts] Error generating offer letter:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to generate offer letter',
    });
  }
});

router.post('/generate/contractor-agreement', validateFirebaseToken, async (req, res) => {
  try {
    const data = generateContractorAgreementSchema.parse(req.body);

    const contract = await contractGenerationService.generateContractorAgreement(data);

    res.json({
      success: true,
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        partyBName: contract.partyBName,
        contractType: contract.contractType,
        effectiveDate: contract.effectiveDate,
        signatureStatus: contract.signatureStatus,
      },
    });
  } catch (error: any) {
    console.error('[Contracts] Error generating contractor agreement:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to generate contractor agreement',
    });
  }
});

router.get('/:contractId', validateFirebaseToken, async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);

    if (isNaN(contractId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contract ID',
      });
    }

    const contract = await contractGenerationService.getContract(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found',
      });
    }

    res.json({
      success: true,
      contract,
    });
  } catch (error: any) {
    console.error('[Contracts] Error fetching contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contract',
    });
  }
});

router.get('/:contractId/content', validateFirebaseToken, async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);

    if (isNaN(contractId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contract ID',
      });
    }

    const contract = await contractGenerationService.getContract(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found',
      });
    }

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `inline; filename="${contract.contractNumber}.md"`);
    res.send(contract.generatedContent);
  } catch (error: any) {
    console.error('[Contracts] Error fetching contract content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contract content',
    });
  }
});

router.get('/', validateFirebaseToken, async (req, res) => {
  try {
    const { contractType, signatureStatus, partyBEmail, limit } = req.query;

    const contracts = await contractGenerationService.listContracts({
      contractType: contractType as string | undefined,
      signatureStatus: signatureStatus as string | undefined,
      partyBEmail: partyBEmail as string | undefined,
      limit: limit ? parseInt(limit as string) : 50,
    });

    res.json({
      success: true,
      contracts: contracts.map(c => ({
        id: c.id,
        contractNumber: c.contractNumber,
        contractType: c.contractType,
        partyBName: c.partyBName,
        partyBEmail: c.partyBEmail,
        effectiveDate: c.effectiveDate,
        signatureStatus: c.signatureStatus,
        createdAt: c.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('[Contracts] Error listing contracts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list contracts',
    });
  }
});

router.post('/:contractId/send-for-signature', validateFirebaseToken, async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);

    if (isNaN(contractId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contract ID',
      });
    }

    const docusealApiKey = process.env.DOCUSEAL_API_KEY;
    const result = await contractGenerationService.sendForSignature(contractId, docusealApiKey);

    res.json({
      success: true,
      submissionId: result.submissionId,
      signUrl: result.signUrl,
    });
  } catch (error: any) {
    console.error('[Contracts] Error sending for signature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send contract for signature',
    });
  }
});

export default router;
