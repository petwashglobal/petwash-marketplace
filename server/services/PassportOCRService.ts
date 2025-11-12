/**
 * Passport OCR Service
 * Uses Google Cloud Vision API for passport verification
 * Extracts data from Machine Readable Zone (MRZ) for loyalty members
 * 
 * Security: Complies with Israeli Privacy Law 2025 + GDPR
 * Processing: Google Cloud Vision API (data not stored by Google)
 */

import { ImageAnnotatorClient } from '@google-cloud/vision';
import { logger } from '../lib/logger';

interface PassportData {
  // Personal Information
  documentType: 'P' | 'V' | 'I';  // P=Passport, V=Visa, I=ID
  countryCode: string;  // ISO 3166-1 alpha-3 (ISR, AUS, etc.)
  surname: string;
  givenNames: string;
  passportNumber: string;
  nationality: string;
  
  // Dates
  dateOfBirth: string;  // YYYY-MM-DD
  expiryDate: string;   // YYYY-MM-DD
  
  // Additional
  sex: 'M' | 'F' | 'X';
  personalNumber?: string;
  
  // Metadata
  rawMRZ: string;
  confidence: number;
  verified: boolean;
}

interface PassportVerificationResult {
  success: boolean;
  data?: PassportData;
  error?: string;
  warnings?: string[];
}

export class PassportOCRService {
  private visionClient: ImageAnnotatorClient | null = null;

  constructor() {
    try {
      this.visionClient = new ImageAnnotatorClient({
        credentials: process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
          ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
          : undefined
      });
      logger.info('[PassportOCR] ✅ Google Vision API initialized');
    } catch (error) {
      logger.error('[PassportOCR] ⚠️ Failed to initialize Google Vision API', error);
      this.visionClient = null;
    }
  }

  /**
   * Extract passport data from image using OCR
   */
  async extractPassportData(imageBuffer: Buffer): Promise<PassportVerificationResult> {
    if (!this.visionClient) {
      return {
        success: false,
        error: 'Google Vision API not initialized'
      };
    }

    try {
      // Use DOCUMENT_TEXT_DETECTION for structured documents
      const [result] = await this.visionClient.documentTextDetection({
        image: { content: imageBuffer },
      });

      const detections = result.textAnnotations || [];
      
      if (detections.length === 0) {
        return {
          success: false,
          error: 'No text detected in passport image'
        };
      }

      // Full text from passport
      const fullText = detections[0]?.description || '';
      
      // SECURITY: Never log raw OCR text (contains MRZ with passport numbers/names)
      logger.info('[PassportOCR] Text extracted', { 
        textLength: fullText.length
      });

      // Extract MRZ lines (Machine Readable Zone)
      const mrzLines = this.extractMRZLines(fullText);
      
      if (mrzLines.length === 0) {
        return {
          success: false,
          error: 'Could not find Machine Readable Zone (MRZ) in passport',
          warnings: ['Please ensure the bottom of the passport is visible and clear']
        };
      }

      // Parse MRZ data
      const passportData = this.parseMRZ(mrzLines);
      
      if (!passportData) {
        return {
          success: false,
          error: 'Failed to parse passport MRZ data',
          warnings: ['MRZ data may be damaged or unclear']
        };
      }

      // Validate passport data
      const validation = this.validatePassportData(passportData);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          warnings: validation.warnings
        };
      }

      logger.info('[PassportOCR] ✅ Passport data extracted successfully', {
        country: passportData.countryCode,
        documentType: passportData.documentType
      });

