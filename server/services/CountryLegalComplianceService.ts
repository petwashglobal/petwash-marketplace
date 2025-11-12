/**
 * CountryLegalComplianceService - Multi-Country Legal Protocol Manager
 * 
 * Automatically updates legal requirements based on booking country:
 * - Privacy laws (GDPR, CCPA, Israeli Privacy Law)
 * - Tax regulations
 * - Consumer protection
 * - Insurance requirements
 * - Dispute resolution protocols
 * 
 * Countries supported: Israel (ISR), USA, UK, Australia (AUS), Canada (CAN)
 */

interface CountryLegalRequirements {
  countryCode: string;
  countryName: string;
  
  // Privacy & Data Protection
  privacyLaw: string;
  dataRetentionYears: number;
  requiresExplicitConsent: boolean;
  rightToForgotten: boolean;
  
  // Tax & Financial
  vatGstRate: number; // VAT/GST percentage
  brokerCommissionTaxable: boolean;
  requiresTaxId: boolean; // Does sitter need tax ID?
  
  // Consumer Protection
  cancellationGracePeriod: number; // Hours for full refund
  mandatoryInsurance: boolean;
  minInsuranceCoverage: number; // In local currency
  
  // Dispute Resolution
  arbitrationRequired: boolean;
  courtJurisdiction: string;
  
  // Sitter Requirements
  backgroundCheckRequired: boolean;
  backgroundCheckProvider?: string;
  minimumAge: number;
  
  // Platform Liability
  maxPlatformLiability: string; // Description of liability cap
  
  // Booking Terms
  termsUrl: string;
  privacyPolicyUrl: string;
  disclaimerUrl: string;
}

export class CountryLegalComplianceService {
  private legalRequirements: Map<string, CountryLegalRequirements>;

  constructor() {
    this.legalRequirements = new Map();
    this.initializeLegalRequirements();
  }

