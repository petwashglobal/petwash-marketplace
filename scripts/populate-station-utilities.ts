// Populate Station Utilities (Electricity, Internet, Insurance)
// Run with: tsx scripts/populate-station-utilities.ts

import { db } from '../server/db';
import { stationBills } from '../shared/schema-enterprise';
import { logger } from '../server/lib/logger';

const utilityBills = [
  // Tel Aviv Station 1 (IL-TA-001)
  {
    stationId: 1,
    billType: 'electricity',
    vendor: 'Israel Electric Corporation (IEC)',
    accountNumber: 'IEC-1234567-8',
    billingPeriod: 'October 2025',
    dueDate: new Date('2025-11-10'),
    periodStart: new Date('2025-10-01'),
    periodEnd: new Date('2025-10-31'),
    amount: 1250.00,
    currency: 'ILS',
    vat: 212.50,
    totalAmount: 1462.50,
    status: 'unpaid',
    usageAmount: 850,
    usageUnit: 'kWh',
    unitPrice: 1.47,
    autoPayEnabled: true
  },
  {
    stationId: 1,
    billType: 'internet',
    vendor: 'Bezeq International',
    accountNumber: 'BZQ-88776655',
    billingPeriod: 'October 2025',
    dueDate: new Date('2025-11-05'),
    periodStart: new Date('2025-10-01'),
    periodEnd: new Date('2025-10-31'),
    amount: 149.00,
    currency: 'ILS',
    vat: 25.33,
    totalAmount: 174.33,
    status: 'paid',
    paidDate: new Date('2025-10-28'),
    paidAmount: 174.33,
    paymentMethod: 'auto_debit',
    usageAmount: 1000,
    usageUnit: 'GB',
    autoPayEnabled: true
  },
  {
    stationId: 1,
    billType: 'insurance',
    vendor: 'Menorah Mivtachim Insurance',
    accountNumber: 'MMI-PWASH-001',
    billingPeriod: 'Annual 2025-2026',
    dueDate: new Date('2025-12-01'),
    periodStart: new Date('2025-11-01'),
    periodEnd: new Date('2026-10-31'),
    amount: 8500.00,
    currency: 'ILS',
    vat: 0,
    totalAmount: 8500.00,
    status: 'unpaid',
    notes: 'Comprehensive commercial property & liability insurance',
    autoPayEnabled: false
  },
  
  // Tel Aviv Station 2 (IL-TA-002)
  {
    stationId: 2,
    billType: 'electricity',
    vendor: 'Israel Electric Corporation (IEC)',
    accountNumber: 'IEC-9876543-2',
    billingPeriod: 'October 2025',
    dueDate: new Date('2025-11-12'),
    periodStart: new Date('2025-10-01'),
    periodEnd: new Date('2025-10-31'),
    amount: 1420.00,
    currency: 'ILS',
    vat: 241.40,
    totalAmount: 1661.40,
    status: 'pending',
    usageAmount: 965,
    usageUnit: 'kWh',
    unitPrice: 1.47,
    autoPayEnabled: true
  },
  {
    stationId: 2,
    billType: 'internet',
    vendor: 'Partner Communications',
    accountNumber: 'PTR-11223344',
    billingPeriod: 'October 2025',
    dueDate: new Date('2025-11-08'),
    periodStart: new Date('2025-10-01'),
    periodEnd: new Date('2025-10-31'),
    amount: 179.00,
    currency: 'ILS',
    vat: 30.43,
    totalAmount: 209.43,
    status: 'paid',
    paidDate: new Date('2025-10-25'),
    paidAmount: 209.43,
    paymentMethod: 'credit_card',
    usageAmount: 1500,
    usageUnit: 'GB',
    autoPayEnabled: true
  },
  {
    stationId: 2,
    billType: 'insurance',
    vendor: 'Harel Insurance',
    accountNumber: 'HAREL-PW-002',
    billingPeriod: 'Annual 2025-2026',
    dueDate: new Date('2025-11-15'),
    periodStart: new Date('2025-10-01'),
    periodEnd: new Date('2026-09-30'),
    amount: 9200.00,
    currency: 'ILS',
    vat: 0,
    totalAmount: 9200.00,
    status: 'paid',
    paidDate: new Date('2025-10-15'),
    paidAmount: 9200.00,
    paymentMethod: 'bank_transfer',
    notes: 'Premium coverage with equipment protection',
    autoPayEnabled: false
  },
  
  // San Francisco Station (US-CA-001)
  {
    stationId: 3,
    billType: 'electricity',
    vendor: 'Pacific Gas & Electric (PG&E)',
    accountNumber: 'PGE-555-123456',
    billingPeriod: 'October 2025',
    dueDate: new Date('2025-11-15'),
    periodStart: new Date('2025-10-01'),
    periodEnd: new Date('2025-10-31'),
    amount: 285.00,
    currency: 'USD',
    vat: 0,
    totalAmount: 285.00,
    status: 'paid',
    paidDate: new Date('2025-10-30'),
    paidAmount: 285.00,
    paymentMethod: 'auto_debit',
    usageAmount: 720,
    usageUnit: 'kWh',
    unitPrice: 0.396,
    autoPayEnabled: true
  },
  {
    stationId: 3,
    billType: 'internet',
    vendor: 'AT&T Business',
    accountNumber: 'ATT-BUS-78901',
    billingPeriod: 'October 2025',
    dueDate: new Date('2025-11-10'),
    periodStart: new Date('2025-10-01'),
    periodEnd: new Date('2025-10-31'),
    amount: 89.99,
    currency: 'USD',
    vat: 0,
    totalAmount: 89.99,
    status: 'paid',
    paidDate: new Date('2025-10-28'),
    paidAmount: 89.99,
    paymentMethod: 'credit_card',
    usageAmount: 800,
    usageUnit: 'GB',
    autoPayEnabled: true
  },
  {
    stationId: 3,
    billType: 'insurance',
    vendor: 'Hartford Business Insurance',
    accountNumber: 'HTFD-COM-9987',
    billingPeriod: 'Annual 2025-2026',
    dueDate: new Date('2025-12-01'),
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-12-31'),
    amount: 3800.00,
    currency: 'USD',
    vat: 0,
    totalAmount: 3800.00,
    status: 'unpaid',
    notes: 'General liability + property insurance',
    autoPayEnabled: false
  },
  
  // New York Station (US-NY-001)
  {
    stationId: 4,
    billType: 'electricity',
    vendor: 'Con Edison',
    accountNumber: 'CONED-NY-445566',
    billingPeriod: 'October 2025',
    dueDate: new Date('2025-11-18'),
    periodStart: new Date('2025-10-01'),
    periodEnd: new Date('2025-10-31'),
    amount: 412.00,
    currency: 'USD',
    vat: 0,
    totalAmount: 412.00,
    status: 'overdue',
    usageAmount: 1050,
    usageUnit: 'kWh',
    unitPrice: 0.392,
    notes: 'Payment reminder sent',
    autoPayEnabled: false
  },
  {
    stationId: 4,
    billType: 'internet',
    vendor: 'Verizon Business',
    accountNumber: 'VZ-BIZ-33445',
    billingPeriod: 'October 2025',
    dueDate: new Date('2025-11-12'),
    periodStart: new Date('2025-10-01'),
    periodEnd: new Date('2025-10-31'),
    amount: 99.99,
    currency: 'USD',
    vat: 0,
    totalAmount: 99.99,
    status: 'paid',
    paidDate: new Date('2025-10-29'),
    paidAmount: 99.99,
    paymentMethod: 'auto_debit',
    usageAmount: 1200,
    usageUnit: 'GB',
    autoPayEnabled: true
  },
  {
    stationId: 4,
    billType: 'insurance',
    vendor: 'State Farm Business',
    accountNumber: 'SF-BUS-7788990',
    billingPeriod: 'Annual 2025-2026',
    dueDate: new Date('2025-11-20'),
    periodStart: new Date('2025-12-01'),
    periodEnd: new Date('2026-11-30'),
    amount: 4200.00,
    currency: 'USD',
    vat: 0,
    totalAmount: 4200.00,
    status: 'pending',
    notes: 'Awaiting renewal confirmation',
    autoPayEnabled: false
  },
  
  // London Station (GB-LON-001)
  {
    stationId: 5,
    billType: 'electricity',
    vendor: 'British Gas Business',
    accountNumber: 'BG-BUS-998877',
    billingPeriod: 'October 2025',
    dueDate: new Date('2025-11-14'),
    periodStart: new Date('2025-10-01'),
    periodEnd: new Date('2025-10-31'),
    amount: 285.00,
    currency: 'GBP',
    vat: 57.00,
    totalAmount: 342.00,
    status: 'paid',
    paidDate: new Date('2025-10-27'),
    paidAmount: 342.00,
    paymentMethod: 'direct_debit',
    usageAmount: 780,
    usageUnit: 'kWh',
    unitPrice: 0.365,
    autoPayEnabled: true
  },
  {
    stationId: 5,
    billType: 'internet',
    vendor: 'BT Business',
    accountNumber: 'BT-BIZ-665544',
    billingPeriod: 'October 2025',
    dueDate: new Date('2025-11-10'),
    periodStart: new Date('2025-10-01'),
    periodEnd: new Date('2025-10-31'),
    amount: 45.00,
    currency: 'GBP',
    vat: 9.00,
    totalAmount: 54.00,
    status: 'paid',
    paidDate: new Date('2025-10-26'),
    paidAmount: 54.00,
    paymentMethod: 'direct_debit',
    usageAmount: 900,
    usageUnit: 'GB',
    autoPayEnabled: true
  },
  {
    stationId: 5,
    billType: 'insurance',
    vendor: 'Aviva Business Insurance',
    accountNumber: 'AVIVA-COM-112233',
    billingPeriod: 'Annual 2025-2026',
    dueDate: new Date('2025-11-30'),
    periodStart: new Date('2025-11-01'),
    periodEnd: new Date('2026-10-31'),
    amount: 2800.00,
    currency: 'GBP',
    vat: 0,
    totalAmount: 2800.00,
    status: 'unpaid',
    notes: 'Comprehensive business insurance with public liability',
    autoPayEnabled: false
  }
];

async function seedUtilities() {
  try {
    logger.info('🔌 Starting to seed station utilities (electricity, internet, insurance)...');
    
    for (const bill of utilityBills) {
      const [inserted] = await db.insert(stationBills).values(bill).returning();
      logger.info(`✅ Created ${bill.billType} bill for station ${bill.stationId}: ${bill.vendor} - ${bill.currency} ${bill.totalAmount}`);
    }
    
    logger.info('✅ All station utilities seeded successfully!');
    logger.info(`📊 Summary:
      - ${utilityBills.filter(b => b.billType === 'electricity').length} electricity bills
      - ${utilityBills.filter(b => b.billType === 'internet').length} internet bills
      - ${utilityBills.filter(b => b.billType === 'insurance').length} insurance bills
      - Total: ${utilityBills.length} bills across ${new Set(utilityBills.map(b => b.stationId)).size} stations
    `);
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to seed utilities:', error);
    process.exit(1);
  }
}

seedUtilities();
