/**
 * Global Configuration Service for The Sitter Suite™
 * Manages multi-country operations, regulatory compliance, and localization
 * Like Booking.com - supports USA, ISR, UK, AUS, CAN with country-specific rules
 */

interface CountrySettings {
  country: string;
  currency: string;
  defaultLanguage: string;
  vettingApi: string;
  taxRate: number;
  holidayPeriods: { start: string; end: string; name: string }[];
}

interface VettingPartners {
  ISR: string;
  USA: string;
  UK: string;
  AUS: string;
  CAN: string;
}

export class SitterGlobalConfig {
  private readonly supportedCountries = ["USA", "ISR", "UK", "AUS", "CAN"];
  private readonly defaultCurrency = "USD";
  private readonly globalCommissionRate = 0.10; // 10% platform fee (5% hidden broker fee built into sitter rate)
  
  private readonly vettingPartners: VettingPartners = {
    ISR: "Israeli_ID_Verification_API", // Teudat Zehut scanner
    USA: "US_Background_Check_API", // SSN-based criminal check
    UK: "UK_DBS_Check_API", // Disclosure and Barring Service
    AUS: "AUS_National_Police_Check", // 100-point ID check
    CAN: "CAN_RCMP_Check", // RCMP criminal record check
  };

  /**
   * Determines country from IP address and returns localized settings
   * Critical for automatic currency, language, and vetting requirements
   */
  getLocalSettings(ipAddress: string): CountrySettings {
    const countryCode = this.determineCountryFromIP(ipAddress);
    
    // Israel-specific settings
    if (countryCode === "ISR") {
      return {
        country: "Israel",
        currency: "ILS",
        defaultLanguage: "Hebrew",
        vettingApi: this.vettingPartners.ISR,
        taxRate: 0.18, // Israeli VAT
        holidayPeriods: [
          { start: "2025-09-21", end: "2025-09-30", name: "High Holidays" },
          { start: "2025-12-20", end: "2026-01-05", name: "Hanukkah/New Year" },
        ],
      };
    }
    
    // USA-specific settings
    if (countryCode === "USA") {
      return {
        country: "United States",
        currency: "USD",
        defaultLanguage: "English",
        vettingApi: this.vettingPartners.USA,
        taxRate: 0.0, // Tax handled by state
        holidayPeriods: [
          { start: "2025-11-22", end: "2025-11-30", name: "Thanksgiving" },
          { start: "2025-12-20", end: "2026-01-05", name: "Christmas/New Year" },
        ],
      };
    }

    // UK-specific settings
    if (countryCode === "UK") {
      return {
        country: "United Kingdom",
        currency: "GBP",
        defaultLanguage: "English",
        vettingApi: this.vettingPartners.UK,
        taxRate: 0.20, // UK VAT
        holidayPeriods: [
          { start: "2025-12-20", end: "2026-01-05", name: "Christmas" },
        ],
      };
    }

    // Australia-specific settings
    if (countryCode === "AUS") {
      return {
        country: "Australia",
        currency: "AUD",
        defaultLanguage: "English",
        vettingApi: this.vettingPartners.AUS,
        taxRate: 0.10, // GST
        holidayPeriods: [
          { start: "2025-12-20", end: "2026-01-31", name: "Summer Holidays" },
        ],
      };
    }

    // Canada-specific settings
    if (countryCode === "CAN") {
      return {
        country: "Canada",
        currency: "CAD",
        defaultLanguage: "English",
        vettingApi: this.vettingPartners.CAN,
        taxRate: 0.13, // Average HST
        holidayPeriods: [
          { start: "2025-12-20", end: "2026-01-05", name: "Christmas/New Year" },
        ],
      };
    }

    // Default global settings
    return {
      country: "Global",
      currency: this.defaultCurrency,
      defaultLanguage: "English",
      vettingApi: "Generic_ID_Check",
      taxRate: 0.0,
      holidayPeriods: [],
    };
  }

  /**
   * Determines country code from IP address
   * Production: Would use MaxMind GeoIP2 or similar
   */
  private determineCountryFromIP(ipAddress: string): string {
    // Israeli IP ranges (simplified - production would use GeoIP database)
    if (ipAddress.startsWith("109.253.") || 
        ipAddress.startsWith("82.81.") ||
        ipAddress.startsWith("37.142.") ||
        ipAddress.startsWith("5.29.")) {
      return "ISR";
    }
    
    // US IP ranges
    if (ipAddress.startsWith("4.") || 
        ipAddress.startsWith("8.8.") ||
        ipAddress.startsWith("192.0.")) {
      return "USA";
    }

    // UK IP ranges
    if (ipAddress.startsWith("81.") || ipAddress.startsWith("86.")) {
      return "UK";
    }

    // Australian IP ranges
    if (ipAddress.startsWith("1.") || ipAddress.startsWith("101.")) {
      return "AUS";
    }

    // Canadian IP ranges
    if (ipAddress.startsWith("24.") || ipAddress.startsWith("142.")) {
      return "CAN";
    }

    return "Global";
  }

  /**
   * Check if booking dates fall within holiday surge period
   * Used for dynamic pricing (1.5x multiplier during holidays)
   */
  isHolidayPeriod(startDate: Date, endDate: Date, countryCode: string): boolean {
    const localSettings = this.getLocalSettings(countryCode);
    
    for (const holiday of localSettings.holidayPeriods) {
      const holidayStart = new Date(holiday.start);
      const holidayEnd = new Date(holiday.end);
      
      // Check if booking overlaps with holiday period
      if (startDate <= holidayEnd && endDate >= holidayStart) {
        return true;
      }
    }
    
    return false;
  }

  getCommissionRate(): number {
    return this.globalCommissionRate;
  }

  getSupportedCountries(): string[] {
    return this.supportedCountries;
  }
}

// Singleton instance
export const globalConfig = new SitterGlobalConfig();