  /**
   * Initialize legal requirements for all supported countries
   */
  private initializeLegalRequirements(): void {
    // ISRAEL (ISR) - Primary Market
    this.legalRequirements.set('ISR', {
      countryCode: 'ISR',
      countryName: 'Israel',
      
      privacyLaw: 'Israeli Privacy Protection Law 5741-1981 (2025 Amendment)',
      dataRetentionYears: 7, // Israeli tax law requirement
      requiresExplicitConsent: true,
      rightToForgotten: true,
      
      vatGstRate: 17, // Israeli VAT
      brokerCommissionTaxable: true,
      requiresTaxId: true, // תעודת עוסק מורשה
      
      cancellationGracePeriod: 24, // 24 hours for full refund
      mandatoryInsurance: true,
      minInsuranceCoverage: 500000, // ₪500,000 ILS
      
      arbitrationRequired: true,
      courtJurisdiction: 'Tel Aviv-Yafo, Israel',
      
      backgroundCheckRequired: true,
      backgroundCheckProvider: 'Israeli Police Criminal Record Check',
      minimumAge: 18,
      
      maxPlatformLiability: '7.5% broker commission for specific booking',
      
      termsUrl: '/sitter-suite/terms-conditions',
      privacyPolicyUrl: '/sitter-suite/privacy-policy',
      disclaimerUrl: '/sitter-suite/disclaimer'
    });

    // UNITED STATES (USA)
    this.legalRequirements.set('USA', {
      countryCode: 'USA',
      countryName: 'United States',
      
      privacyLaw: 'California Consumer Privacy Act (CCPA) & State Privacy Laws',
      dataRetentionYears: 7, // IRS requirement
      requiresExplicitConsent: true,
      rightToForgotten: true, // CCPA right to deletion
      
      vatGstRate: 0, // No federal VAT (state sales tax varies)
      brokerCommissionTaxable: true,
      requiresTaxId: true, // EIN or SSN for 1099-K reporting
      
      cancellationGracePeriod: 48, // 48 hours standard
      mandatoryInsurance: true,
      minInsuranceCoverage: 1000000, // $1M USD liability
      
      arbitrationRequired: true,
      courtJurisdiction: 'State of California, USA',
      
      backgroundCheckRequired: true,
      backgroundCheckProvider: 'FBI National Background Check',
      minimumAge: 18,
      
      maxPlatformLiability: '7.5% broker commission for specific booking',
      
      termsUrl: '/sitter-suite/terms-conditions?country=USA',
      privacyPolicyUrl: '/sitter-suite/privacy-policy?country=USA',
      disclaimerUrl: '/sitter-suite/disclaimer?country=USA'
    });

    // UNITED KINGDOM (UK)
    this.legalRequirements.set('GBR', {
      countryCode: 'GBR',
      countryName: 'United Kingdom',
      
      privacyLaw: 'UK GDPR & Data Protection Act 2018',
      dataRetentionYears: 6, // HMRC requirement
      requiresExplicitConsent: true,
      rightToForgotten: true,
      
      vatGstRate: 20, // UK VAT
      brokerCommissionTaxable: true,
      requiresTaxId: true, // UTR (Unique Taxpayer Reference)
      
      cancellationGracePeriod: 24,
      mandatoryInsurance: true,
      minInsuranceCoverage: 1000000, // £1M GBP
      
      arbitrationRequired: false, // Consumer rights favor court
      courtJurisdiction: 'England and Wales',
      
      backgroundCheckRequired: true,
      backgroundCheckProvider: 'DBS (Disclosure and Barring Service)',
      minimumAge: 18,
      
      maxPlatformLiability: '7.5% broker commission for specific booking',
      
      termsUrl: '/sitter-suite/terms-conditions?country=GBR',
      privacyPolicyUrl: '/sitter-suite/privacy-policy?country=GBR',
      disclaimerUrl: '/sitter-suite/disclaimer?country=GBR'
    });

    // AUSTRALIA (AUS)
    this.legalRequirements.set('AUS', {
      countryCode: 'AUS',
      countryName: 'Australia',
      
      privacyLaw: 'Privacy Act 1988 (Australian Privacy Principles)',
      dataRetentionYears: 7, // ATO requirement
      requiresExplicitConsent: true,
      rightToForgotten: true,
      
      vatGstRate: 10, // Australian GST
      brokerCommissionTaxable: true,
      requiresTaxId: true, // ABN (Australian Business Number)
      
      cancellationGracePeriod: 24,
      mandatoryInsurance: true,
      minInsuranceCoverage: 1000000, // $1M AUD
      
      arbitrationRequired: false, // ACCC consumer protection
      courtJurisdiction: 'State of New South Wales, Australia',
      
      backgroundCheckRequired: true,
      backgroundCheckProvider: 'Australian National Police Check',
      minimumAge: 18,
      
      maxPlatformLiability: '7.5% broker commission for specific booking',
      
      termsUrl: '/sitter-suite/terms-conditions?country=AUS',
      privacyPolicyUrl: '/sitter-suite/privacy-policy?country=AUS',
      disclaimerUrl: '/sitter-suite/disclaimer?country=AUS'
    });

    // CANADA (CAN)
    this.legalRequirements.set('CAN', {
      countryCode: 'CAN',
      countryName: 'Canada',
      
      privacyLaw: 'PIPEDA (Personal Information Protection and Electronic Documents Act)',
      dataRetentionYears: 6, // CRA requirement
      requiresExplicitConsent: true,
      rightToForgotten: true,
      
      vatGstRate: 5, // Federal GST (provincial taxes vary)
      brokerCommissionTaxable: true,
      requiresTaxId: true, // Business Number (BN)
      
      cancellationGracePeriod: 24,
      mandatoryInsurance: true,
      minInsuranceCoverage: 2000000, // $2M CAD (higher due to liability climate)
      
      arbitrationRequired: false,
      courtJurisdiction: 'Province of Ontario, Canada',
      
      backgroundCheckRequired: true,
      backgroundCheckProvider: 'RCMP Criminal Record Check',
      minimumAge: 18,
      
      maxPlatformLiability: '7.5% broker commission for specific booking',
      
      termsUrl: '/sitter-suite/terms-conditions?country=CAN',
      privacyPolicyUrl: '/sitter-suite/privacy-policy?country=CAN',
      disclaimerUrl: '/sitter-suite/disclaimer?country=CAN'
    });

    console.log(`[LegalCompliance] ✅ Initialized legal requirements for ${this.legalRequirements.size} countries`);
  }

