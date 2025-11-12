#!/bin/bash

echo "=========================================="
echo "COMPREHENSIVE FEATURE AUDIT"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

check_exists() {
  if [ -f "$1" ] || [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    return 0
  else
    echo -e "${RED}✗${NC} $1"
    return 1
  fi
}

total=0
found=0

echo "=== 5 BUSINESS UNITS ==="
((total++)); [ -f "server/routes/k9000.ts" ] && ((found++)) && check_exists "server/routes/k9000.ts"
((total++)); [ -f "server/routes/k9000Dashboard.ts" ] && ((found++)) && check_exists "server/routes/k9000Dashboard.ts"
((total++)); [ -f "client/src/pages/SitterSuite.tsx" ] && ((found++)) && check_exists "client/src/pages/SitterSuite.tsx"
((total++)); [ -f "server/routes/walk-my-pet.ts" ] && ((found++)) && check_exists "server/routes/walk-my-pet.ts"
((total++)); [ -f "server/routes/pettrek.ts" ] && ((found++)) && check_exists "server/routes/pettrek.ts"
((total++)); [ -f "client/src/pages/PlushLab.tsx" ] && ((found++)) && check_exists "client/src/pages/PlushLab.tsx"
echo ""

echo "=== AUTHENTICATION & SECURITY ==="
((total++)); [ -f "server/services/AuthService.ts" ] && ((found++)) && check_exists "server/services/AuthService.ts"
((total++)); [ -f "server/services/BiometricVerificationService.ts" ] && ((found++)) && check_exists "server/services/BiometricVerificationService.ts"
((total++)); [ -f "server/middleware/rbac.ts" ] && ((found++)) && check_exists "server/middleware/rbac.ts"
((total++)); [ -f "server/services/rbac.ts" ] && ((found++)) && check_exists "server/services/rbac.ts"
echo ""

echo "=== AI SYSTEMS ==="
((total++)); [ -f "server/gemini.ts" ] && ((found++)) && check_exists "server/gemini.ts"
((total++)); [ -f "server/services/ChatService.ts" ] && ((found++)) && check_exists "server/services/ChatService.ts"
((total++)); [ -f "server/services/GeminiWatchdogService.ts" ] && ((found++)) && check_exists "server/services/GeminiWatchdogService.ts"
((total++)); [ -f "server/services/ContentModerationService.ts" ] && ((found++)) && check_exists "server/services/ContentModerationService.ts"
((total++)); [ -f "server/services/SitterAITriageService.ts" ] && ((found++)) && check_exists "server/services/SitterAITriageService.ts"
echo ""

echo "=== PAYMENTS & FINANCIAL ==="
((total++)); [ -f "server/services/NayaxSparkService.ts" ] && ((found++)) && check_exists "server/services/NayaxSparkService.ts"
((total++)); [ -f "server/services/NayaxMonitoringService.ts" ] && ((found++)) && check_exists "server/services/NayaxMonitoringService.ts"
((total++)); [ -f "server/services/CurrencyService.ts" ] && ((found++)) && check_exists "server/services/CurrencyService.ts"
((total++)); [ -f "server/services/EscrowService.ts" ] && ((found++)) && check_exists "server/services/EscrowService.ts"
((total++)); [ -f "server/services/ReceiptOCRService.ts" ] && ((found++)) && check_exists "server/services/ReceiptOCRService.ts"
echo ""

echo "=== LOYALTY & WALLET ==="
((total++)); [ -f "server/services/UnifiedWalletService.ts" ] && ((found++)) && check_exists "server/services/UnifiedWalletService.ts"
((total++)); [ -f "server/services/WalletTelemetryService.ts" ] && ((found++)) && check_exists "server/services/WalletTelemetryService.ts"
echo ""

echo "=== E-SIGNATURE & CONTRACTS ==="
((total++)); [ -f "server/services/DocuSealService.ts" ] && ((found++)) && check_exists "server/services/DocuSealService.ts"
((total++)); [ -f "server/services/ContractGenerationService.ts" ] && ((found++)) && check_exists "server/services/ContractGenerationService.ts"
((total++)); [ -d "server/templates/contracts" ] && ((found++)) && check_exists "server/templates/contracts/"
echo ""

echo "=== K9000 IoT ==="
((total++)); [ -f "server/services/K9000TransactionService.ts" ] && ((found++)) && check_exists "server/services/K9000TransactionService.ts"
((total++)); [ -f "server/services/K9000PredictiveMaintenanceService.ts" ] && ((found++)) && check_exists "server/services/K9000PredictiveMaintenanceService.ts"
echo ""

echo "=== KYC & VERIFICATION ==="
((total++)); [ -f "server/services/PassportOCRService.ts" ] && ((found++)) && check_exists "server/services/PassportOCRService.ts"
((total++)); [ -f "server/services/CertificateVerificationService.ts" ] && ((found++)) && check_exists "server/services/CertificateVerificationService.ts"
echo ""

echo "=== MULTI-JURISDICTION TAX ==="
((total++)); [ -f "server/services/IsraeliTaxAPIService.ts" ] && ((found++)) && check_exists "server/services/IsraeliTaxAPIService.ts"
((total++)); [ -f "server/services/ITAComplianceMonitoringService.ts" ] && ((found++)) && check_exists "server/services/ITAComplianceMonitoringService.ts"
((total++)); [ -f "server/services/IsraeliVATReclaimService.ts" ] && ((found++)) && check_exists "server/services/IsraeliVATReclaimService.ts"
((total++)); [ -f "server/services/USTaxComplianceService.ts" ] && ((found++)) && check_exists "server/services/USTaxComplianceService.ts"
((total++)); [ -f "server/services/CanadianTaxComplianceService.ts" ] && ((found++)) && check_exists "server/services/CanadianTaxComplianceService.ts"
((total++)); [ -f "server/services/UKTaxComplianceService.ts" ] && ((found++)) && check_exists "server/services/UKTaxComplianceService.ts"
((total++)); [ -f "server/services/AustralianTaxComplianceService.ts" ] && ((found++)) && check_exists "server/services/AustralianTaxComplianceService.ts"
((total++)); [ -f "server/services/ElectronicInvoicingService.ts" ] && ((found++)) && check_exists "server/services/ElectronicInvoicingService.ts"
echo ""

echo "=== WEATHER & ENVIRONMENTAL ==="
((total++)); [ -f "server/services/MultiSourceWeatherService.ts" ] && ((found++)) && check_exists "server/services/MultiSourceWeatherService.ts"
((total++)); [ -f "server/services/SmartEnvironmentService.ts" ] && ((found++)) && check_exists "server/services/SmartEnvironmentService.ts"
((total++)); [ -f "server/services/OpenMeteoAirQualityService.ts" ] && ((found++)) && check_exists "server/services/OpenMeteoAirQualityService.ts"
((total++)); [ -f "server/services/CurrentUVIndexService.ts" ] && ((found++)) && check_exists "server/services/CurrentUVIndexService.ts"
echo ""

echo "=== STAFF & HR ==="
((total++)); [ -f "server/services/StaffOnboardingService.ts" ] && ((found++)) && check_exists "server/services/StaffOnboardingService.ts"
((total++)); [ -f "server/services/expensePolicyService.ts" ] && ((found++)) && check_exists "server/services/expensePolicyService.ts"
((total++)); [ -f "server/services/GPSTrackingService.ts" ] && ((found++)) && check_exists "server/services/GPSTrackingService.ts"
echo ""

echo "=== MULTI-LANGUAGE ==="
((total++)); [ -f "server/services/LanguageContextService.ts" ] && ((found++)) && check_exists "server/services/LanguageContextService.ts"
((total++)); [ -f "server/services/TranslationService.ts" ] && ((found++)) && check_exists "server/services/TranslationService.ts"
((total++)); [ -f "server/services/geminiTranslation.ts" ] && ((found++)) && check_exists "server/services/geminiTranslation.ts"
((total++)); [ -f "client/src/lib/i18n.ts" ] && ((found++)) && check_exists "client/src/lib/i18n.ts"
echo ""

echo "=== GOOGLE SERVICES ==="
((total++)); [ -f "server/services/GoogleCalendarIntegrationService.ts" ] && ((found++)) && check_exists "server/services/GoogleCalendarIntegrationService.ts"
((total++)); [ -f "server/services/googleSheetsIntegration.ts" ] && ((found++)) && check_exists "server/services/googleSheetsIntegration.ts"
echo ""

echo "=== COMPLIANCE ==="
((total++)); [ -f "server/services/AuditLedgerService.ts" ] && ((found++)) && check_exists "server/services/AuditLedgerService.ts"
((total++)); [ -f "server/services/CountryLegalComplianceService.ts" ] && ((found++)) && check_exists "server/services/CountryLegalComplianceService.ts"
((total++)); [ -f "server/services/ConsentService.ts" ] && ((found++)) && check_exists "server/services/ConsentService.ts"
echo ""

echo "=== MESSAGING ==="
((total++)); [ -f "server/services/WhatsAppService.ts" ] && ((found++)) && check_exists "server/services/WhatsAppService.ts"
((total++)); [ -f "server/services/WhatsAppMetaService.ts" ] && ((found++)) && check_exists "server/services/WhatsAppMetaService.ts"
((total++)); [ -f "server/services/NotificationService.ts" ] && ((found++)) && check_exists "server/services/NotificationService.ts"
((total++)); [ -f "server/services/FCMService.ts" ] && ((found++)) && check_exists "server/services/FCMService.ts"
echo ""

echo "=== PERFORMANCE & MONITORING ==="
((total++)); [ -f "scripts/load-test.js" ] && ((found++)) && check_exists "scripts/load-test.js"
((total++)); [ -f "server/services/SystemStatusReportService.ts" ] && ((found++)) && check_exists "server/services/SystemStatusReportService.ts"
echo ""

echo "=== DATABASE SCHEMAS ==="
((total++)); [ -f "shared/schema.ts" ] && ((found++)) && check_exists "shared/schema.ts"
((total++)); [ -f "shared/schema-enterprise.ts" ] && ((found++)) && check_exists "shared/schema-enterprise.ts"
((total++)); [ -f "shared/schema-finance.ts" ] && ((found++)) && check_exists "shared/schema-finance.ts"
((total++)); [ -f "shared/schema-franchise.ts" ] && ((found++)) && check_exists "shared/schema-franchise.ts"
((total++)); [ -f "shared/schema-hr.ts" ] && ((found++)) && check_exists "shared/schema-hr.ts"
((total++)); [ -f "shared/schema-compliance.ts" ] && ((found++)) && check_exists "shared/schema-compliance.ts"
((total++)); [ -f "shared/schema-chat.ts" ] && ((found++)) && check_exists "shared/schema-chat.ts"
echo ""

echo "=========================================="
echo "RESULTS: $found / $total features verified"
percentage=$((found * 100 / total))
echo "Completion: $percentage%"
echo "=========================================="
