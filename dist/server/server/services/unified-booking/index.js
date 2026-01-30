/**
 * PETWASH UNIFIED BOOKING SYSTEM
 * ===============================
 * Single source of truth for all booking operations
 *
 * SYSTEM GUARANTEES:
 * - Every wash, paid or free, has a Booking
 * - Every Booking has exactly one primary Transaction
 * - Transactions are immutable
 * - Admin actions are logged as Events
 * - HR and Finance rely on the same data
 * - Human and Machine are both Resources
 * - Frontend never bypasses backend truth
 */
export { UnifiedBookingEngine, unifiedBookingEngine } from './UnifiedBookingEngine';
export { TransactionStampService, transactionStampService } from './TransactionStampService';
export { EventLogService, eventLogService } from './EventLogService';
export * from './types';