  /**
   * Get legal requirements for a specific country
   */
  getLegalRequirements(countryCode: string): CountryLegalRequirements {
    const requirements = this.legalRequirements.get(countryCode.toUpperCase());
    
    if (!requirements) {
      // Default to Israel if country not supported
      console.warn(`[LegalCompliance] ⚠️ Country ${countryCode} not supported, defaulting to Israel`);
      return this.legalRequirements.get('ISR')!;
    }
    
    return requirements;
  }

  /**
   * Check if a country is supported
   */
  isCountrySupported(countryCode: string): boolean {
    return this.legalRequirements.has(countryCode.toUpperCase());
  }

  /**
   * Get all supported countries
   */
  getSupportedCountries(): string[] {
    return Array.from(this.legalRequirements.keys());
  }

  /**
   * Calculate applicable tax for a booking based on country
   */
  calculateTax(basePriceCents: number, countryCode: string): {
    taxCents: number;
    taxRate: number;
    taxName: string;
  } {
    const requirements = this.getLegalRequirements(countryCode);
    const taxCents = Math.round(basePriceCents * (requirements.vatGstRate / 100));
    
    let taxName = 'Tax';
    if (countryCode === 'ISR') taxName = 'VAT (מע"ם)';
    else if (countryCode === 'USA') taxName = 'Sales Tax';
    else if (countryCode === 'GBR') taxName = 'VAT';
    else if (['AUS', 'CAN'].includes(countryCode)) taxName = 'GST';
    
    return {
      taxCents,
      taxRate: requirements.vatGstRate,
      taxName
    };
  }

  /**
   * Validate sitter meets country-specific requirements
   */
  validateSitterRequirements(sitter: {
    dateOfBirth: string;
    country: string;
    backgroundCheckStatus?: string;
    insuranceCertUrl?: string;
  }): {
    isValid: boolean;
    errors: string[];
  } {
    const requirements = this.getLegalRequirements(sitter.country);
    const errors: string[] = [];

    // Age validation
    const age = this.calculateAge(sitter.dateOfBirth);
    if (age < requirements.minimumAge) {
      errors.push(`Must be at least ${requirements.minimumAge} years old in ${requirements.countryName}`);
    }

    // Background check
    if (requirements.backgroundCheckRequired && sitter.backgroundCheckStatus !== 'passed') {
      errors.push(`Background check required: ${requirements.backgroundCheckProvider}`);
    }

    // Insurance
    if (requirements.mandatoryInsurance && !sitter.insuranceCertUrl) {
      errors.push(`Liability insurance required (minimum ${requirements.minInsuranceCoverage.toLocaleString()} coverage)`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Get country-specific disclaimer text
   */
  getDisclaimerText(countryCode: string): string {
    const requirements = this.getLegalRequirements(countryCode);
    
    return `
Pet Wash Ltd operates as a connector platform under the laws of ${requirements.countryName}.
Maximum liability is limited to ${requirements.maxPlatformLiability}.
Disputes are subject to ${requirements.arbitrationRequired ? 'binding arbitration' : 'court jurisdiction'} in ${requirements.courtJurisdiction}.
Data retention period: ${requirements.dataRetentionYears} years per ${requirements.privacyLaw}.
    `.trim();
  }
}

// Export singleton instance
export const countryLegalCompliance = new CountryLegalComplianceService();