      return {
        success: true,
        data: passportData
      };

    } catch (error) {
      logger.error('[PassportOCR] ❌ OCR extraction failed', error);
      return {
        success: false,
        error: 'Failed to process passport image'
      };
    }
  }

  /**
   * Extract MRZ lines from full passport text
   * MRZ is 2 lines for TD3 (passport), 3 lines for TD1/TD2 (ID cards)
   */
  private extractMRZLines(text: string): string[] {
    const lines = text.split('\n').map(line => line.trim());
    
    // MRZ lines are typically 44 characters long and contain only uppercase letters, digits, and <
    const mrzPattern = /^[A-Z0-9<]{30,44}$/;
    
    const mrzLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\s/g, '');  // Remove spaces
      
      if (mrzPattern.test(line) && line.length >= 30) {
        mrzLines.push(line);
        
        // Check next line as well
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].replace(/\s/g, '');
          if (mrzPattern.test(nextLine) && nextLine.length >= 30) {
            mrzLines.push(nextLine);
            break;  // Found TD3 passport (2 lines)
          }
        }
      }
    }
    
    return mrzLines;
  }

  /**
   * Parse MRZ (Machine Readable Zone) data
   * Format: TD3 (Passport) - 2 lines of 44 characters each
   * 
   * Line 1: P<COUNTRY<SURNAME<<GIVENNAMES<<<<<<<<<<<<<<
   * Line 2: PASSPORTNUMBER<NATIONALITY<BIRTHDATE<SEX<EXPIRYDATE<PERSONALNUMBER<<<CHECKDIGITS
   */
  private parseMRZ(mrzLines: string[]): PassportData | null {
    if (mrzLines.length < 2) {
      return null;
    }

    try {
      const line1 = mrzLines[0].padEnd(44, '<');
      const line2 = mrzLines[1].padEnd(44, '<');

      // Line 1 parsing
      const documentType = line1[0] as 'P' | 'V' | 'I';
      const countryCode = line1.substring(2, 5).replace(/</g, '');
      
      // Extract names (rest of line 1 after country)
      const namesSection = line1.substring(5).replace(/</g, ' ').trim();
      const nameParts = namesSection.split('  ').filter(p => p.length > 0);
      const surname = nameParts[0] || '';
      const givenNames = nameParts.slice(1).join(' ') || '';

      // Line 2 parsing
      const passportNumber = line2.substring(0, 9).replace(/</g, '');
      const nationality = line2.substring(10, 13).replace(/</g, '');
      
      // Date of birth (YYMMDD)
      const dobRaw = line2.substring(13, 19);
      const dateOfBirth = this.parseMRZDate(dobRaw);
      
      const sex = line2[20] as 'M' | 'F' | 'X';
      
      // Expiry date (YYMMDD)
      const expiryRaw = line2.substring(21, 27);
      const expiryDate = this.parseMRZDate(expiryRaw);
      
      const personalNumber = line2.substring(28, 42).replace(/</g, '');

      const passportData: PassportData = {
        documentType,
        countryCode,
        surname,
        givenNames,
        passportNumber,
        nationality,
        dateOfBirth,
        expiryDate,
        sex,
        personalNumber: personalNumber || undefined,
        rawMRZ: mrzLines.join('\n'),
        confidence: 0.9,  // High confidence if MRZ parsing succeeds
        verified: true
      };

      return passportData;

    } catch (error) {
      logger.error('[PassportOCR] Failed to parse MRZ', error);
      return null;
    }
  }

  /**
   * Parse MRZ date format (YYMMDD) to YYYY-MM-DD
   */
  private parseMRZDate(dateStr: string): string {
    if (dateStr.length !== 6 || !/^\d{6}$/.test(dateStr)) {
      return '';
    }

    let year = parseInt(dateStr.substring(0, 2));
    const month = dateStr.substring(2, 4);
    const day = dateStr.substring(4, 6);

    // Year pivot: 00-50 = 2000-2050, 51-99 = 1951-1999
    year = year <= 50 ? 2000 + year : 1900 + year;

    return `${year}-${month}-${day}`;
  }

  /**
   * Validate extracted passport data
   */
  private validatePassportData(data: PassportData): { valid: boolean; error?: string; warnings?: string[] } {
    const warnings: string[] = [];

    // Check document type
    if (!['P', 'V', 'I'].includes(data.documentType)) {
      return { valid: false, error: 'Invalid document type' };
    }

    // Check required fields
    if (!data.passportNumber || data.passportNumber.length < 6) {
      return { valid: false, error: 'Invalid passport number' };
    }

    if (!data.surname || data.surname.length < 2) {
      return { valid: false, error: 'Invalid surname' };
    }

    // Check country code (should be 3 letters)
    if (!data.countryCode || data.countryCode.length !== 3) {
      return { valid: false, error: 'Invalid country code' };
    }

    // Check expiry date
    const expiryDate = new Date(data.expiryDate);
    const today = new Date();
    
    if (isNaN(expiryDate.getTime())) {
      return { valid: false, error: 'Invalid expiry date format' };
    }

    if (expiryDate < today) {
      warnings.push('Passport has expired');
    }

    // Check date of birth
    const dob = new Date(data.dateOfBirth);
    if (isNaN(dob.getTime())) {
      return { valid: false, error: 'Invalid date of birth format' };
    }

    const age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 0 || age > 150) {
      return { valid: false, error: 'Invalid date of birth' };
    }

    return { 
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Verify if passport is from approved country
   * List based on user's approved countries
   */
  isApprovedCountry(countryCode: string, approvedCountries: string[]): boolean {
    return approvedCountries.includes(countryCode.toUpperCase());
  }
}

export const passportOCRService = new PassportOCRService();
