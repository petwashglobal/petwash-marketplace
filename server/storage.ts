import {
  users,
  customers,
  customerPets,
  washPackages,
  eVouchers,
  eVoucherRedemptions,
  washHistory,
  coupons,
  userCoupons,
  adminUsers,
  adminActivityLogs,
  inventoryItems,
  hrDocuments,
  loyaltyAnalytics,
  smartWashReceipts,
  // CRM tables
  crmLeads,
  crmCommunications,
  crmDealStages,
  crmOpportunities,
  crmTasks,
  crmActivities,
  crmCampaigns,
  crmCampaignTargets,
  crmCampaignMetrics,
  crmCustomerSegments,
  crmCustomerSegmentMembers,
  crmCustomerInsights,
  crmTouchpoints,
  // Communication Center tables
  crmEmailTemplates,
  crmSmsTemplates,
  crmAppointmentReminders,
  crmCommunicationLogs,
  type User,
  type UpsertUser,
  type Customer,
  type InsertCustomer,
  type WashPackage,
  type InsertWashPackage,
  type EVoucher,
  type InsertEVoucher,
  type EVoucherRedemption,
  type InsertEVoucherRedemption,
  type GiftCard,
  type InsertGiftCard,
  type WashHistory,
  type InsertWashHistory,
  type Coupon,
  type InsertCoupon,
  type AdminUser,
  type InsertAdminUser,
  type AdminActivityLog,
  type InsertAdminActivityLog,
  type InventoryItem,
  type InsertInventoryItem,
  type HRDocument,
  type InsertHRDocument,
  type LoyaltyAnalytics,
  type InsertLoyaltyAnalytics,
  type SmartWashReceipt,
  type InsertSmartWashReceipt,
  // CRM types
  type CrmLead,
  type InsertCrmLead,
  type CrmCommunication,
  type InsertCrmCommunication,
  type CrmDealStage,
  type InsertCrmDealStage,
  type CrmOpportunity,
  type InsertCrmOpportunity,
  type CrmTask,
  type InsertCrmTask,
  type CrmActivity,
  type InsertCrmActivity,
  type CrmCampaign,
  type InsertCrmCampaign,
  type CrmCampaignTarget,
  type InsertCrmCampaignTarget,
  type CrmCampaignMetrics,
  type InsertCrmCampaignMetrics,
  type CrmCustomerSegment,
  type InsertCrmCustomerSegment,
  type CrmCustomerSegmentMember,
  type InsertCrmCustomerSegmentMember,
  type CrmCustomerInsights,
  type InsertCrmCustomerInsights,
  type CrmTouchpoint,
  type InsertCrmTouchpoint,
  type CustomerPet,
  type InsertCustomerPet,
  // Communication Center types
  type CrmEmailTemplate,
  type InsertCrmEmailTemplate,
  type CrmSmsTemplate,
  type InsertCrmSmsTemplate,
  type CrmAppointmentReminder,
  type InsertCrmAppointmentReminder,
  type CrmCommunicationLog,
  type InsertCrmCommunicationLog,
  // Enterprise Corporate tables
  jvPartners,
  jvContracts,
  suppliers,
  supplierContracts,
  supplierPayments,
  supplierQualityScores,
  stationRegistry,
  boardMeetingAttendees,
  // Enterprise HR tables
  hrEmployees,
  hrPayroll,
  hrTimeTracking,
  hrPerformanceReviews,
  // Enterprise Corporate types
  type JvPartner,
  type InsertJvPartner,
  type Supplier,
  type InsertSupplier,
  type StationRegistry,
  type InsertStationRegistry,
  // Enterprise HR types
  type HrEmployee,
  type InsertHrEmployee,
  type HrPayroll,
  type InsertHrPayroll,
  type HrTimeTracking,
  type InsertHrTimeTracking,
  type HrPerformanceReview,
  type InsertHrPerformanceReview,
} from "@shared/schema";
import {
  opsTasksTable,
  opsIncidents,
  opsSlaTracking,
  type OpsTask,
  type InsertOpsTask,
  type OpsIncident,
  type InsertOpsIncident,
  type OpsSlaTracking,
  type InsertOpsSlaTracking,
} from "@shared/schema-operations";
import {
  logisticsWarehouses,
  logisticsInventory,
  logisticsFulfillmentOrders,
  type LogisticsWarehouse,
  type InsertLogisticsWarehouse,
  type LogisticsInventory,
  type InsertLogisticsInventory,
  type LogisticsFulfillmentOrder,
  type InsertLogisticsFulfillmentOrder,
} from "@shared/schema-logistics";
import {
  accountsPayable,
  accountsReceivable,
  generalLedger,
  taxReturns,
  taxPayments,
  taxAuditLogs,
  type AccountsPayable,
  type InsertAccountsPayable,
  type AccountsReceivable,
  type InsertAccountsReceivable,
  type GeneralLedger,
  type InsertGeneralLedger,
  type TaxReturn,
  type InsertTaxReturn,
  type TaxPayment,
  type InsertTaxPayment,
  type TaxAuditLog,
  type InsertTaxAuditLog,
} from "@shared/schema-finance";
import {
  policyDocuments,
  policyAcknowledgments,
  complianceCertifications,
  type PolicyDocument,
  type InsertPolicyDocument,
  type PolicyAcknowledgment,
  type InsertPolicyAcknowledgment,
  type ComplianceCertification,
  type InsertComplianceCertification,
} from "@shared/schema-policy";
import {
  franchisees,
  franchiseRoyaltyPayments,
  type Franchisee,
  type InsertFranchisee,
  type FranchiseRoyaltyPayment,
  type InsertFranchiseRoyaltyPayment,
} from "@shared/schema-franchise";
import {
  chatConversations,
  chatMessages,
  chatAttachments,
  chatAnalytics,
  chatEventOutbox,
  type ChatConversation,
  type InsertChatConversation,
  type ChatMessage,
  type InsertChatMessage,
  type ChatAttachment,
  type InsertChatAttachment,
  type ChatAnalytics,
  type InsertChatAnalytics,
  type ChatEventOutbox,
  type InsertChatEventOutbox,
} from "@shared/schema-chat";
import { db } from "./db";
import { eq, desc, and, or, lt, gte, lte, like, sql } from "drizzle-orm";
import { NotFoundError } from "./errors";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  createManualUser(userData: any): Promise<User>;
  
  // Customer operations (for customer-facing system)
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  getCustomerByPhone(phoneNumber: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, updates: Partial<Customer>): Promise<Customer>;
  getAllCustomers(): Promise<Customer[]>;
  getCustomersWithFilters(filters: {
    searchTerm?: string;
    loyaltyTier?: string;
    verificationStatus?: string;
    location?: string;
    petType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<{ customers: Customer[]; total: number }>;
  
  // Pet operations
  getCustomerPets(customerId: number): Promise<CustomerPet[]>;
  createCustomerPet(pet: InsertCustomerPet): Promise<CustomerPet>;
  updateCustomerPet(id: number, updates: Partial<CustomerPet>): Promise<CustomerPet>;
  deleteCustomerPet(id: number): Promise<boolean>;
  
  // Wash packages
  getWashPackages(): Promise<WashPackage[]>;
  getWashPackage(id: number): Promise<WashPackage | undefined>;
  createWashPackage(pkg: InsertWashPackage): Promise<WashPackage>;
  
  // E-Vouchers (Gift cards) - UUID-based modern system
  createVoucher(data: {
    type: string;
    currency: string;
    amount: string;
    purchaserEmail?: string | null;
    recipientEmail?: string | null;
    purchaserUid?: string | null;
    expiresAt?: Date | null;
    nayaxTxId?: string | null;
  }): Promise<{ voucherId: string; codePlain: string; codeLast4: string }>;
  findVoucherByHash(codeHash: string): Promise<EVoucher | undefined>;
  getEVoucher(id: string): Promise<EVoucher | undefined>;
  updateEVoucher(id: string, updates: Partial<EVoucher>): Promise<EVoucher>;
  getUserEVouchers(userId: string): Promise<EVoucher[]>;
  claimVoucher(data: { codePlain: string; ownerUid: string }): Promise<{ success: boolean; voucher?: EVoucher; error?: string }>;
  redeemVoucher(data: {
    voucherId: string;
    amount: string;
    ownerUid: string;
    nayaxSessionId: string;
    locationId?: string;
  }): Promise<{ success: boolean; remainingAmount?: string; status?: string; error?: string }>;
  getMyVouchers(ownerUid: string, options?: { limit?: number; cursor?: string }): Promise<{ vouchers: EVoucher[]; hasMore: boolean; nextCursor?: string }>;
  getVoucherByIdForOwner(voucherId: string, ownerUid: string): Promise<EVoucher | undefined>;
  
  // E-Voucher Redemptions
  createEVoucherRedemption(redemption: InsertEVoucherRedemption): Promise<EVoucherRedemption>;
  getVoucherRedemptions(voucherId: string): Promise<EVoucherRedemption[]>;
  
  // Legacy gift card methods (for backward compatibility)
  createGiftCard(giftCard: InsertGiftCard): Promise<GiftCard>;
  getGiftCard(codeHash: string): Promise<GiftCard | undefined>;
  getGiftCardById(id: string): Promise<GiftCard | undefined>;
  getAllGiftCards(options?: { limit?: number; cursor?: string }): Promise<{ giftCards: GiftCard[]; hasMore: boolean; nextCursor?: string }>;
  redeemGiftCard(codeHash: string, userId: string): Promise<GiftCard | null>;
  
  // Wash history
  createWashHistory(history: InsertWashHistory): Promise<WashHistory>;
  getUserWashHistory(userId: string): Promise<WashHistory[]>;
  getCustomerWashHistory(customerId: number): Promise<WashHistory[]>;
  getAllWashHistory(): Promise<WashHistory[]>;
  
  // Coupons
  getCoupons(): Promise<Coupon[]>;
  getCoupon(code: string): Promise<Coupon | undefined>;
  useCoupon(userId: string, couponId: number): Promise<void>;
  
  // Admin operations
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  createAdminUser(admin: InsertAdminUser): Promise<AdminUser>;
  updateAdminUser(id: string, updates: Partial<AdminUser>): Promise<AdminUser>;
  getAllAdminUsers(): Promise<AdminUser[]>;
  getAllUsers(): Promise<User[]>;
  
  // Admin activity logs
  createAdminActivityLog(log: InsertAdminActivityLog): Promise<AdminActivityLog>;
  getAdminActivityLogs(adminId?: string, limit?: number): Promise<AdminActivityLog[]>;
  
  // Inventory management
  getInventoryItems(location?: string): Promise<InventoryItem[]>;
  getInventoryItem(id: number): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: number, updates: Partial<InventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: number): Promise<boolean>;
  getLowStockItems(location?: string): Promise<InventoryItem[]>;
  
  // HR document management
  getHRDocuments(location?: string, employeeType?: string): Promise<HRDocument[]>;
  getHRDocument(id: number): Promise<HRDocument | undefined>;
  createHRDocument(document: InsertHRDocument): Promise<HRDocument>;
  updateHRDocument(id: number, updates: Partial<HRDocument>): Promise<HRDocument>;
  deleteHRDocument(id: number): Promise<boolean>;
  
  // Loyalty analytics
  getLoyaltyAnalytics(userId?: string): Promise<LoyaltyAnalytics[]>;
  updateLoyaltyAnalytics(userId: string, updates: Partial<LoyaltyAnalytics>): Promise<LoyaltyAnalytics>;
  getUsersByTier(tier: string): Promise<User[]>;
  getTopCustomers(limit?: number): Promise<LoyaltyAnalytics[]>;
  
  // Smart Wash Receipts
  createSmartReceipt(receipt: InsertSmartWashReceipt): Promise<SmartWashReceipt>;
  getSmartReceiptByTransactionId(transactionId: string): Promise<SmartWashReceipt | undefined>;
  getUserSmartReceipts(userId: string, limit?: number): Promise<SmartWashReceipt[]>;
  updateSmartReceipt(transactionId: string, updates: Partial<SmartWashReceipt>): Promise<SmartWashReceipt>;

  // =================== CRM OPERATIONS ===================

  // Lead Management
  createLead(lead: InsertCrmLead): Promise<CrmLead>;
  getLead(id: number): Promise<CrmLead | undefined>;
  getLeadByEmail(email: string): Promise<CrmLead | undefined>;
  updateLead(id: number, updates: Partial<CrmLead>): Promise<CrmLead>;
  getLeads(filters?: {
    assignedTo?: string;
    leadStatus?: string;
    leadSource?: string;
    limit?: number;
    offset?: number;
  }): Promise<CrmLead[]>;
  convertLeadToCustomer(leadId: number, customerId: number): Promise<CrmLead>;
  getLeadsByAssignee(assigneeId: string): Promise<CrmLead[]>;

  // Communication History
  createCommunication(communication: InsertCrmCommunication): Promise<CrmCommunication>;
  getCommunication(id: number): Promise<CrmCommunication | undefined>;
  getCommunications(filters?: {
    leadId?: number;
    customerId?: number;
    userId?: string;
    communicationType?: string;
    createdBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<CrmCommunication[]>;
  updateCommunication(id: number, updates: Partial<CrmCommunication>): Promise<CrmCommunication>;
  getEntityCommunications(entityType: 'lead' | 'customer' | 'user', entityId: string | number): Promise<CrmCommunication[]>;

  // Deal Stages
  createDealStage(stage: InsertCrmDealStage): Promise<CrmDealStage>;
  getDealStage(id: number): Promise<CrmDealStage | undefined>;
  getDealStages(): Promise<CrmDealStage[]>;
  updateDealStage(id: number, updates: Partial<CrmDealStage>): Promise<CrmDealStage>;
  deleteDealStage(id: number): Promise<boolean>;

  // Opportunities (Sales Pipeline)
  createOpportunity(opportunity: InsertCrmOpportunity): Promise<CrmOpportunity>;
  getOpportunity(id: number): Promise<CrmOpportunity | undefined>;
  getOpportunities(filters?: {
    assignedTo?: string;
    dealStageId?: number;
    status?: string;
    leadId?: number;
    customerId?: number;
    limit?: number;
    offset?: number;
  }): Promise<CrmOpportunity[]>;
  updateOpportunity(id: number, updates: Partial<CrmOpportunity>): Promise<CrmOpportunity>;
  getOpportunitiesByAssignee(assigneeId: string): Promise<CrmOpportunity[]>;
  getForecastData(assigneeId?: string, timeframe?: 'this_month' | 'next_month' | 'this_quarter'): Promise<any>;

  // Tasks & Activities
  createTask(task: InsertCrmTask): Promise<CrmTask>;
  getTask(id: number): Promise<CrmTask | undefined>;
  getTasks(filters?: {
    assignedTo?: string;
    status?: string;
    priority?: string;
    taskType?: string;
    dueDate?: string;
    leadId?: number;
    customerId?: number;
    opportunityId?: number;
    limit?: number;
    offset?: number;
  }): Promise<CrmTask[]>;
  updateTask(id: number, updates: Partial<CrmTask>): Promise<CrmTask>;
  completeTask(id: number, completedBy: string, outcome?: string, notes?: string): Promise<CrmTask>;
  getTasksByAssignee(assigneeId: string): Promise<CrmTask[]>;
  getOverdueTasks(assigneeId?: string): Promise<CrmTask[]>;
  getUpcomingTasks(assigneeId?: string, days?: number): Promise<CrmTask[]>;

  // Activity Log
  createActivity(activity: InsertCrmActivity): Promise<CrmActivity>;
  getActivity(id: number): Promise<CrmActivity | undefined>;
  getActivities(filters?: {
    leadId?: number;
    customerId?: number;
    userId?: string;
    opportunityId?: number;
    performedBy?: string;
    activityType?: string;
    limit?: number;
    offset?: number;
  }): Promise<CrmActivity[]>;
  getEntityActivities(entityType: 'lead' | 'customer' | 'user' | 'opportunity', entityId: string | number): Promise<CrmActivity[]>;

  // Marketing Campaigns
  createCampaign(campaign: InsertCrmCampaign): Promise<CrmCampaign>;
  getCampaign(id: number): Promise<CrmCampaign | undefined>;
  getCampaigns(filters?: {
    status?: string;
    campaignType?: string;
    channel?: string;
    createdBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<CrmCampaign[]>;
  updateCampaign(id: number, updates: Partial<CrmCampaign>): Promise<CrmCampaign>;
  deleteCampaign(id: number): Promise<boolean>;

  // Campaign Targets
  createCampaignTarget(target: InsertCrmCampaignTarget): Promise<CrmCampaignTarget>;
  getCampaignTarget(id: number): Promise<CrmCampaignTarget | undefined>;
  getCampaignTargets(campaignId: number): Promise<CrmCampaignTarget[]>;
  updateCampaignTarget(id: number, updates: Partial<CrmCampaignTarget>): Promise<CrmCampaignTarget>;
  addTargetsToCampaign(campaignId: number, targets: InsertCrmCampaignTarget[]): Promise<CrmCampaignTarget[]>;

  // Campaign Metrics
  createCampaignMetrics(metrics: InsertCrmCampaignMetrics): Promise<CrmCampaignMetrics>;
  getCampaignMetrics(campaignId: number): Promise<CrmCampaignMetrics | undefined>;
  updateCampaignMetrics(campaignId: number, updates: Partial<CrmCampaignMetrics>): Promise<CrmCampaignMetrics>;
  calculateCampaignMetrics(campaignId: number): Promise<CrmCampaignMetrics>;

  // Customer Segments
  createCustomerSegment(segment: InsertCrmCustomerSegment): Promise<CrmCustomerSegment>;
  getCustomerSegment(id: number): Promise<CrmCustomerSegment | undefined>;
  getCustomerSegments(): Promise<CrmCustomerSegment[]>;
  updateCustomerSegment(id: number, updates: Partial<CrmCustomerSegment>): Promise<CrmCustomerSegment>;
  deleteCustomerSegment(id: number): Promise<boolean>;
  refreshSegmentMembers(segmentId: number): Promise<void>;

  // Customer Segment Members
  addCustomerToSegment(segmentId: number, customerId?: number, userId?: string): Promise<CrmCustomerSegmentMember>;
  removeCustomerFromSegment(segmentId: number, customerId?: number, userId?: string): Promise<boolean>;
  getSegmentMembers(segmentId: number): Promise<CrmCustomerSegmentMember[]>;
  getCustomerSegments(customerId?: number, userId?: string): Promise<CrmCustomerSegment[]>;

  // Customer Insights
  createCustomerInsights(insights: InsertCrmCustomerInsights): Promise<CrmCustomerInsights>;
  getCustomerInsights(customerId?: number, userId?: string): Promise<CrmCustomerInsights | undefined>;
  updateCustomerInsights(customerId: number | null, userId: string | null, updates: Partial<CrmCustomerInsights>): Promise<CrmCustomerInsights>;
  calculateCustomerInsights(customerId?: number, userId?: string): Promise<CrmCustomerInsights>;
  getCustomersAtRisk(riskLevel?: 'low' | 'medium' | 'high'): Promise<CrmCustomerInsights[]>;
  getHighValueCustomers(limit?: number): Promise<CrmCustomerInsights[]>;

  // Customer Touchpoints
  createTouchpoint(touchpoint: InsertCrmTouchpoint): Promise<CrmTouchpoint>;
  getTouchpoint(id: number): Promise<CrmTouchpoint | undefined>;
  getTouchpoints(filters?: {
    customerId?: number;
    userId?: string;
    leadId?: number;
    touchpointType?: string;
    channel?: string;
    campaignId?: number;
    sessionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<CrmTouchpoint[]>;
  getCustomerJourney(customerId?: number, userId?: string): Promise<CrmTouchpoint[]>;
  getSessionTouchpoints(sessionId: string): Promise<CrmTouchpoint[]>;

  // =================== COMMUNICATION CENTER OPERATIONS ===================

  // Email Templates
  createEmailTemplate(template: InsertCrmEmailTemplate): Promise<CrmEmailTemplate>;
  getEmailTemplate(id: number): Promise<CrmEmailTemplate | undefined>;
  getEmailTemplates(filters?: {
    category?: string;
    isActive?: boolean;
    createdBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<CrmEmailTemplate[]>;
  updateEmailTemplate(id: number, updates: Partial<CrmEmailTemplate>): Promise<CrmEmailTemplate>;
  deleteEmailTemplate(id: number): Promise<boolean>;
  getDefaultEmailTemplate(category: string): Promise<CrmEmailTemplate | undefined>;

  // SMS Templates
  createSmsTemplate(template: InsertCrmSmsTemplate): Promise<CrmSmsTemplate>;
  getSmsTemplate(id: number): Promise<CrmSmsTemplate | undefined>;
  getSmsTemplates(filters?: {
    category?: string;
    isActive?: boolean;
    createdBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<CrmSmsTemplate[]>;
  updateSmsTemplate(id: number, updates: Partial<CrmSmsTemplate>): Promise<CrmSmsTemplate>;
  deleteSmsTemplate(id: number): Promise<boolean>;
  getDefaultSmsTemplate(category: string): Promise<CrmSmsTemplate | undefined>;

  // Appointment Reminders
  createAppointmentReminder(reminder: InsertCrmAppointmentReminder): Promise<CrmAppointmentReminder>;
  getAppointmentReminder(id: number): Promise<CrmAppointmentReminder | undefined>;
  getAppointmentReminders(filters?: {
    customerId?: number;
    userId?: string;
    status?: string;
    appointmentDate?: string;
    reminderType?: string;
    isScheduled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<CrmAppointmentReminder[]>;
  updateAppointmentReminder(id: number, updates: Partial<CrmAppointmentReminder>): Promise<CrmAppointmentReminder>;
  cancelAppointmentReminder(id: number, cancelledBy: string, reason?: string): Promise<CrmAppointmentReminder>;
  getScheduledReminders(cutoffDate?: Date): Promise<CrmAppointmentReminder[]>;
  getPendingReminders(): Promise<CrmAppointmentReminder[]>;

  // Communication Logs
  createCommunicationLog(log: InsertCrmCommunicationLog): Promise<CrmCommunicationLog>;
  getCommunicationLog(id: number): Promise<CrmCommunicationLog | undefined>;
  getCommunicationLogsByCommunication(communicationId: number): Promise<CrmCommunicationLog[]>;
  updateCommunicationLog(id: number, updates: Partial<CrmCommunicationLog>): Promise<CrmCommunicationLog>;
  trackEmailOpen(communicationId: number, logId?: number): Promise<CrmCommunicationLog>;
  trackEmailClick(communicationId: number, logId?: number): Promise<CrmCommunicationLog>;

  // Communication Center Analytics
  getCommunicationStats(dateFrom?: Date, dateTo?: Date): Promise<{
    totalCommunications: number;
    emailsSent: number;
    smsSent: number;
    emailsOpened: number;
    emailsClicked: number;
    smsDelivered: number;
    totalTemplatesUsed: number;
    activeReminders: number;
    completedReminders: number;
  }>;

  // =================== ENTERPRISE OPERATIONS (Nov 2025) ===================
  
  // Board of Directors
  getAllBoardMembers(): Promise<any[]>;
  getActiveBoardMembers(): Promise<any[]>;
  createBoardMember(data: any): Promise<any>;
  updateBoardMember(id: number, updates: any): Promise<any>;
  
  // Board Meetings
  getAllBoardMeetings(): Promise<any[]>;
  getUpcomingBoardMeetings(): Promise<any[]>;
  createBoardMeeting(data: any): Promise<any>;
  updateBoardMeeting(id: number, updates: any): Promise<any>;
  addMeetingAttendee(meetingId: number, memberId: number, attended?: boolean): Promise<any>;
  
  // JV Partners
  getAllJvPartners(): Promise<any[]>;
  getActiveJvPartners(): Promise<any[]>;
  createJvPartner(data: any): Promise<any>;
  updateJvPartner(id: number, updates: any): Promise<any>;
  getJvPartnerContracts(partnerId: number): Promise<any[]>;
  
  // Suppliers
  getAllSuppliers(): Promise<any[]>;
  getActiveSuppliers(): Promise<any[]>;
  createSupplier(data: any): Promise<any>;
  updateSupplier(id: number, updates: any): Promise<any>;
  getSupplierContracts(supplierId: number): Promise<any[]>;
  getSupplierPayments(supplierId: number): Promise<any[]>;
  createSupplierPayment(data: any): Promise<any>;
  getSupplierQualityScores(supplierId: number): Promise<any[]>;
  createSupplierQualityScore(data: any): Promise<any>;
  
  // Station Registry
  getAllStations(): Promise<any[]>;
  getStationByCanonicalId(canonicalId: string): Promise<any | undefined>;
  getStationsByCountry(country: string): Promise<any[]>;
  getStationsByCity(city: string): Promise<any[]>;
  getActiveStations(): Promise<any[]>;
  createStation(data: any): Promise<any>;
  updateStation(id: number, updates: any): Promise<any>;
  updateStationRevenue(id: number, revenue: number, washes: number): Promise<any>;
  
  // HR Employees
  getAllEmployees(): Promise<any[]>;
  getActiveEmployees(): Promise<any[]>;
  getEmployeeById(id: number): Promise<any | undefined>;
  getEmployeesByDepartment(department: string): Promise<any[]>;
  createEmployee(data: any): Promise<any>;
  updateEmployee(id: number, updates: any): Promise<any>;
  
  // HR Payroll
  getAllPayroll(): Promise<any[]>;
  getEmployeePayroll(employeeId: number): Promise<any[]>;
  createPayroll(data: any): Promise<any>;
  updatePayrollStatus(id: number, status: string): Promise<any>;
  
  // HR Time Tracking
  getEmployeeTimeTracking(employeeId: number): Promise<any[]>;
  getTimeTrackingByDateRange(employeeId: number, start: string, end: string): Promise<any[]>;
  clockIn(data: any): Promise<any>;
  clockOut(id: number, clockOutTime: string): Promise<any>;
  approveTimeEntry(id: number, approvedBy: number): Promise<any>;
  
  // HR Performance Reviews
  getAllPerformanceReviews(): Promise<any[]>;
  getEmployeeReviews(employeeId: number): Promise<any[]>;
  getReviewById(id: number): Promise<any | undefined>;
  getPendingReviews(): Promise<any[]>;
  createPerformanceReview(data: any): Promise<any>;
  updatePerformanceReview(id: number, updates: any): Promise<any>;
  acknowledgeReview(id: number, signature: string): Promise<any>;
  
  // HR Recruitment
  getAllJobOpenings(): Promise<any[]>;
  getOpenJobOpenings(): Promise<any[]>;
  getJobOpeningById(id: number): Promise<any | undefined>;
  createJobOpening(data: any): Promise<any>;
  updateJobOpening(id: number, updates: any): Promise<any>;
  getAllJobApplications(): Promise<any[]>;
  getJobApplications(jobId: number): Promise<any[]>;
  getJobApplicationById(id: number): Promise<any | undefined>;
  createJobApplication(data: any): Promise<any>;
  updateJobApplicationStatus(id: number, status: string, updates?: any): Promise<any>;
  
  // =================== OPERATIONS DEPARTMENT ===================
  
  // Operations Tasks
  createOpsTask(task: any): Promise<any>;
  getOpsTask(id: number): Promise<any | undefined>;
  getOpsTasks(filters?: {
    taskId?: string;
    assignedTo?: number;
    status?: string;
    priority?: string;
    category?: string;
    stationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]>;
  updateOpsTask(id: number, updates: any): Promise<any>;
  completeOpsTask(id: number, completedBy: number, notes?: string): Promise<any>;
  getTasksByStatus(status: string): Promise<any[]>;
  getTasksByPriority(priority: string): Promise<any[]>;
  getOverdueOpsTasks(): Promise<any[]>;
  
  // Operations Incidents
  createIncident(incident: any): Promise<any>;
  getIncident(id: number): Promise<any | undefined>;
  getIncidents(filters?: {
    incidentId?: string;
    severity?: string;
    status?: string;
    category?: string;
    stationId?: string;
    assignedTo?: number;
    slaBreach?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]>;
  updateIncident(id: number, updates: any): Promise<any>;
  resolveIncident(id: number, resolvedBy: number, resolution: string, preventiveMeasures?: string): Promise<any>;
  closeIncident(id: number, closedBy: number): Promise<any>;
  escalateIncident(id: number, escalatedBy: number, escalationNotes: string): Promise<any>;
  getSlaBreachIncidents(): Promise<any[]>;
  getIncidentsBySeverity(severity: string): Promise<any[]>;
  
  // Operations SLA Tracking
  createSlaTracking(sla: any): Promise<any>;
  getSlaTracking(id: number): Promise<any | undefined>;
  getSlaTrackings(filters?: {
    entityType?: string;
    entityId?: number;
    slaType?: string;
    status?: string;
    isBreach?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]>;
  updateSlaTracking(id: number, updates: any): Promise<any>;
  completeSlaTracking(id: number, completedTime: Date): Promise<any>;
  getSlaBreaches(entityType?: string): Promise<any[]>;
  getSlaMetrics(entityType?: string): Promise<{
    totalSlas: number;
    breachCount: number;
    breachRate: number;
    avgResponseTime: number;
    avgResolutionTime: number;
  }>;
  
  // Logistics Warehouses
  createWarehouse(warehouse: InsertLogisticsWarehouse): Promise<LogisticsWarehouse>;
  getWarehouse(id: number): Promise<LogisticsWarehouse | undefined>;
  getWarehouses(filters?: { isActive?: boolean; country?: string; limit?: number; offset?: number }): Promise<LogisticsWarehouse[]>;
  updateWarehouse(id: number, updates: Partial<LogisticsWarehouse>): Promise<LogisticsWarehouse>;
  deactivateWarehouse(id: number): Promise<LogisticsWarehouse>;
  getWarehouseUtilization(): Promise<{ id: number; warehouseId: string; name: string; currentUtilization: string; capacity: number }[]>;
  
  // Logistics Inventory
  createInventoryItem(item: InsertLogisticsInventory): Promise<LogisticsInventory>;
  getInventoryItem(id: number): Promise<LogisticsInventory | undefined>;
  getInventoryBySku(sku: string): Promise<LogisticsInventory | undefined>;
  getInventoryItems(filters?: {
    warehouseId?: number;
    category?: string;
    searchTerm?: string;
    limit?: number;
    offset?: number;
  }): Promise<LogisticsInventory[]>;
  updateInventoryItem(id: number, updates: Partial<LogisticsInventory>): Promise<LogisticsInventory>;
  adjustInventoryQuantity(id: number, quantityChange: number, notes?: string): Promise<LogisticsInventory>;
  getLowStockItems(): Promise<LogisticsInventory[]>;
  getExpiringItems(daysThreshold?: number): Promise<LogisticsInventory[]>;
  getInventoryByWarehouse(warehouseId: number): Promise<LogisticsInventory[]>;
  
  // Logistics Fulfillment Orders
  createFulfillmentOrder(order: InsertLogisticsFulfillmentOrder): Promise<LogisticsFulfillmentOrder>;
  getFulfillmentOrder(id: number): Promise<LogisticsFulfillmentOrder | undefined>;
  getFulfillmentOrders(filters?: {
    orderType?: string;
    status?: string;
    priority?: string;
    stationId?: string;
    warehouseId?: number;
    limit?: number;
    offset?: number;
  }): Promise<LogisticsFulfillmentOrder[]>;
  updateFulfillmentOrder(id: number, updates: Partial<LogisticsFulfillmentOrder>): Promise<LogisticsFulfillmentOrder>;
  shipFulfillmentOrder(id: number, trackingNumber: string, carrier: string): Promise<LogisticsFulfillmentOrder>;
  deliverFulfillmentOrder(id: number): Promise<LogisticsFulfillmentOrder>;
  cancelFulfillmentOrder(id: number, reason?: string): Promise<LogisticsFulfillmentOrder>;
  getPendingOrders(): Promise<LogisticsFulfillmentOrder[]>;
  getOrdersByStation(stationId: string): Promise<LogisticsFulfillmentOrder[]>;
  
  // Finance - Accounts Payable
  getAllAccountsPayable(): Promise<AccountsPayable[]>;
  getAccountsPayableById(id: number): Promise<AccountsPayable | undefined>;
  createAccountsPayable(data: InsertAccountsPayable): Promise<AccountsPayable>;
  updateAccountsPayable(id: number, updates: Partial<AccountsPayable>): Promise<AccountsPayable>;
  deleteAccountsPayable(id: number): Promise<void>;
  getOverduePayables(): Promise<AccountsPayable[]>;
  getPayablesBySupplier(supplierId: number): Promise<AccountsPayable[]>;
  getPayablesByStatus(status: string): Promise<AccountsPayable[]>;
  markPayableAsPaid(id: number, paymentDate: Date, paymentMethod: string, paymentReference?: string): Promise<AccountsPayable>;
  
  // Finance - Accounts Receivable
  getAllAccountsReceivable(): Promise<AccountsReceivable[]>;
  getAccountsReceivableById(id: number): Promise<AccountsReceivable | undefined>;
  createAccountsReceivable(data: InsertAccountsReceivable): Promise<AccountsReceivable>;
  updateAccountsReceivable(id: number, updates: Partial<AccountsReceivable>): Promise<AccountsReceivable>;
  deleteAccountsReceivable(id: number): Promise<void>;
  getOverdueReceivables(): Promise<AccountsReceivable[]>;
  getReceivablesByCustomer(customerId: string): Promise<AccountsReceivable[]>;
  getReceivablesByStatus(status: string): Promise<AccountsReceivable[]>;
  recordReceivablePayment(id: number, amount: number, paymentDate: Date, paymentMethod: string): Promise<AccountsReceivable>;
  
  // Finance - General Ledger
  getAllGeneralLedgerEntries(): Promise<GeneralLedger[]>;
  getGeneralLedgerById(id: number): Promise<GeneralLedger | undefined>;
  createGeneralLedgerEntry(data: InsertGeneralLedger): Promise<GeneralLedger>;
  getEntriesByAccount(accountCode: string): Promise<GeneralLedger[]>;
  getEntriesByFiscalPeriod(fiscalYear: number, fiscalPeriod: number): Promise<GeneralLedger[]>;
  getTrialBalance(fiscalYear: number, fiscalPeriod: number): Promise<any[]>;
  reconcileEntry(id: number): Promise<GeneralLedger>;
  
  // Finance - Tax Compliance
  getAllTaxReturns(): Promise<TaxReturn[]>;
  getTaxReturnById(id: number): Promise<TaxReturn | undefined>;
  createTaxReturn(data: InsertTaxReturn): Promise<TaxReturn>;
  updateTaxReturn(id: number, updates: Partial<TaxReturn>): Promise<TaxReturn>;
  getTaxReturnsByPeriod(taxYear: number, taxPeriod: string): Promise<TaxReturn[]>;
  getTaxReturnsByStatus(status: string): Promise<TaxReturn[]>;
  submitTaxReturn(id: number, submittedBy: string): Promise<TaxReturn>;
  
  getAllTaxPayments(): Promise<TaxPayment[]>;
  getTaxPaymentById(id: number): Promise<TaxPayment | undefined>;
  createTaxPayment(data: InsertTaxPayment): Promise<TaxPayment>;
  getTaxPaymentsByReturn(taxReturnId: number): Promise<TaxPayment[]>;
  getTaxPaymentsByDateRange(startDate: Date, endDate: Date): Promise<TaxPayment[]>;
  
  getAllTaxAuditLogs(): Promise<TaxAuditLog[]>;
  getTaxAuditLogById(id: number): Promise<TaxAuditLog | undefined>;
  createTaxAuditLog(data: InsertTaxAuditLog): Promise<TaxAuditLog>;
  getTaxAuditLogsByEntity(entityType: string, entityId: number): Promise<TaxAuditLog[]>;
  getTaxAuditLogsByUser(userId: string): Promise<TaxAuditLog[]>;
  getTaxAuditLogsByDateRange(startDate: Date, endDate: Date): Promise<TaxAuditLog[]>;
  
  // Policy Documents
  getAllPolicyDocuments(): Promise<PolicyDocument[]>;
  getPolicyDocumentById(id: number): Promise<PolicyDocument | undefined>;
  getActivePolicyDocuments(): Promise<PolicyDocument[]>;
  getPolicyDocumentsByCategory(category: string): Promise<PolicyDocument[]>;
  createPolicyDocument(data: InsertPolicyDocument): Promise<PolicyDocument>;
  updatePolicyDocument(id: number, updates: Partial<PolicyDocument>): Promise<PolicyDocument>;
  deletePolicyDocument(id: number): Promise<void>;
  recordPolicyAcknowledgment(data: InsertPolicyAcknowledgment): Promise<PolicyAcknowledgment>;
  getPolicyAcknowledgments(policyId: number): Promise<PolicyAcknowledgment[]>;
  
  // Compliance Certifications
  getAllComplianceCertifications(): Promise<ComplianceCertification[]>;
  getComplianceCertificationById(id: number): Promise<ComplianceCertification | undefined>;
  getEmployeeCertifications(employeeId: number): Promise<ComplianceCertification[]>;
  createComplianceCertification(data: InsertComplianceCertification): Promise<ComplianceCertification>;
  updateComplianceCertification(id: number, updates: Partial<ComplianceCertification>): Promise<ComplianceCertification>;
  getExpiringCertifications(daysAhead: number): Promise<ComplianceCertification[]>;
  
  // Franchisees
  getAllFranchisees(): Promise<Franchisee[]>;
  getFranchiseeById(id: number): Promise<Franchisee | undefined>;
  getActiveFranchisees(): Promise<Franchisee[]>;
  getFranchiseesByCountry(country: string): Promise<Franchisee[]>;
  createFranchisee(data: InsertFranchisee): Promise<Franchisee>;
  updateFranchisee(id: number, updates: Partial<Franchisee>): Promise<Franchisee>;
  
  // Franchise Royalty Payments
  getAllRoyaltyPayments(): Promise<FranchiseRoyaltyPayment[]>;
  getRoyaltyPaymentById(id: number): Promise<FranchiseRoyaltyPayment | undefined>;
  getFranchiseeRoyaltyPayments(franchiseeId: number): Promise<FranchiseRoyaltyPayment[]>;
  getPendingRoyaltyPayments(): Promise<FranchiseRoyaltyPayment[]>;
  getOverdueRoyaltyPayments(): Promise<FranchiseRoyaltyPayment[]>;
  createRoyaltyPayment(data: InsertFranchiseRoyaltyPayment): Promise<FranchiseRoyaltyPayment>;
  updateRoyaltyPayment(id: number, updates: Partial<FranchiseRoyaltyPayment>): Promise<FranchiseRoyaltyPayment>;
  recordRoyaltyPayment(id: number, paymentData: { paidDate: string; paymentMethod: string; paymentReference?: string }): Promise<FranchiseRoyaltyPayment>;
  
  // =================== CHAT HISTORY (Migrated from Firestore) ===================
  
  // Chat Conversations
  createChatConversation(data: InsertChatConversation): Promise<ChatConversation>;
  getChatConversation(conversationId: string): Promise<ChatConversation | undefined>;
  getChatConversationById(id: number): Promise<ChatConversation | undefined>;
  getUserChatConversations(userId: string, filters?: { status?: string; limit?: number; offset?: number }): Promise<ChatConversation[]>;
  getStationChatConversations(stationId: string): Promise<ChatConversation[]>;
  updateChatConversation(conversationId: string, updates: Partial<ChatConversation>): Promise<ChatConversation>;
  archiveChatConversation(conversationId: string): Promise<ChatConversation>;
  getActiveChatConversations(): Promise<ChatConversation[]>;
  
  // Chat Messages
  createChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  getChatMessage(messageId: string): Promise<ChatMessage | undefined>;
  getConversationMessages(conversationId: string, filters?: { limit?: number; offset?: number }): Promise<ChatMessage[]>;
  updateChatMessage(messageId: string, updates: Partial<ChatMessage>): Promise<ChatMessage>;
  markMessageAsRead(messageId: string): Promise<ChatMessage>;
  getUnreadMessages(conversationId: string): Promise<ChatMessage[]>;
  
  // Chat Attachments
  createChatAttachment(data: InsertChatAttachment): Promise<ChatAttachment>;
  getMessageAttachments(messageId: string): Promise<ChatAttachment[]>;
  getConversationAttachments(conversationId: string): Promise<ChatAttachment[]>;
  
  // Chat Analytics
  trackChatEvent(data: InsertChatAnalytics): Promise<ChatAnalytics>;
  getConversationAnalytics(conversationId: string): Promise<ChatAnalytics[]>;
  getChatAnalyticsByEventType(eventType: string, filters?: { startDate?: Date; endDate?: Date }): Promise<ChatAnalytics[]>;
  
  // Chat Event Outbox (EventBus Integration)
  createChatEvent(data: InsertChatEventOutbox): Promise<ChatEventOutbox>;
  getPendingChatEvents(limit?: number): Promise<ChatEventOutbox[]>;
  markChatEventPublished(eventId: string): Promise<ChatEventOutbox>;
  incrementChatEventRetry(eventId: string, error: string): Promise<ChatEventOutbox>;
  getFailedChatEvents(): Promise<ChatEventOutbox[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async createManualUser(userData: any): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return user;
  }

  // Customer operations
  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    return customer;
  }

  async getCustomerByPhone(phoneNumber: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.phone, phoneNumber));
    return customer;
  }

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    const [customer] = await db
      .insert(customers)
      .values({
        ...customerData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return customer;
  }

  async updateCustomer(id: number, updates: Partial<Customer>): Promise<Customer> {
    const [customer] = await db
      .update(customers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return customer;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomersWithFilters(filters: {
    searchTerm?: string;
    loyaltyTier?: string;
    verificationStatus?: string;
    location?: string;
    petType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<{ customers: Customer[]; total: number }> {
    const { 
      searchTerm, 
      loyaltyTier, 
      verificationStatus, 
      location, 
      petType,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 25,
      offset = 0
    } = filters;

    let query = db.select().from(customers);
    let countQuery = db.select({ count: sql`count(*)` }).from(customers);

    // Apply filters
    const conditions = [];
    
    if (searchTerm) {
      const searchCondition = or(
        like(customers.firstName, `%${searchTerm}%`),
        like(customers.lastName, `%${searchTerm}%`),
        like(customers.email, `%${searchTerm}%`)
      );
      conditions.push(searchCondition);
    }
    
    if (loyaltyTier) {
      conditions.push(eq(customers.loyaltyTier, loyaltyTier));
    }
    
    if (verificationStatus === 'verified') {
      conditions.push(eq(customers.isVerified, true));
    } else if (verificationStatus === 'unverified') {
      conditions.push(eq(customers.isVerified, false));
    }
    
    if (location) {
      conditions.push(eq(customers.country, location));
    }
    
    if (petType) {
      conditions.push(eq(customers.petType, petType));
    }

    if (conditions.length > 0) {
      const whereCondition = and(...conditions);
      query = query.where(whereCondition);
      countQuery = countQuery.where(whereCondition);
    }

    // Apply sorting
    if (sortBy === 'firstName') {
      query = sortOrder === 'desc' ? query.orderBy(desc(customers.firstName)) : query.orderBy(customers.firstName);
    } else if (sortBy === 'lastName') {
      query = sortOrder === 'desc' ? query.orderBy(desc(customers.lastName)) : query.orderBy(customers.lastName);
    } else if (sortBy === 'email') {
      query = sortOrder === 'desc' ? query.orderBy(desc(customers.email)) : query.orderBy(customers.email);
    } else if (sortBy === 'totalSpent') {
      query = sortOrder === 'desc' ? query.orderBy(desc(customers.totalSpent)) : query.orderBy(customers.totalSpent);
    } else {
      query = sortOrder === 'desc' ? query.orderBy(desc(customers.createdAt)) : query.orderBy(customers.createdAt);
    }

    // Apply pagination
    query = query.limit(limit).offset(offset);

    const [allCustomers, countResult] = await Promise.all([
      query,
      countQuery
    ]);

    return {
      customers: allCustomers,
      total: countResult[0]?.count || 0
    };
  }

  // Pet operations
  async getCustomerPets(customerId: number): Promise<CustomerPet[]> {
    return await db.select().from(customerPets).where(eq(customerPets.customerId, customerId));
  }

  async createCustomerPet(pet: InsertCustomerPet): Promise<CustomerPet> {
    const [newPet] = await db
      .insert(customerPets)
      .values(pet)
      .returning();
    return newPet;
  }

  async updateCustomerPet(id: number, updates: Partial<CustomerPet>): Promise<CustomerPet> {
    const [pet] = await db
      .update(customerPets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customerPets.id, id))
      .returning();
    return pet;
  }

  async deleteCustomerPet(id: number): Promise<boolean> {
    const result = await db.delete(customerPets).where(eq(customerPets.id, id));
    return result.rowCount > 0;
  }

  // Wash packages
  async getWashPackages(): Promise<WashPackage[]> {
    return await db.select().from(washPackages).where(eq(washPackages.isActive, true));
  }

  async getWashPackage(id: number): Promise<WashPackage | undefined> {
    const [pkg] = await db.select().from(washPackages).where(eq(washPackages.id, id));
    return pkg;
  }

  async createWashPackage(pkg: InsertWashPackage): Promise<WashPackage> {
    const [newPkg] = await db.insert(washPackages).values(pkg).returning();
    return newPkg;
  }

  // E-Voucher operations (modern 2025-2026 secure voucher system)
  async createVoucher(data: {
    type: string;
    currency: string;
    amount: string;
    purchaserEmail?: string | null;
    recipientEmail?: string | null;
    purchaserUid?: string | null;
    expiresAt?: Date | null;
    nayaxTxId?: string | null;
  }): Promise<{ voucherId: string; codePlain: string; codeLast4: string }> {
    const { generateSecureCode, hashVoucherCode, getLast4 } = await import('./utils/voucherCodes');
    
    const codePlain = generateSecureCode();
    const codeHash = hashVoucherCode(codePlain);
    const codeLast4 = getLast4(codePlain);
    
    const [createdVoucher] = await db
      .insert(eVouchers)
      .values({
        codeHash,
        codeLast4,
        type: data.type,
        currency: data.currency,
        initialAmount: data.amount,
        remainingAmount: data.amount,
        status: 'PENDING',
        purchaserEmail: data.purchaserEmail,
        recipientEmail: data.recipientEmail,
        purchaserUid: data.purchaserUid,
        expiresAt: data.expiresAt,
        nayaxTxId: data.nayaxTxId
      })
      .returning();
    
    return {
      voucherId: createdVoucher.id,
      codePlain,
      codeLast4: createdVoucher.codeLast4
    };
  }

  async findVoucherByHash(codeHash: string): Promise<EVoucher | undefined> {
    const [voucher] = await db.select().from(eVouchers).where(eq(eVouchers.codeHash, codeHash));
    return voucher || undefined;
  }

  async getEVoucher(id: string): Promise<EVoucher | undefined> {
    const [voucher] = await db.select().from(eVouchers).where(eq(eVouchers.id, id));
    return voucher || undefined;
  }

  async updateEVoucher(id: string, updates: Partial<EVoucher>): Promise<EVoucher> {
    const [updatedVoucher] = await db
      .update(eVouchers)
      .set(updates)
      .where(eq(eVouchers.id, id))
      .returning();
    return updatedVoucher;
  }

  async claimVoucher(data: { codePlain: string; ownerUid: string }): Promise<{ success: boolean; voucher?: EVoucher; error?: string }> {
    const { hashVoucherCode } = await import('./utils/voucherCodes');
    const codeHash = hashVoucherCode(data.codePlain);
    
    const voucher = await this.findVoucherByHash(codeHash);
    if (!voucher) {
      return { success: false, error: 'VOUCHER_NOT_FOUND' };
    }
    
    if (voucher.ownerUid && voucher.ownerUid !== data.ownerUid) {
      return { success: false, error: 'ALREADY_CLAIMED' };
    }
    
    if (voucher.ownerUid === data.ownerUid) {
      return { success: true, voucher };
    }
    
    const updated = await this.updateEVoucher(voucher.id, {
      ownerUid: data.ownerUid,
      status: 'ACTIVE',
      activatedAt: new Date()
    });
    
    return { success: true, voucher: updated };
  }

  async redeemVoucher(data: {
    voucherId: string;
    amount: string;
    ownerUid: string;
    nayaxSessionId: string;
    locationId?: string;
  }): Promise<{ success: boolean; remainingAmount?: string; status?: string; error?: string }> {
    const voucher = await this.getEVoucher(data.voucherId);
    if (!voucher) {
      return { success: false, error: 'VOUCHER_NOT_FOUND' };
    }
    
    if (voucher.ownerUid !== data.ownerUid) {
      return { success: false, error: 'UNAUTHORIZED' };
    }
    
    if (voucher.status === 'USED' || voucher.status === 'CANCELLED' || voucher.status === 'EXPIRED') {
      return { success: false, error: 'INVALID_STATUS' };
    }
    
    if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
      await this.updateEVoucher(data.voucherId, { status: 'EXPIRED' });
      return { success: false, error: 'EXPIRED' };
    }
    
    const remaining = parseFloat(voucher.remainingAmount);
    const redeemAmount = parseFloat(data.amount);
    
    if (redeemAmount > remaining) {
      return { success: false, error: 'INSUFFICIENT_FUNDS' };
    }
    
    const existing = await db
      .select()
      .from(eVoucherRedemptions)
      .where(
        and(
          eq(eVoucherRedemptions.voucherId, data.voucherId),
          eq(eVoucherRedemptions.nayaxSessionId, data.nayaxSessionId)
        )
      );
    
    if (existing.length > 0) {
      return { 
        success: true, 
        remainingAmount: voucher.remainingAmount, 
        status: voucher.status 
      };
    }
    
    try {
      const result = await db.execute(
        sql`SELECT redeem_voucher_atomic(${data.voucherId}::uuid, ${data.amount}::numeric) as success`
      );
      
      if (result.rows[0]?.success) {
        await db.insert(eVoucherRedemptions).values({
          voucherId: data.voucherId,
          amount: data.amount,
          nayaxSessionId: data.nayaxSessionId,
          locationId: data.locationId || null
        });
        
        const updatedVoucher = await this.getEVoucher(data.voucherId);
        return {
          success: true,
          remainingAmount: updatedVoucher?.remainingAmount,
          status: updatedVoucher?.status
        };
      }
      return { success: false, error: 'REDEMPTION_FAILED' };
    } catch (error) {
      return { success: false, error: 'REDEMPTION_FAILED' };
    }
  }

  async getMyVouchers(ownerUid: string, options?: { limit?: number; cursor?: string }): Promise<{ vouchers: EVoucher[]; hasMore: boolean; nextCursor?: string }> {
    const limit = options?.limit || 20;
    const cursor = options?.cursor;

    const vouchers = await db
      .select()
      .from(eVouchers)
      .where(
        cursor 
          ? and(eq(eVouchers.ownerUid, ownerUid), sql`${eVouchers.id} > ${cursor}::uuid`)
          : eq(eVouchers.ownerUid, ownerUid)
      )
      .orderBy(desc(eVouchers.createdAt))
      .limit(limit + 1);

    const hasMore = vouchers.length > limit;
    const results = hasMore ? vouchers.slice(0, limit) : vouchers;
    const nextCursor = hasMore && results.length > 0 ? results[results.length - 1].id : undefined;

    return {
      vouchers: results,
      hasMore,
      nextCursor
    };
  }

  async getVoucherByIdForOwner(voucherId: string, ownerUid: string): Promise<EVoucher | undefined> {
    const [voucher] = await db
      .select()
      .from(eVouchers)
      .where(and(eq(eVouchers.id, voucherId), eq(eVouchers.ownerUid, ownerUid)));
    return voucher || undefined;
  }

  async getUserEVouchers(userId: string): Promise<EVoucher[]> {
    return await db
      .select()
      .from(eVouchers)
      .where(eq(eVouchers.ownerUid, userId))
      .orderBy(desc(eVouchers.createdAt));
  }

  // E-Voucher Redemption operations
  async createEVoucherRedemption(redemption: InsertEVoucherRedemption): Promise<EVoucherRedemption> {
    const [createdRedemption] = await db
      .insert(eVoucherRedemptions)
      .values(redemption)
      .returning();
    return createdRedemption;
  }

  async getVoucherRedemptions(voucherId: string): Promise<EVoucherRedemption[]> {
    return await db
      .select()
      .from(eVoucherRedemptions)
      .where(eq(eVoucherRedemptions.voucherId, voucherId))
      .orderBy(eVoucherRedemptions.createdAt);
  }

  // Legacy gift card operations (backward compatibility)
  async createGiftCard(giftCard: InsertGiftCard): Promise<GiftCard> {
    return await this.createEVoucher(giftCard as InsertEVoucher);
  }

  async getGiftCard(codeHash: string): Promise<GiftCard | undefined> {
    return await this.getEVoucherByCodeHash(codeHash);
  }

  async redeemGiftCard(codeHash: string, userId: string): Promise<GiftCard | null> {
    return await this.claimVoucher(codeHash, userId);
  }

  async getGiftCardById(id: string): Promise<GiftCard | undefined> {
    return await this.getEVoucher(id);
  }

  async getAllGiftCards(options?: { limit?: number; cursor?: string }): Promise<{ giftCards: GiftCard[]; hasMore: boolean; nextCursor?: string }> {
    const limit = options?.limit || 50;
    const cursor = options?.cursor;

    const giftCards = await db
      .select()
      .from(eVouchers)
      .where(cursor ? sql`${eVouchers.id} > ${cursor}::uuid` : sql`1=1`)
      .orderBy(desc(eVouchers.createdAt))
      .limit(limit + 1);

    const hasMore = giftCards.length > limit;
    const results = hasMore ? giftCards.slice(0, limit) : giftCards;
    const nextCursor = hasMore && results.length > 0 ? results[results.length - 1].id : undefined;

    return {
      giftCards: results,
      hasMore,
      nextCursor
    };
  }

  // Wash history
  async createWashHistory(history: InsertWashHistory): Promise<WashHistory> {
    const [record] = await db.insert(washHistory).values(history).returning();
    return record;
  }

  async getUserWashHistory(userId: string): Promise<WashHistory[]> {
    return await db
      .select()
      .from(washHistory)
      .where(eq(washHistory.userId, userId))
      .orderBy(desc(washHistory.createdAt));
  }

  async getCustomerWashHistory(customerId: number): Promise<WashHistory[]> {
    // Get customer's email first
    const customer = await this.getCustomer(customerId);
    if (!customer) {
      return [];
    }
    
    // Find corresponding user by email
    const user = await this.getUserByEmail(customer.email);
    if (!user) {
      return [];
    }
    
    // Get wash history for the user
    return await this.getUserWashHistory(user.id);
  }

  async getAllWashHistory(): Promise<WashHistory[]> {
    return await db
      .select()
      .from(washHistory)
      .orderBy(desc(washHistory.createdAt));
  }

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    return await db.select().from(coupons).where(eq(coupons.isActive, true));
  }

  async getCoupon(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code));
    return coupon;
  }

  async useCoupon(userId: string, couponId: number): Promise<void> {
    await db.insert(userCoupons).values({
      userId,
      couponId,
    });
  }

  // Admin operations
  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return admin;
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return admin;
  }

  async createAdminUser(adminData: InsertAdminUser): Promise<AdminUser> {
    const [admin] = await db.insert(adminUsers).values(adminData).returning();
    return admin;
  }

  async updateAdminUser(id: string, updates: Partial<AdminUser>): Promise<AdminUser> {
    const [admin] = await db
      .update(adminUsers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(adminUsers.id, id))
      .returning();
    return admin;
  }

  async getAllAdminUsers(): Promise<AdminUser[]> {
    return await db.select().from(adminUsers).orderBy(desc(adminUsers.createdAt));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  // Admin activity logs
  async createAdminActivityLog(logData: InsertAdminActivityLog): Promise<AdminActivityLog> {
    const [log] = await db.insert(adminActivityLogs).values(logData).returning();
    return log;
  }

  async getAdminActivityLogs(adminId?: string, limit = 100): Promise<AdminActivityLog[]> {
    const query = db.select().from(adminActivityLogs);
    
    if (adminId) {
      query.where(eq(adminActivityLogs.adminId, adminId));
    }
    
    return await query.orderBy(desc(adminActivityLogs.timestamp)).limit(limit);
  }

  // Inventory management
  async getInventoryItems(location?: string): Promise<InventoryItem[]> {
    const query = db.select().from(inventoryItems);
    
    if (location) {
      query.where(eq(inventoryItems.location, location));
    }
    
    return await query.orderBy(inventoryItems.name);
  }

  async getInventoryItem(id: number): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return item;
  }

  async createInventoryItem(itemData: InsertInventoryItem): Promise<InventoryItem> {
    const [item] = await db.insert(inventoryItems).values(itemData).returning();
    return item;
  }

  async updateInventoryItem(id: number, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    const [item] = await db
      .update(inventoryItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(inventoryItems.id, id))
      .returning();
    return item;
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    const result = await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getLowStockItems(location?: string): Promise<InventoryItem[]> {
    const query = db.select().from(inventoryItems);
    
    if (location) {
      query.where(
        and(
          eq(inventoryItems.location, location),
          eq(inventoryItems.currentStock, inventoryItems.minStock)
        )
      );
    } else {
      query.where(eq(inventoryItems.currentStock, inventoryItems.minStock));
    }
    
    return await query.orderBy(inventoryItems.name);
  }

  // HR document management
  async getHRDocuments(location?: string, employeeType?: string): Promise<HRDocument[]> {
    const query = db.select().from(hrDocuments);
    
    const conditions = [];
    if (location) conditions.push(eq(hrDocuments.location, location));
    if (employeeType) conditions.push(eq(hrDocuments.employeeType, employeeType));
    
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(hrDocuments.uploadedAt));
  }

  async getHRDocument(id: number): Promise<HRDocument | undefined> {
    const [document] = await db.select().from(hrDocuments).where(eq(hrDocuments.id, id));
    return document;
  }

  async createHRDocument(documentData: InsertHRDocument): Promise<HRDocument> {
    const [document] = await db.insert(hrDocuments).values(documentData).returning();
    return document;
  }

  async updateHRDocument(id: number, updates: Partial<HRDocument>): Promise<HRDocument> {
    const [document] = await db
      .update(hrDocuments)
      .set(updates)
      .where(eq(hrDocuments.id, id))
      .returning();
    return document;
  }

  async deleteHRDocument(id: number): Promise<boolean> {
    const result = await db.delete(hrDocuments).where(eq(hrDocuments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Loyalty analytics
  async getLoyaltyAnalytics(userId?: string): Promise<LoyaltyAnalytics[]> {
    const query = db.select().from(loyaltyAnalytics);
    
    if (userId) {
      query.where(eq(loyaltyAnalytics.userId, userId));
    }
    
    return await query.orderBy(desc(loyaltyAnalytics.lifetimeValue));
  }

  async updateLoyaltyAnalytics(userId: string, updates: Partial<LoyaltyAnalytics>): Promise<LoyaltyAnalytics> {
    const [analytics] = await db
      .update(loyaltyAnalytics)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(loyaltyAnalytics.userId, userId))
      .returning();
    return analytics;
  }

  async getUsersByTier(tier: string): Promise<User[]> {
    const analyticsData = await db.select().from(loyaltyAnalytics).where(eq(loyaltyAnalytics.currentTier, tier));
    const userIds = analyticsData.map(a => a.userId);
    
    if (userIds.length === 0) return [];
    
    return await db.select().from(users).where(eq(users.id, userIds[0])); // This would need proper IN clause
  }

  async getTopCustomers(limit = 10): Promise<LoyaltyAnalytics[]> {
    return await db.select().from(loyaltyAnalytics)
      .orderBy(desc(loyaltyAnalytics.lifetimeValue))
      .limit(limit);
  }

  // Smart Wash Receipts
  async createSmartReceipt(receipt: InsertSmartWashReceipt): Promise<SmartWashReceipt> {
    const [createdReceipt] = await db
      .insert(smartWashReceipts)
      .values(receipt)
      .returning();
    return createdReceipt;
  }

  async getSmartReceiptByTransactionId(transactionId: string): Promise<SmartWashReceipt | undefined> {
    const [receipt] = await db
      .select()
      .from(smartWashReceipts)
      .where(eq(smartWashReceipts.transactionId, transactionId));
    return receipt;
  }

  async getUserSmartReceipts(userId: string, limit = 10): Promise<SmartWashReceipt[]> {
    return await db
      .select()
      .from(smartWashReceipts)
      .where(eq(smartWashReceipts.userId, userId))
      .orderBy(desc(smartWashReceipts.washDateTime))
      .limit(limit);
  }

  async updateSmartReceipt(transactionId: string, updates: Partial<SmartWashReceipt>): Promise<SmartWashReceipt> {
    const [updatedReceipt] = await db
      .update(smartWashReceipts)
      .set(updates)
      .where(eq(smartWashReceipts.transactionId, transactionId))
      .returning();
    return updatedReceipt;
  }

  // =================== CRM IMPLEMENTATIONS ===================

  // Lead Management
  async createLead(leadData: InsertCrmLead): Promise<CrmLead> {
    const [lead] = await db
      .insert(crmLeads)
      .values({
        ...leadData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return lead;
  }

  async getLead(id: number): Promise<CrmLead | undefined> {
    const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, id));
    return lead;
  }

  async getLeadByEmail(email: string): Promise<CrmLead | undefined> {
    const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.email, email));
    return lead;
  }

  async updateLead(id: number, updates: Partial<CrmLead>): Promise<CrmLead> {
    const [lead] = await db
      .update(crmLeads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmLeads.id, id))
      .returning();
    return lead;
  }

  async getLeads(filters: {
    assignedTo?: string;
    leadStatus?: string;
    leadSource?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<CrmLead[]> {
    let query = db.select().from(crmLeads);
    
    // Build conditions array to properly combine filters
    const conditions = [];
    if (filters.assignedTo) {
      conditions.push(eq(crmLeads.assignedTo, filters.assignedTo));
    }
    if (filters.leadStatus) {
      conditions.push(eq(crmLeads.leadStatus, filters.leadStatus));
    }
    if (filters.leadSource) {
      conditions.push(eq(crmLeads.leadSource, filters.leadSource));
    }
    
    // Apply combined conditions using and()
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(crmLeads.createdAt));
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async convertLeadToCustomer(leadId: number, customerId: number): Promise<CrmLead> {
    const [lead] = await db
      .update(crmLeads)
      .set({
        leadStatus: 'converted',
        convertedToCustomerId: customerId,
        convertedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crmLeads.id, leadId))
      .returning();
    return lead;
  }

  async getLeadsByAssignee(assigneeId: string): Promise<CrmLead[]> {
    return await db
      .select()
      .from(crmLeads)
      .where(eq(crmLeads.assignedTo, assigneeId))
      .orderBy(desc(crmLeads.createdAt));
  }

  // Communication History
  async createCommunication(communicationData: InsertCrmCommunication): Promise<CrmCommunication> {
    const [communication] = await db
      .insert(crmCommunications)
      .values({
        ...communicationData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return communication;
  }

  async getCommunication(id: number): Promise<CrmCommunication | undefined> {
    const [communication] = await db.select().from(crmCommunications).where(eq(crmCommunications.id, id));
    return communication;
  }

  async getCommunications(filters: {
    leadId?: number;
    customerId?: number;
    userId?: string;
    communicationType?: string;
    createdBy?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<CrmCommunication[]> {
    let query = db.select().from(crmCommunications);
    
    // Build conditions array to properly combine filters
    const conditions = [];
    if (filters.leadId) {
      conditions.push(eq(crmCommunications.leadId, filters.leadId));
    }
    if (filters.customerId) {
      conditions.push(eq(crmCommunications.customerId, filters.customerId));
    }
    if (filters.userId) {
      conditions.push(eq(crmCommunications.userId, filters.userId));
    }
    if (filters.communicationType) {
      conditions.push(eq(crmCommunications.communicationType, filters.communicationType));
    }
    if (filters.createdBy) {
      conditions.push(eq(crmCommunications.createdBy, filters.createdBy));
    }
    
    // Apply combined conditions using and()
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(crmCommunications.createdAt));
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async updateCommunication(id: number, updates: Partial<CrmCommunication>): Promise<CrmCommunication> {
    const [communication] = await db
      .update(crmCommunications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmCommunications.id, id))
      .returning();
    return communication;
  }

  async getEntityCommunications(entityType: 'lead' | 'customer' | 'user', entityId: string | number): Promise<CrmCommunication[]> {
    let query = db.select().from(crmCommunications);
    
    switch (entityType) {
      case 'lead':
        query = query.where(eq(crmCommunications.leadId, entityId as number));
        break;
      case 'customer':
        query = query.where(eq(crmCommunications.customerId, entityId as number));
        break;
      case 'user':
        query = query.where(eq(crmCommunications.userId, entityId as string));
        break;
    }
    
    return await query.orderBy(desc(crmCommunications.createdAt));
  }

  // Deal Stages
  async createDealStage(stageData: InsertCrmDealStage): Promise<CrmDealStage> {
    const [stage] = await db
      .insert(crmDealStages)
      .values({
        ...stageData,
        createdAt: new Date(),
      })
      .returning();
    return stage;
  }

  async getDealStage(id: number): Promise<CrmDealStage | undefined> {
    const [stage] = await db.select().from(crmDealStages).where(eq(crmDealStages.id, id));
    return stage;
  }

  async getDealStages(): Promise<CrmDealStage[]> {
    return await db
      .select()
      .from(crmDealStages)
      .where(eq(crmDealStages.isActive, true))
      .orderBy(crmDealStages.sortOrder);
  }

  async updateDealStage(id: number, updates: Partial<CrmDealStage>): Promise<CrmDealStage> {
    const [stage] = await db
      .update(crmDealStages)
      .set(updates)
      .where(eq(crmDealStages.id, id))
      .returning();
    return stage;
  }

  async deleteDealStage(id: number): Promise<boolean> {
    const result = await db
      .update(crmDealStages)
      .set({ isActive: false })
      .where(eq(crmDealStages.id, id));
    return result.rowCount > 0;
  }

  // Opportunities (Sales Pipeline)
  async createOpportunity(opportunityData: InsertCrmOpportunity): Promise<CrmOpportunity> {
    const [opportunity] = await db
      .insert(crmOpportunities)
      .values({
        ...opportunityData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return opportunity;
  }

  async getOpportunity(id: number): Promise<CrmOpportunity | undefined> {
    const [opportunity] = await db.select().from(crmOpportunities).where(eq(crmOpportunities.id, id));
    return opportunity;
  }

  async getOpportunities(filters: {
    assignedTo?: string;
    dealStageId?: number;
    status?: string;
    leadId?: number;
    customerId?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<CrmOpportunity[]> {
    let query = db.select().from(crmOpportunities);
    
    // Build conditions array to properly combine filters
    const conditions = [];
    if (filters.assignedTo) {
      conditions.push(eq(crmOpportunities.assignedTo, filters.assignedTo));
    }
    if (filters.dealStageId) {
      conditions.push(eq(crmOpportunities.dealStageId, filters.dealStageId));
    }
    if (filters.status) {
      conditions.push(eq(crmOpportunities.status, filters.status));
    }
    if (filters.leadId) {
      conditions.push(eq(crmOpportunities.leadId, filters.leadId));
    }
    if (filters.customerId) {
      conditions.push(eq(crmOpportunities.customerId, filters.customerId));
    }
    
    // Apply combined conditions using and()
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(crmOpportunities.createdAt));
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async updateOpportunity(id: number, updates: Partial<CrmOpportunity>): Promise<CrmOpportunity> {
    const [opportunity] = await db
      .update(crmOpportunities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmOpportunities.id, id))
      .returning();
    return opportunity;
  }

  async getOpportunitiesByAssignee(assigneeId: string): Promise<CrmOpportunity[]> {
    return await db
      .select()
      .from(crmOpportunities)
      .where(eq(crmOpportunities.assignedTo, assigneeId))
      .orderBy(desc(crmOpportunities.createdAt));
  }

  async getForecastData(assigneeId?: string, timeframe: 'this_month' | 'next_month' | 'this_quarter' = 'this_month'): Promise<any> {
    // This would implement sales forecasting logic
    // For now, return a basic structure
    return {
      totalValue: 0,
      expectedCloses: 0,
      winProbability: 0,
      opportunities: []
    };
  }

  // Tasks & Activities
  async createTask(taskData: InsertCrmTask): Promise<CrmTask> {
    const [task] = await db
      .insert(crmTasks)
      .values({
        ...taskData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return task;
  }

  async getTask(id: number): Promise<CrmTask | undefined> {
    const [task] = await db.select().from(crmTasks).where(eq(crmTasks.id, id));
    return task;
  }

  async getTasks(filters: {
    assignedTo?: string;
    status?: string;
    priority?: string;
    taskType?: string;
    dueDate?: string;
    leadId?: number;
    customerId?: number;
    opportunityId?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<CrmTask[]> {
    let query = db.select().from(crmTasks);
    
    // Build conditions array to properly combine filters
    const conditions = [];
    if (filters.assignedTo) {
      conditions.push(eq(crmTasks.assignedTo, filters.assignedTo));
    }
    if (filters.status) {
      conditions.push(eq(crmTasks.status, filters.status));
    }
    if (filters.priority) {
      conditions.push(eq(crmTasks.priority, filters.priority));
    }
    if (filters.taskType) {
      conditions.push(eq(crmTasks.taskType, filters.taskType));
    }
    if (filters.leadId) {
      conditions.push(eq(crmTasks.leadId, filters.leadId));
    }
    if (filters.customerId) {
      conditions.push(eq(crmTasks.customerId, filters.customerId));
    }
    if (filters.opportunityId) {
      conditions.push(eq(crmTasks.opportunityId, filters.opportunityId));
    }
    
    // Apply combined conditions using and()
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(crmTasks.dueDate);
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async updateTask(id: number, updates: Partial<CrmTask>): Promise<CrmTask> {
    const [task] = await db
      .update(crmTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmTasks.id, id))
      .returning();
    return task;
  }

  async completeTask(id: number, completedBy: string, outcome?: string, notes?: string): Promise<CrmTask> {
    const [task] = await db
      .update(crmTasks)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completedBy,
        outcome,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(crmTasks.id, id))
      .returning();
    return task;
  }

  async getTasksByAssignee(assigneeId: string): Promise<CrmTask[]> {
    return await db
      .select()
      .from(crmTasks)
      .where(eq(crmTasks.assignedTo, assigneeId))
      .orderBy(crmTasks.dueDate);
  }

  async getOverdueTasks(assigneeId?: string): Promise<CrmTask[]> {
    const now = new Date();
    
    // Build conditions array to properly combine filters
    const conditions = [
      eq(crmTasks.status, 'pending'),
      lt(crmTasks.dueDate, now) // Tasks where due date is in the past
    ];
    
    if (assigneeId) {
      conditions.push(eq(crmTasks.assignedTo, assigneeId));
    }
    
    return await db
      .select()
      .from(crmTasks)
      .where(and(...conditions))
      .orderBy(crmTasks.dueDate);
  }

  async getUpcomingTasks(assigneeId?: string, days = 7): Promise<CrmTask[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000); // Add days to current date
    
    // Build conditions array to properly combine filters
    const conditions = [
      eq(crmTasks.status, 'pending'),
      gte(crmTasks.dueDate, now), // Tasks due from now onwards
      lte(crmTasks.dueDate, futureDate) // Tasks due within the specified days
    ];
    
    if (assigneeId) {
      conditions.push(eq(crmTasks.assignedTo, assigneeId));
    }
    
    return await db
      .select()
      .from(crmTasks)
      .where(and(...conditions))
      .orderBy(crmTasks.dueDate);
  }

  // Activity Log
  async createActivity(activityData: InsertCrmActivity): Promise<CrmActivity> {
    const [activity] = await db
      .insert(crmActivities)
      .values({
        ...activityData,
        createdAt: new Date(),
      })
      .returning();
    return activity;
  }

  async getActivity(id: number): Promise<CrmActivity | undefined> {
    const [activity] = await db.select().from(crmActivities).where(eq(crmActivities.id, id));
    return activity;
  }

  async getActivities(filters: {
    leadId?: number;
    customerId?: number;
    userId?: string;
    opportunityId?: number;
    performedBy?: string;
    activityType?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<CrmActivity[]> {
    let query = db.select().from(crmActivities);
    
    // Build conditions array to properly combine filters
    const conditions = [];
    if (filters.leadId) {
      conditions.push(eq(crmActivities.leadId, filters.leadId));
    }
    if (filters.customerId) {
      conditions.push(eq(crmActivities.customerId, filters.customerId));
    }
    if (filters.userId) {
      conditions.push(eq(crmActivities.userId, filters.userId));
    }
    if (filters.opportunityId) {
      conditions.push(eq(crmActivities.opportunityId, filters.opportunityId));
    }
    if (filters.performedBy) {
      conditions.push(eq(crmActivities.performedBy, filters.performedBy));
    }
    if (filters.activityType) {
      conditions.push(eq(crmActivities.activityType, filters.activityType));
    }
    
    // Apply combined conditions using and()
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(crmActivities.activityDate));
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async getEntityActivities(entityType: 'lead' | 'customer' | 'user' | 'opportunity', entityId: string | number): Promise<CrmActivity[]> {
    let query = db.select().from(crmActivities);
    
    switch (entityType) {
      case 'lead':
        query = query.where(eq(crmActivities.leadId, entityId as number));
        break;
      case 'customer':
        query = query.where(eq(crmActivities.customerId, entityId as number));
        break;
      case 'user':
        query = query.where(eq(crmActivities.userId, entityId as string));
        break;
      case 'opportunity':
        query = query.where(eq(crmActivities.opportunityId, entityId as number));
        break;
    }
    
    return await query.orderBy(desc(crmActivities.activityDate));
  }

  // Stub implementations for remaining CRM methods (campaigns, segments, insights, touchpoints)
  async createCampaign(campaignData: InsertCrmCampaign): Promise<CrmCampaign> {
    const [campaign] = await db.insert(crmCampaigns).values(campaignData).returning();
    return campaign;
  }

  async getCampaign(id: number): Promise<CrmCampaign | undefined> {
    const [campaign] = await db.select().from(crmCampaigns).where(eq(crmCampaigns.id, id));
    return campaign;
  }

  async getCampaigns(filters: {
    status?: string;
    campaignType?: string;
    channel?: string;
    createdBy?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<CrmCampaign[]> {
    let query = db.select().from(crmCampaigns);
    
    // Build conditions array to properly combine filters
    const conditions = [];
    if (filters.status) {
      conditions.push(eq(crmCampaigns.status, filters.status));
    }
    if (filters.campaignType) {
      conditions.push(eq(crmCampaigns.campaignType, filters.campaignType));
    }
    if (filters.channel) {
      conditions.push(eq(crmCampaigns.channel, filters.channel));
    }
    if (filters.createdBy) {
      conditions.push(eq(crmCampaigns.createdBy, filters.createdBy));
    }
    
    // Apply combined conditions using and()
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(crmCampaigns.createdAt));
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async updateCampaign(id: number, updates: Partial<CrmCampaign>): Promise<CrmCampaign> {
    const [campaign] = await db.update(crmCampaigns).set(updates).where(eq(crmCampaigns.id, id)).returning();
    return campaign;
  }

  async deleteCampaign(id: number): Promise<boolean> {
    const result = await db.delete(crmCampaigns).where(eq(crmCampaigns.id, id));
    return result.rowCount > 0;
  }

  // Campaign Targets
  async createCampaignTarget(targetData: InsertCrmCampaignTarget): Promise<CrmCampaignTarget> {
    const [target] = await db.insert(crmCampaignTargets).values(targetData).returning();
    return target;
  }

  async getCampaignTarget(id: number): Promise<CrmCampaignTarget | undefined> {
    const [target] = await db.select().from(crmCampaignTargets).where(eq(crmCampaignTargets.id, id));
    return target;
  }

  async getCampaignTargets(campaignId: number): Promise<CrmCampaignTarget[]> {
    return await db.select().from(crmCampaignTargets).where(eq(crmCampaignTargets.campaignId, campaignId));
  }

  async updateCampaignTarget(id: number, updates: Partial<CrmCampaignTarget>): Promise<CrmCampaignTarget> {
    const [target] = await db.update(crmCampaignTargets).set(updates).where(eq(crmCampaignTargets.id, id)).returning();
    return target;
  }

  async addTargetsToCampaign(campaignId: number, targets: InsertCrmCampaignTarget[]): Promise<CrmCampaignTarget[]> {
    const targetData = targets.map(target => ({ ...target, campaignId }));
    return await db.insert(crmCampaignTargets).values(targetData).returning();
  }

  // Campaign Metrics
  async createCampaignMetrics(metricsData: InsertCrmCampaignMetrics): Promise<CrmCampaignMetrics> {
    const [metrics] = await db
      .insert(crmCampaignMetrics)
      .values({
        ...metricsData,
        lastCalculated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return metrics;
  }

  async getCampaignMetrics(campaignId: number): Promise<CrmCampaignMetrics | undefined> {
    const [metrics] = await db
      .select()
      .from(crmCampaignMetrics)
      .where(eq(crmCampaignMetrics.campaignId, campaignId));
    return metrics;
  }

  async updateCampaignMetrics(campaignId: number, updates: Partial<CrmCampaignMetrics>): Promise<CrmCampaignMetrics> {
    const [metrics] = await db
      .update(crmCampaignMetrics)
      .set({
        ...updates,
        lastCalculated: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crmCampaignMetrics.campaignId, campaignId))
      .returning();
    return metrics;
  }

  async calculateCampaignMetrics(campaignId: number): Promise<CrmCampaignMetrics> {
    // Get campaign targets to calculate metrics
    const targets = await db
      .select()
      .from(crmCampaignTargets)
      .where(eq(crmCampaignTargets.campaignId, campaignId));
    
    const totalTargets = targets.length;
    const totalSent = targets.filter(t => t.status === 'sent' || t.status === 'delivered' || t.status === 'opened' || t.status === 'clicked').length;
    const totalDelivered = targets.filter(t => t.status === 'delivered' || t.status === 'opened' || t.status === 'clicked').length;
    const totalBounced = targets.filter(t => t.status === 'bounced').length;
    const totalOpened = targets.filter(t => t.status === 'opened' || t.status === 'clicked').length;
    const totalClicked = targets.filter(t => t.status === 'clicked').length;
    const totalUnsubscribed = targets.filter(t => t.status === 'unsubscribed').length;
    const totalResponses = targets.filter(t => t.responded).length;
    const totalConversions = targets.filter(t => t.convertedTo && t.convertedTo !== 'none').length;
    const totalRevenue = targets.reduce((sum, t) => sum + Number(t.conversionValue || 0), 0);
    
    // Calculate rates
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
    const clickRate = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0;
    const conversionRate = totalDelivered > 0 ? (totalConversions / totalDelivered) * 100 : 0;
    const responseRate = totalDelivered > 0 ? (totalResponses / totalDelivered) * 100 : 0;
    
    // Get campaign cost
    const [campaign] = await db
      .select({ actualCost: crmCampaigns.actualCost, budget: crmCampaigns.budget })
      .from(crmCampaigns)
      .where(eq(crmCampaigns.id, campaignId));
    
    const cost = Number(campaign?.actualCost || campaign?.budget || 0);
    const roi = cost > 0 ? ((totalRevenue - cost) / cost) * 100 : 0;
    const costPerConversion = totalConversions > 0 ? cost / totalConversions : 0;
    const revenuePerTarget = totalTargets > 0 ? totalRevenue / totalTargets : 0;
    
    const metricsData: InsertCrmCampaignMetrics = {
      campaignId,
      totalTargets,
      totalSent,
      totalDelivered,
      totalBounced,
      totalUnsubscribed,
      totalOpened,
      totalClicked,
      uniqueOpens: totalOpened, // Simplified - would need more complex tracking for true uniques
      uniqueClicks: totalClicked, // Simplified
      totalResponses,
      totalConversions,
      totalRevenue: totalRevenue.toString(),
      newLeads: 0, // Would need to track lead creation from campaign
      newCustomers: 0, // Would need to track customer creation from campaign
      deliveryRate: deliveryRate.toString(),
      openRate: openRate.toString(),
      clickRate: clickRate.toString(),
      conversionRate: conversionRate.toString(),
      responseRate: responseRate.toString(),
      roi: roi.toString(),
      costPerConversion: costPerConversion.toString(),
      revenuePerTarget: revenuePerTarget.toString(),
    };
    
    // Upsert metrics
    const existingMetrics = await this.getCampaignMetrics(campaignId);
    if (existingMetrics) {
      return await this.updateCampaignMetrics(campaignId, metricsData);
    } else {
      return await this.createCampaignMetrics(metricsData);
    }
  }
  // Customer Segments
  async createCustomerSegment(segmentData: InsertCrmCustomerSegment): Promise<CrmCustomerSegment> {
    const [segment] = await db
      .insert(crmCustomerSegments)
      .values({
        ...segmentData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return segment;
  }

  async getCustomerSegment(id: number): Promise<CrmCustomerSegment | undefined> {
    const [segment] = await db
      .select()
      .from(crmCustomerSegments)
      .where(eq(crmCustomerSegments.id, id));
    return segment;
  }


  async updateCustomerSegment(id: number, updates: Partial<CrmCustomerSegment>): Promise<CrmCustomerSegment> {
    const [segment] = await db
      .update(crmCustomerSegments)
      .set({
        ...updates,
        lastUpdated: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crmCustomerSegments.id, id))
      .returning();
    return segment;
  }

  async deleteCustomerSegment(id: number): Promise<boolean> {
    const result = await db
      .delete(crmCustomerSegments)
      .where(eq(crmCustomerSegments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async refreshSegmentMembers(segmentId: number): Promise<void> {
    // This would implement logic to refresh segment membership based on criteria
    // For now, we'll implement a basic version that marks all members as active
    await db
      .update(crmCustomerSegmentMembers)
      .set({
        isActive: true,
        removedAt: null,
      })
      .where(eq(crmCustomerSegmentMembers.segmentId, segmentId));
  }

  // Customer Segment Members
  async addCustomerToSegment(segmentId: number, customerId?: number, userId?: string): Promise<CrmCustomerSegmentMember> {
    const [member] = await db
      .insert(crmCustomerSegmentMembers)
      .values({
        segmentId,
        customerId,
        userId,
        addedAt: new Date(),
        isActive: true,
      })
      .returning();
    return member;
  }

  async removeCustomerFromSegment(segmentId: number, customerId?: number, userId?: string): Promise<boolean> {
    let whereCondition;
    if (customerId) {
      whereCondition = and(
        eq(crmCustomerSegmentMembers.segmentId, segmentId),
        eq(crmCustomerSegmentMembers.customerId, customerId)
      );
    } else if (userId) {
      whereCondition = and(
        eq(crmCustomerSegmentMembers.segmentId, segmentId),
        eq(crmCustomerSegmentMembers.userId, userId)
      );
    } else {
      return false;
    }
    
    const result = await db
      .update(crmCustomerSegmentMembers)
      .set({
        isActive: false,
        removedAt: new Date(),
      })
      .where(whereCondition);
    return (result.rowCount ?? 0) > 0;
  }

  async getSegmentMembers(segmentId: number): Promise<CrmCustomerSegmentMember[]> {
    return await db
      .select()
      .from(crmCustomerSegmentMembers)
      .where(
        and(
          eq(crmCustomerSegmentMembers.segmentId, segmentId),
          eq(crmCustomerSegmentMembers.isActive, true)
        )
      )
      .orderBy(desc(crmCustomerSegmentMembers.addedAt));
  }

  async getCustomerSegments(customerId?: number, userId?: string): Promise<CrmCustomerSegment[]> {
    if (!customerId && !userId) {
      // Get all segments
      return await db
        .select()
        .from(crmCustomerSegments)
        .orderBy(desc(crmCustomerSegments.createdAt));
    }
    
    let whereCondition;
    if (customerId) {
      whereCondition = eq(crmCustomerSegmentMembers.customerId, customerId);
    } else if (userId) {
      whereCondition = eq(crmCustomerSegmentMembers.userId, userId);
    }
    
    const results = await db
      .select({
        id: crmCustomerSegments.id,
        name: crmCustomerSegments.name,
        description: crmCustomerSegments.description,
        criteria: crmCustomerSegments.criteria,
        segmentType: crmCustomerSegments.segmentType,
        isAutoUpdated: crmCustomerSegments.isAutoUpdated,
        lastUpdated: crmCustomerSegments.lastUpdated,
        createdBy: crmCustomerSegments.createdBy,
        createdAt: crmCustomerSegments.createdAt,
        updatedAt: crmCustomerSegments.updatedAt,
      })
      .from(crmCustomerSegments)
      .innerJoin(
        crmCustomerSegmentMembers,
        eq(crmCustomerSegments.id, crmCustomerSegmentMembers.segmentId)
      )
      .where(
        and(
          whereCondition!,
          eq(crmCustomerSegmentMembers.isActive, true)
        )
      );
    
    return results;
  }
  // Customer Insights
  async createCustomerInsights(insightsData: InsertCrmCustomerInsights): Promise<CrmCustomerInsights> {
    const [insights] = await db
      .insert(crmCustomerInsights)
      .values({
        ...insightsData,
        lastCalculated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return insights;
  }

  async getCustomerInsights(customerId?: number, userId?: string): Promise<CrmCustomerInsights | undefined> {
    let whereCondition;
    if (customerId) {
      whereCondition = eq(crmCustomerInsights.customerId, customerId);
    } else if (userId) {
      whereCondition = eq(crmCustomerInsights.userId, userId);
    } else {
      return undefined;
    }
    
    const [insights] = await db
      .select()
      .from(crmCustomerInsights)
      .where(whereCondition);
    return insights;
  }

  async updateCustomerInsights(customerId: number | null, userId: string | null, updates: Partial<CrmCustomerInsights>): Promise<CrmCustomerInsights> {
    let whereCondition;
    if (customerId) {
      whereCondition = eq(crmCustomerInsights.customerId, customerId);
    } else if (userId) {
      whereCondition = eq(crmCustomerInsights.userId, userId);
    } else {
      throw new Error('Either customerId or userId must be provided');
    }
    
    const [insights] = await db
      .update(crmCustomerInsights)
      .set({
        ...updates,
        lastCalculated: new Date(),
        updatedAt: new Date(),
      })
      .where(whereCondition)
      .returning();
    return insights;
  }

  async calculateCustomerInsights(customerId?: number, userId?: string): Promise<CrmCustomerInsights> {
    if (!customerId && !userId) {
      throw new Error('Either customerId or userId must be provided');
    }
    
    // Get customer data
    let customerData;
    if (customerId) {
      customerData = await this.getCustomer(customerId);
    } else if (userId) {
      customerData = await this.getUser(userId);
    }
    
    if (!customerData) {
      throw new Error('Customer/User not found');
    }
    
    // Calculate insights based on customer data
    const washHistoryData = userId ? await this.getUserWashHistory(userId) : [];
    
    // Calculate basic metrics
    const totalPurchases = washHistoryData.length;
    const totalLifetimeValue = washHistoryData.reduce((sum, wash) => sum + Number(wash.finalPrice), 0);
    const averageOrderValue = totalPurchases > 0 ? totalLifetimeValue / totalPurchases : 0;
    
    // Calculate days since last purchase
    const lastPurchaseDate = washHistoryData.length > 0 ? washHistoryData[0].createdAt : null;
    const daysSinceLastPurchase = lastPurchaseDate 
      ? Math.floor((Date.now() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    // Calculate purchase frequency (purchases per month)
    const firstPurchaseDate = washHistoryData.length > 0 ? washHistoryData[washHistoryData.length - 1].createdAt : null;
    let purchaseFrequency = 0;
    if (firstPurchaseDate && totalPurchases > 0) {
      const monthsActive = Math.max(1, (Date.now() - firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      purchaseFrequency = totalPurchases / monthsActive;
    }
    
    // Determine lifecycle stage
    let lifecycleStage = 'new';
    if (totalPurchases === 0) {
      lifecycleStage = 'new';
    } else if (daysSinceLastPurchase && daysSinceLastPurchase > 90) {
      lifecycleStage = 'dormant';
    } else if (daysSinceLastPurchase && daysSinceLastPurchase > 30) {
      lifecycleStage = 'at_risk';
    } else {
      lifecycleStage = 'active';
    }
    
    // Determine churn risk
    let churnRisk = 'low';
    let churnProbability = 0;
    if (daysSinceLastPurchase) {
      if (daysSinceLastPurchase > 60) {
        churnRisk = 'high';
        churnProbability = Math.min(90, 30 + (daysSinceLastPurchase - 60) * 0.5);
      } else if (daysSinceLastPurchase > 30) {
        churnRisk = 'medium';
        churnProbability = Math.min(50, 10 + (daysSinceLastPurchase - 30) * 0.8);
      } else {
        churnRisk = 'low';
        churnProbability = Math.max(5, 20 - daysSinceLastPurchase * 0.5);
      }
    }
    
    // Determine customer value
    let customerValue = 'medium';
    if (totalLifetimeValue > 1000) {
      customerValue = 'vip';
    } else if (totalLifetimeValue > 500) {
      customerValue = 'high';
    } else if (totalLifetimeValue < 100) {
      customerValue = 'low';
    }
    
    const insightsData: InsertCrmCustomerInsights = {
      customerId,
      userId,
      totalInteractions: totalPurchases, // Simplified
      lastInteractionDate: lastPurchaseDate,
      totalPurchases,
      averageOrderValue: averageOrderValue.toString(),
      totalLifetimeValue: totalLifetimeValue.toString(),
      lastPurchaseDate,
      daysSinceLastPurchase,
      purchaseFrequency: purchaseFrequency.toString(),
      churnRisk,
      churnProbability: churnProbability.toString(),
      lifecycleStage,
      customerValue,
      retentionScore: Math.max(10, Math.min(100, 100 - (daysSinceLastPurchase || 0) * 2)),
      leadScore: Math.min(100, (totalPurchases * 10) + (purchaseFrequency * 20)),
      upsellPotential: Math.min(100, Math.max(0, 50 + (purchaseFrequency * 30) - (daysSinceLastPurchase || 0))),
    };
    
    // Upsert insights
    const existingInsights = await this.getCustomerInsights(customerId, userId);
    if (existingInsights) {
      return await this.updateCustomerInsights(customerId, userId, insightsData);
    } else {
      return await this.createCustomerInsights(insightsData);
    }
  }

  async getCustomersAtRisk(riskLevel?: 'low' | 'medium' | 'high'): Promise<CrmCustomerInsights[]> {
    let query = db.select().from(crmCustomerInsights);
    
    if (riskLevel) {
      query = query.where(eq(crmCustomerInsights.churnRisk, riskLevel));
    }
    
    return await query.orderBy(desc(crmCustomerInsights.churnProbability));
  }

  async getHighValueCustomers(limit = 50): Promise<CrmCustomerInsights[]> {
    return await db
      .select()
      .from(crmCustomerInsights)
      .where(eq(crmCustomerInsights.customerValue, 'vip'))
      .orderBy(desc(crmCustomerInsights.totalLifetimeValue))
      .limit(limit);
  }
  // Customer Touchpoints
  async createTouchpoint(touchpointData: InsertCrmTouchpoint): Promise<CrmTouchpoint> {
    const [touchpoint] = await db
      .insert(crmTouchpoints)
      .values({
        ...touchpointData,
        touchpointDate: new Date(),
        createdAt: new Date(),
      })
      .returning();
    return touchpoint;
  }

  async getTouchpoint(id: number): Promise<CrmTouchpoint | undefined> {
    const [touchpoint] = await db
      .select()
      .from(crmTouchpoints)
      .where(eq(crmTouchpoints.id, id));
    return touchpoint;
  }

  async getTouchpoints(filters: {
    customerId?: number;
    userId?: string;
    leadId?: number;
    touchpointType?: string;
    channel?: string;
    campaignId?: number;
    sessionId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<CrmTouchpoint[]> {
    let query = db.select().from(crmTouchpoints);
    
    // Build conditions array to properly combine filters
    const conditions = [];
    if (filters.customerId) {
      conditions.push(eq(crmTouchpoints.customerId, filters.customerId));
    }
    if (filters.userId) {
      conditions.push(eq(crmTouchpoints.userId, filters.userId));
    }
    if (filters.leadId) {
      conditions.push(eq(crmTouchpoints.leadId, filters.leadId));
    }
    if (filters.touchpointType) {
      conditions.push(eq(crmTouchpoints.touchpointType, filters.touchpointType));
    }
    if (filters.channel) {
      conditions.push(eq(crmTouchpoints.channel, filters.channel));
    }
    if (filters.campaignId) {
      conditions.push(eq(crmTouchpoints.campaignId, filters.campaignId));
    }
    if (filters.sessionId) {
      conditions.push(eq(crmTouchpoints.sessionId, filters.sessionId));
    }
    
    // Apply combined conditions using and()
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(crmTouchpoints.touchpointDate));
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async getCustomerJourney(customerId?: number, userId?: string): Promise<CrmTouchpoint[]> {
    let whereCondition;
    if (customerId) {
      whereCondition = eq(crmTouchpoints.customerId, customerId);
    } else if (userId) {
      whereCondition = eq(crmTouchpoints.userId, userId);
    } else {
      return [];
    }
    
    return await db
      .select()
      .from(crmTouchpoints)
      .where(whereCondition)
      .orderBy(crmTouchpoints.touchpointDate); // Chronological order for journey
  }

  async getSessionTouchpoints(sessionId: string): Promise<CrmTouchpoint[]> {
    return await db
      .select()
      .from(crmTouchpoints)
      .where(eq(crmTouchpoints.sessionId, sessionId))
      .orderBy(crmTouchpoints.touchpointDate);
  }

  // =================== COMMUNICATION CENTER IMPLEMENTATIONS ===================

  // Email Templates
  async createEmailTemplate(templateData: InsertCrmEmailTemplate): Promise<CrmEmailTemplate> {
    const [template] = await db
      .insert(crmEmailTemplates)
      .values({
        ...templateData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return template;
  }

  async getEmailTemplate(id: number): Promise<CrmEmailTemplate | undefined> {
    const [template] = await db
      .select()
      .from(crmEmailTemplates)
      .where(eq(crmEmailTemplates.id, id));
    return template;
  }

  async getEmailTemplates(filters: {
    category?: string;
    isActive?: boolean;
    createdBy?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<CrmEmailTemplate[]> {
    let query = db.select().from(crmEmailTemplates);
    
    const conditions = [];
    if (filters.category) {
      conditions.push(eq(crmEmailTemplates.category, filters.category));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(crmEmailTemplates.isActive, filters.isActive));
    }
    if (filters.createdBy) {
      conditions.push(eq(crmEmailTemplates.createdBy, filters.createdBy));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(crmEmailTemplates.createdAt));
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async updateEmailTemplate(id: number, updates: Partial<CrmEmailTemplate>): Promise<CrmEmailTemplate> {
    const [template] = await db
      .update(crmEmailTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmEmailTemplates.id, id))
      .returning();
    return template;
  }

  async deleteEmailTemplate(id: number): Promise<boolean> {
    const result = await db
      .update(crmEmailTemplates)
      .set({ isActive: false })
      .where(eq(crmEmailTemplates.id, id));
    return result.rowCount > 0;
  }

  async getDefaultEmailTemplate(category: string): Promise<CrmEmailTemplate | undefined> {
    const [template] = await db
      .select()
      .from(crmEmailTemplates)
      .where(and(
        eq(crmEmailTemplates.category, category),
        eq(crmEmailTemplates.isDefault, true),
        eq(crmEmailTemplates.isActive, true)
      ));
    return template;
  }

  // SMS Templates
  async createSmsTemplate(templateData: InsertCrmSmsTemplate): Promise<CrmSmsTemplate> {
    const [template] = await db
      .insert(crmSmsTemplates)
      .values({
        ...templateData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return template;
  }

  async getSmsTemplate(id: number): Promise<CrmSmsTemplate | undefined> {
    const [template] = await db
      .select()
      .from(crmSmsTemplates)
      .where(eq(crmSmsTemplates.id, id));
    return template;
  }

  async getSmsTemplates(filters: {
    category?: string;
    isActive?: boolean;
    createdBy?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<CrmSmsTemplate[]> {
    let query = db.select().from(crmSmsTemplates);
    
    const conditions = [];
    if (filters.category) {
      conditions.push(eq(crmSmsTemplates.category, filters.category));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(crmSmsTemplates.isActive, filters.isActive));
    }
    if (filters.createdBy) {
      conditions.push(eq(crmSmsTemplates.createdBy, filters.createdBy));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(crmSmsTemplates.createdAt));
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async updateSmsTemplate(id: number, updates: Partial<CrmSmsTemplate>): Promise<CrmSmsTemplate> {
    const [template] = await db
      .update(crmSmsTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmSmsTemplates.id, id))
      .returning();
    return template;
  }

  async deleteSmsTemplate(id: number): Promise<boolean> {
    const result = await db
      .update(crmSmsTemplates)
      .set({ isActive: false })
      .where(eq(crmSmsTemplates.id, id));
    return result.rowCount > 0;
  }

  async getDefaultSmsTemplate(category: string): Promise<CrmSmsTemplate | undefined> {
    const [template] = await db
      .select()
      .from(crmSmsTemplates)
      .where(and(
        eq(crmSmsTemplates.category, category),
        eq(crmSmsTemplates.isDefault, true),
        eq(crmSmsTemplates.isActive, true)
      ));
    return template;
  }

  // Appointment Reminders
  async createAppointmentReminder(reminderData: InsertCrmAppointmentReminder): Promise<CrmAppointmentReminder> {
    const [reminder] = await db
      .insert(crmAppointmentReminders)
      .values({
        ...reminderData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return reminder;
  }

  async getAppointmentReminder(id: number): Promise<CrmAppointmentReminder | undefined> {
    const [reminder] = await db
      .select()
      .from(crmAppointmentReminders)
      .where(eq(crmAppointmentReminders.id, id));
    return reminder;
  }

  async getAppointmentReminders(filters: {
    customerId?: number;
    userId?: string;
    status?: string;
    appointmentDate?: string;
    reminderType?: string;
    isScheduled?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<CrmAppointmentReminder[]> {
    let query = db.select().from(crmAppointmentReminders);
    
    const conditions = [];
    if (filters.customerId) {
      conditions.push(eq(crmAppointmentReminders.customerId, filters.customerId));
    }
    if (filters.userId) {
      conditions.push(eq(crmAppointmentReminders.userId, filters.userId));
    }
    if (filters.status) {
      conditions.push(eq(crmAppointmentReminders.status, filters.status));
    }
    if (filters.appointmentDate) {
      const appointmentDate = new Date(filters.appointmentDate);
      conditions.push(eq(crmAppointmentReminders.appointmentDate, appointmentDate));
    }
    if (filters.reminderType) {
      conditions.push(eq(crmAppointmentReminders.reminderType, filters.reminderType));
    }
    if (filters.isScheduled !== undefined) {
      conditions.push(eq(crmAppointmentReminders.isScheduled, filters.isScheduled));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(crmAppointmentReminders.scheduledSendTime));
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async updateAppointmentReminder(id: number, updates: Partial<CrmAppointmentReminder>): Promise<CrmAppointmentReminder> {
    const [reminder] = await db
      .update(crmAppointmentReminders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmAppointmentReminders.id, id))
      .returning();
    return reminder;
  }

  async cancelAppointmentReminder(id: number, cancelledBy: string, reason?: string): Promise<CrmAppointmentReminder> {
    const [reminder] = await db
      .update(crmAppointmentReminders)
      .set({
        isCancelled: true,
        cancelledBy,
        cancelledAt: new Date(),
        cancellationReason: reason,
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(crmAppointmentReminders.id, id))
      .returning();
    return reminder;
  }

  async getScheduledReminders(cutoffDate?: Date): Promise<CrmAppointmentReminder[]> {
    const cutoff = cutoffDate || new Date();
    
    return await db
      .select()
      .from(crmAppointmentReminders)
      .where(and(
        eq(crmAppointmentReminders.status, 'scheduled'),
        eq(crmAppointmentReminders.isScheduled, true),
        eq(crmAppointmentReminders.isCancelled, false),
        lte(crmAppointmentReminders.scheduledSendTime, cutoff)
      ))
      .orderBy(crmAppointmentReminders.scheduledSendTime);
  }

  async getPendingReminders(): Promise<CrmAppointmentReminder[]> {
    const now = new Date();
    
    return await db
      .select()
      .from(crmAppointmentReminders)
      .where(and(
        eq(crmAppointmentReminders.status, 'scheduled'),
        eq(crmAppointmentReminders.isScheduled, true),
        eq(crmAppointmentReminders.isCancelled, false),
        lte(crmAppointmentReminders.scheduledSendTime, now)
      ))
      .orderBy(crmAppointmentReminders.scheduledSendTime);
  }

  // Communication Logs
  async createCommunicationLog(logData: InsertCrmCommunicationLog): Promise<CrmCommunicationLog> {
    const [log] = await db
      .insert(crmCommunicationLogs)
      .values({
        ...logData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return log;
  }

  async getCommunicationLog(id: number): Promise<CrmCommunicationLog | undefined> {
    const [log] = await db
      .select()
      .from(crmCommunicationLogs)
      .where(eq(crmCommunicationLogs.id, id));
    return log;
  }

  async getCommunicationLogsByCommunication(communicationId: number): Promise<CrmCommunicationLog[]> {
    return await db
      .select()
      .from(crmCommunicationLogs)
      .where(eq(crmCommunicationLogs.communicationId, communicationId))
      .orderBy(desc(crmCommunicationLogs.createdAt));
  }

  async updateCommunicationLog(id: number, updates: Partial<CrmCommunicationLog>): Promise<CrmCommunicationLog> {
    const [log] = await db
      .update(crmCommunicationLogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmCommunicationLogs.id, id))
      .returning();
    return log;
  }

  async trackEmailOpen(communicationId: number, logId?: number): Promise<CrmCommunicationLog> {
    const targetLogId = logId || (await this.getCommunicationLogsByCommunication(communicationId))?.[0]?.id;
    
    if (!targetLogId) {
      throw new Error('Communication log not found');
    }
    
    const [log] = await db
      .update(crmCommunicationLogs)
      .set({
        opened: true,
        openedAt: new Date(),
        openCount: sql`${crmCommunicationLogs.openCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(crmCommunicationLogs.id, targetLogId))
      .returning();
    return log;
  }

  async trackEmailClick(communicationId: number, logId?: number): Promise<CrmCommunicationLog> {
    const targetLogId = logId || (await this.getCommunicationLogsByCommunication(communicationId))?.[0]?.id;
    
    if (!targetLogId) {
      throw new Error('Communication log not found');
    }
    
    const [log] = await db
      .update(crmCommunicationLogs)
      .set({
        clicked: true,
        clickedAt: new Date(),
        clickCount: sql`${crmCommunicationLogs.clickCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(crmCommunicationLogs.id, targetLogId))
      .returning();
    return log;
  }

  // Communication Center Analytics
  async getCommunicationStats(dateFrom?: Date, dateTo?: Date): Promise<{
    totalCommunications: number;
    emailsSent: number;
    smsSent: number;
    emailsOpened: number;
    emailsClicked: number;
    smsDelivered: number;
    totalTemplatesUsed: number;
    activeReminders: number;
    completedReminders: number;
  }> {
    const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const to = dateTo || new Date();

    // Total communications in date range
    const totalCommunications = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmCommunications)
      .where(and(
        gte(crmCommunications.createdAt, from),
        lte(crmCommunications.createdAt, to)
      ));

    // Email and SMS communications
    const emailsSent = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmCommunications)
      .where(and(
        eq(crmCommunications.communicationType, 'email'),
        gte(crmCommunications.createdAt, from),
        lte(crmCommunications.createdAt, to)
      ));

    const smsSent = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmCommunications)
      .where(and(
        eq(crmCommunications.communicationType, 'sms'),
        gte(crmCommunications.createdAt, from),
        lte(crmCommunications.createdAt, to)
      ));

    // Email engagement stats
    const emailsOpened = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmCommunicationLogs)
      .where(and(
        eq(crmCommunicationLogs.opened, true),
        gte(crmCommunicationLogs.createdAt, from),
        lte(crmCommunicationLogs.createdAt, to)
      ));

    const emailsClicked = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmCommunicationLogs)
      .where(and(
        eq(crmCommunicationLogs.clicked, true),
        gte(crmCommunicationLogs.createdAt, from),
        lte(crmCommunicationLogs.createdAt, to)
      ));

    // SMS delivery stats
    const smsDelivered = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmCommunicationLogs)
      .where(and(
        eq(crmCommunicationLogs.deliveryStatus, 'delivered'),
        gte(crmCommunicationLogs.createdAt, from),
        lte(crmCommunicationLogs.createdAt, to)
      ));

    // Template usage
    const emailTemplatesUsed = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmEmailTemplates)
      .where(and(
        sql`${crmEmailTemplates.timesUsed} > 0`,
        gte(crmEmailTemplates.lastUsed || crmEmailTemplates.createdAt, from),
        lte(crmEmailTemplates.lastUsed || crmEmailTemplates.createdAt, to)
      ));

    const smsTemplatesUsed = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmSmsTemplates)
      .where(and(
        sql`${crmSmsTemplates.timesUsed} > 0`,
        gte(crmSmsTemplates.lastUsed || crmSmsTemplates.createdAt, from),
        lte(crmSmsTemplates.lastUsed || crmSmsTemplates.createdAt, to)
      ));

    // Reminder stats
    const activeReminders = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmAppointmentReminders)
      .where(and(
        eq(crmAppointmentReminders.status, 'scheduled'),
        eq(crmAppointmentReminders.isCancelled, false)
      ));

    const completedReminders = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmAppointmentReminders)
      .where(and(
        or(
          eq(crmAppointmentReminders.status, 'sent'),
          eq(crmAppointmentReminders.status, 'delivered')
        ),
        gte(crmAppointmentReminders.createdAt, from),
        lte(crmAppointmentReminders.createdAt, to)
      ));

    return {
      totalCommunications: totalCommunications[0]?.count || 0,
      emailsSent: emailsSent[0]?.count || 0,
      smsSent: smsSent[0]?.count || 0,
      emailsOpened: emailsOpened[0]?.count || 0,
      emailsClicked: emailsClicked[0]?.count || 0,
      smsDelivered: smsDelivered[0]?.count || 0,
      totalTemplatesUsed: (emailTemplatesUsed[0]?.count || 0) + (smsTemplatesUsed[0]?.count || 0),
      activeReminders: activeReminders[0]?.count || 0,
      completedReminders: completedReminders[0]?.count || 0,
    };
  }

  // =================== ENTERPRISE OPERATIONS IMPLEMENTATIONS (Nov 2025) ===================
  
  // JV Partners - FULL IMPLEMENTATION
  async getAllJvPartners() {
    return await db.select().from(jvPartners).orderBy(desc(jvPartners.createdAt));
  }

  async getActiveJvPartners() {
    return await db.select().from(jvPartners).where(eq(jvPartners.isActive, true)).orderBy(jvPartners.partnerName);
  }

  async createJvPartner(data: any) {
    const [partner] = await db.insert(jvPartners).values(data).returning();
    return partner;
  }

  async updateJvPartner(id: number, updates: any) {
    const [partner] = await db.update(jvPartners).set(updates).where(eq(jvPartners.id, id)).returning();
    return partner;
  }

  async getJvPartnerContracts(partnerId: number) {
    return await db.select().from(jvContracts).where(eq(jvContracts.partnerId, partnerId)).orderBy(desc(jvContracts.startDate));
  }

  // Board Members - Stub implementations
  async getAllBoardMembers() { return []; }
  async getActiveBoardMembers() { return []; }
  async createBoardMember(data: any) { throw new Error("Not implemented"); }
  async updateBoardMember(id: number, updates: any) { throw new Error("Not implemented"); }
  
  // Board Meetings - Stub implementations
  async getAllBoardMeetings() { return []; }
  async getUpcomingBoardMeetings() { return []; }
  async createBoardMeeting(data: any) { throw new Error("Not implemented"); }
  async updateBoardMeeting(id: number, updates: any) { throw new Error("Not implemented"); }
  async addMeetingAttendee(meetingId: number, memberId: number, attended?: boolean) { throw new Error("Not implemented"); }
  
  // Suppliers - FULL IMPLEMENTATION
  async getAllSuppliers() {
    return await db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
  }
  
  async getActiveSuppliers() {
    return await db.select().from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.companyName);
  }
  
  async createSupplier(data: any) {
    const [supplier] = await db.insert(suppliers).values(data).returning();
    return supplier;
  }
  
  async updateSupplier(id: number, updates: any) {
    const [supplier] = await db.update(suppliers).set(updates).where(eq(suppliers.id, id)).returning();
    return supplier;
  }
  
  async getSupplierContracts(supplierId: number) {
    return await db.select().from(supplierContracts).where(eq(supplierContracts.supplierId, supplierId)).orderBy(desc(supplierContracts.createdAt));
  }
  
  async getSupplierPayments(supplierId: number) {
    return await db.select().from(supplierPayments).where(eq(supplierPayments.supplierId, supplierId)).orderBy(desc(supplierPayments.dueDate));
  }
  
  async createSupplierPayment(data: any) {
    const [payment] = await db.insert(supplierPayments).values(data).returning();
    return payment;
  }
  
  async getSupplierQualityScores(supplierId: number) {
    return await db.select().from(supplierQualityScores).where(eq(supplierQualityScores.supplierId, supplierId)).orderBy(desc(supplierQualityScores.evaluationDate));
  }
  
  async createSupplierQualityScore(data: any) {
    const [score] = await db.insert(supplierQualityScores).values(data).returning();
    return score;
  }
  
  // Station Registry
  async getAllStations() {
    return await db.select().from(stationRegistry).orderBy(stationRegistry.stationId);
  }

  async getStationByCanonicalId(canonicalId: string) {
    const [station] = await db.select().from(stationRegistry).where(eq(stationRegistry.stationId, canonicalId));
    return station;
  }

  async getStationsByCountry(country: string) {
    return await db.select().from(stationRegistry).where(eq(stationRegistry.country, country)).orderBy(stationRegistry.city);
  }

  async getStationsByCity(city: string) {
    return await db.select().from(stationRegistry).where(eq(stationRegistry.city, city)).orderBy(stationRegistry.stationId);
  }

  async getActiveStations() {
    return await db.select().from(stationRegistry).where(eq(stationRegistry.operatingStatus, "active")).orderBy(stationRegistry.stationId);
  }

  async createStation(data: any) {
    const [station] = await db.insert(stationRegistry).values(data).returning();
    return station;
  }

  async updateStation(id: number, updates: any) {
    const [station] = await db.update(stationRegistry).set(updates).where(eq(stationRegistry.id, id)).returning();
    return station;
  }

  async updateStationRevenue(id: number, revenue: number, washes: number) {
    const [station] = await db.update(stationRegistry)
      .set({ 
        monthlyRevenue: revenue.toString(),
        totalWashes: washes,
        updatedAt: new Date()
      })
      .where(eq(stationRegistry.id, id))
      .returning();
    return station;
  }
  
  // HR Employees
  async getAllEmployees() {
    return await db.select().from(hrEmployees).orderBy(hrEmployees.employeeId);
  }

  async getActiveEmployees() {
    return await db.select().from(hrEmployees).where(eq(hrEmployees.isActive, true)).orderBy(hrEmployees.employeeId);
  }

  async getEmployeeById(id: number) {
    const [employee] = await db.select().from(hrEmployees).where(eq(hrEmployees.id, id));
    return employee;
  }

  async getEmployeesByDepartment(department: string) {
    return await db.select().from(hrEmployees).where(eq(hrEmployees.department, department)).orderBy(hrEmployees.lastName);
  }

  async createEmployee(data: any) {
    const [employee] = await db.insert(hrEmployees).values(data).returning();
    return employee;
  }

  async updateEmployee(id: number, updates: any) {
    const [employee] = await db.update(hrEmployees).set({ ...updates, updatedAt: new Date() }).where(eq(hrEmployees.id, id)).returning();
    return employee;
  }

  // HR Payroll
  async getAllPayroll() {
    return await db.select().from(hrPayroll).orderBy(desc(hrPayroll.payPeriodEnd));
  }

  async getEmployeePayroll(employeeId: number) {
    return await db.select().from(hrPayroll).where(eq(hrPayroll.employeeId, employeeId)).orderBy(desc(hrPayroll.payPeriodEnd));
  }

  async createPayroll(data: any) {
    const [payroll] = await db.insert(hrPayroll).values(data).returning();
    return payroll;
  }

  async updatePayrollStatus(id: number, status: string) {
    const [payroll] = await db.update(hrPayroll).set({ paymentStatus: status }).where(eq(hrPayroll.id, id)).returning();
    return payroll;
  }

  // HR Time Tracking
  async getEmployeeTimeTracking(employeeId: number) {
    return await db.select().from(hrTimeTracking).where(eq(hrTimeTracking.employeeId, employeeId)).orderBy(desc(hrTimeTracking.clockInTime));
  }

  async getTimeTrackingByDateRange(employeeId: number, start: string, end: string) {
    return await db.select().from(hrTimeTracking)
      .where(and(
        eq(hrTimeTracking.employeeId, employeeId),
        gte(hrTimeTracking.clockInTime, new Date(start)),
        lte(hrTimeTracking.clockInTime, new Date(end))
      ))
      .orderBy(hrTimeTracking.clockInTime);
  }

  async clockIn(data: any) {
    const [entry] = await db.insert(hrTimeTracking).values(data).returning();
    return entry;
  }

  async clockOut(id: number, clockOutTime: string) {
    const clockOut = new Date(clockOutTime);
    
    const [existingEntry] = await db.select().from(hrTimeTracking).where(eq(hrTimeTracking.id, id));
    if (!existingEntry) throw new Error("Time entry not found");
    
    const clockIn = new Date(existingEntry.clockInTime);
    const diffMs = clockOut.getTime() - clockIn.getTime();
    const totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
    
    const [entry] = await db.update(hrTimeTracking)
      .set({ 
        clockOutTime: clockOut,
        totalHours: totalHours.toString()
      })
      .where(eq(hrTimeTracking.id, id))
      .returning();
    return entry;
  }

  async approveTimeEntry(id: number, approvedBy: number) {
    const [entry] = await db.update(hrTimeTracking)
      .set({ 
        approvalStatus: "approved",
        approvedBy
      })
      .where(eq(hrTimeTracking.id, id))
      .returning();
    return entry;
  }
  
  // HR Performance Reviews
  async getAllPerformanceReviews() {
    return await db.select().from(hrPerformanceReviews).orderBy(desc(hrPerformanceReviews.reviewDate));
  }

  async getEmployeeReviews(employeeId: number) {
    return await db.select().from(hrPerformanceReviews)
      .where(eq(hrPerformanceReviews.employeeId, employeeId))
      .orderBy(desc(hrPerformanceReviews.reviewDate));
  }

  async getReviewById(id: number) {
    const [review] = await db.select().from(hrPerformanceReviews).where(eq(hrPerformanceReviews.id, id));
    return review;
  }

  async getPendingReviews() {
    return await db.select().from(hrPerformanceReviews)
      .where(or(
        eq(hrPerformanceReviews.status, "draft"),
        eq(hrPerformanceReviews.status, "completed")
      ))
      .orderBy(desc(hrPerformanceReviews.reviewDate));
  }

  async createPerformanceReview(data: any) {
    const [review] = await db.insert(hrPerformanceReviews).values(data).returning();
    return review;
  }

  async updatePerformanceReview(id: number, updates: any) {
    const [review] = await db.update(hrPerformanceReviews)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(hrPerformanceReviews.id, id))
      .returning();
    if (!review) {
      throw new Error("Performance review not found");
    }
    return review;
  }

  async acknowledgeReview(id: number, signature: string) {
    const [review] = await db.update(hrPerformanceReviews)
      .set({ 
        employeeSignature: signature,
        status: "acknowledged",
        acknowledgedAt: new Date()
      })
      .where(eq(hrPerformanceReviews.id, id))
      .returning();
    if (!review) {
      throw new Error("Performance review not found");
    }
    return review;
  }
  
  // HR Recruitment
  async getAllJobOpenings() {
    return await db.select().from(hrRecruitment).orderBy(desc(hrRecruitment.postedDate));
  }

  async getOpenJobOpenings() {
    return await db.select().from(hrRecruitment)
      .where(eq(hrRecruitment.status, "open"))
      .orderBy(desc(hrRecruitment.postedDate));
  }

  async getJobOpeningById(id: number) {
    const [job] = await db.select().from(hrRecruitment).where(eq(hrRecruitment.id, id));
    return job;
  }

  async createJobOpening(data: any) {
    const [job] = await db.insert(hrRecruitment).values(data).returning();
    return job;
  }

  async updateJobOpening(id: number, updates: any) {
    const [job] = await db.update(hrRecruitment)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(hrRecruitment.id, id))
      .returning();
    if (!job) {
      throw new Error("Job opening not found");
    }
    return job;
  }

  async getAllJobApplications() {
    return await db.select().from(hrJobApplications).orderBy(desc(hrJobApplications.appliedAt));
  }

  async getJobApplications(jobId: number) {
    return await db.select().from(hrJobApplications)
      .where(eq(hrJobApplications.jobId, jobId))
      .orderBy(desc(hrJobApplications.appliedAt));
  }

  async getJobApplicationById(id: number) {
    const [app] = await db.select().from(hrJobApplications).where(eq(hrJobApplications.id, id));
    return app;
  }

  async createJobApplication(data: any) {
    const [app] = await db.insert(hrJobApplications).values(data).returning();
    await db.update(hrRecruitment)
      .set({ applicationCount: sql`${hrRecruitment.applicationCount} + 1` })
      .where(eq(hrRecruitment.id, data.jobId));
    return app;
  }

  async updateJobApplicationStatus(id: number, status: string, updates: any = {}) {
    const [app] = await db.update(hrJobApplications)
      .set({ applicationStatus: status, ...updates, updatedAt: new Date() })
      .where(eq(hrJobApplications.id, id))
      .returning();
    if (!app) {
      throw new Error("Application not found");
    }
    return app;
  }
  
  // =================== OPERATIONS DEPARTMENT IMPLEMENTATIONS ===================
  
  // Operations Tasks
  async createOpsTask(task: any): Promise<any> {
    const [opsTask] = await db.insert(opsTasksTable).values(task).returning();
    
    // Auto-create SLA tracking if due date is set
    if (opsTask.dueDate) {
      const startTime = new Date();
      const targetMinutes = Math.floor((new Date(opsTask.dueDate).getTime() - startTime.getTime()) / 60000);
      await this.createSlaTracking({
        entityType: 'task',
        entityId: opsTask.id,
        slaType: 'resolution_time',
        targetMinutes,
        startTime,
        deadlineTime: opsTask.dueDate,
      });
    }
    
    return opsTask;
  }

  async getOpsTask(id: number): Promise<any | undefined> {
    const [task] = await db.select().from(opsTasksTable).where(eq(opsTasksTable.id, id));
    return task;
  }

  async getOpsTasks(filters: any = {}): Promise<any[]> {
    let query = db.select().from(opsTasksTable);
    const conditions = [];
    
    if (filters.taskId) conditions.push(eq(opsTasksTable.taskId, filters.taskId));
    if (filters.assignedTo) conditions.push(eq(opsTasksTable.assignedTo, filters.assignedTo));
    if (filters.status) conditions.push(eq(opsTasksTable.status, filters.status));
    if (filters.priority) conditions.push(eq(opsTasksTable.priority, filters.priority));
    if (filters.category) conditions.push(eq(opsTasksTable.category, filters.category));
    if (filters.stationId) conditions.push(eq(opsTasksTable.stationId, filters.stationId));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const tasks = await query.orderBy(desc(opsTasksTable.createdAt)).limit(filters.limit || 100).offset(filters.offset || 0);
    return tasks;
  }

  async updateOpsTask(id: number, updates: any): Promise<any> {
    const [task] = await db.update(opsTasksTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(opsTasksTable.id, id))
      .returning();
    if (!task) throw new Error("Task not found");
    return task;
  }

  async completeOpsTask(id: number, completedBy: number, notes?: string): Promise<any> {
    const completionData: any = {
      status: 'completed',
      completedAt: new Date(),
      completionNotes: notes,
      updatedAt: new Date(),
    };
    
    const [task] = await db.update(opsTasksTable)
      .set(completionData)
      .where(eq(opsTasksTable.id, id))
      .returning();
      
    if (!task) throw new Error("Task not found");
    
    // Complete associated SLA tracking
    const slas = await this.getSlaTrackings({ entityType: 'task', entityId: id });
    for (const sla of slas) {
      await this.completeSlaTracking(sla.id, new Date());
    }
    
    return task;
  }

  async getTasksByStatus(status: string): Promise<any[]> {
    return await db.select().from(opsTasksTable)
      .where(eq(opsTasksTable.status, status))
      .orderBy(desc(opsTasksTable.createdAt));
  }

  async getTasksByPriority(priority: string): Promise<any[]> {
    return await db.select().from(opsTasksTable)
      .where(eq(opsTasksTable.priority, priority))
      .orderBy(desc(opsTasksTable.createdAt));
  }

  async getOverdueOpsTasks(): Promise<any[]> {
    return await db.select().from(opsTasksTable)
      .where(
        and(
          lt(opsTasksTable.dueDate, new Date()),
          or(
            eq(opsTasksTable.status, 'pending'),
            eq(opsTasksTable.status, 'in_progress')
          )
        )
      )
      .orderBy(opsTasksTable.dueDate);
  }

  // Operations Incidents
  async createIncident(incident: any): Promise<any> {
    const [inc] = await db.insert(opsIncidents).values(incident).returning();
    
    // Auto-create SLA tracking based on severity
    const slaMinutes = {
      critical: 30,    // 30 minutes for critical
      high: 120,       // 2 hours for high
      medium: 480,     // 8 hours for medium
      low: 1440,       // 24 hours for low
    };
    
    const targetMinutes = slaMinutes[inc.severity as keyof typeof slaMinutes] || 480;
    const startTime = new Date();
    const deadlineTime = new Date(startTime.getTime() + targetMinutes * 60000);
    
    await this.createSlaTracking({
      entityType: 'incident',
      entityId: inc.id,
      slaType: 'response_time',
      targetMinutes,
      startTime,
      deadlineTime,
    });
    
    return inc;
  }

  async getIncident(id: number): Promise<any | undefined> {
    const [incident] = await db.select().from(opsIncidents).where(eq(opsIncidents.id, id));
    return incident;
  }

  async getIncidents(filters: any = {}): Promise<any[]> {
    let query = db.select().from(opsIncidents);
    const conditions = [];
    
    if (filters.incidentId) conditions.push(eq(opsIncidents.incidentId, filters.incidentId));
    if (filters.severity) conditions.push(eq(opsIncidents.severity, filters.severity));
    if (filters.status) conditions.push(eq(opsIncidents.status, filters.status));
    if (filters.category) conditions.push(eq(opsIncidents.category, filters.category));
    if (filters.stationId) conditions.push(eq(opsIncidents.stationId, filters.stationId));
    if (filters.assignedTo) conditions.push(eq(opsIncidents.assignedTo, filters.assignedTo));
    if (filters.slaBreach !== undefined) conditions.push(eq(opsIncidents.slaBreach, filters.slaBreach));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const incidents = await query.orderBy(desc(opsIncidents.reportedAt)).limit(filters.limit || 100).offset(filters.offset || 0);
    return incidents;
  }

  async updateIncident(id: number, updates: any): Promise<any> {
    const [incident] = await db.update(opsIncidents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(opsIncidents.id, id))
      .returning();
    if (!incident) throw new Error("Incident not found");
    return incident;
  }

  async resolveIncident(id: number, resolvedBy: number, resolution: string, preventiveMeasures?: string): Promise<any> {
    const [incident] = await db.update(opsIncidents)
      .set({
        status: 'resolved',
        resolution,
        preventiveMeasures,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(opsIncidents.id, id))
      .returning();
      
    if (!incident) throw new Error("Incident not found");
    
    // Complete associated SLA tracking
    const slas = await this.getSlaTrackings({ entityType: 'incident', entityId: id });
    for (const sla of slas) {
      await this.completeSlaTracking(sla.id, new Date());
    }
    
    return incident;
  }

  async closeIncident(id: number, closedBy: number): Promise<any> {
    const [incident] = await db.update(opsIncidents)
      .set({
        status: 'closed',
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(opsIncidents.id, id))
      .returning();
      
    if (!incident) throw new Error("Incident not found");
    return incident;
  }

  async escalateIncident(id: number, escalatedBy: number, escalationNotes: string): Promise<any> {
    const [incident] = await db.update(opsIncidents)
      .set({
        status: 'escalated',
        updatedAt: new Date(),
      })
      .where(eq(opsIncidents.id, id))
      .returning();
      
    if (!incident) throw new Error("Incident not found");
    return incident;
  }

  async getSlaBreachIncidents(): Promise<any[]> {
    return await db.select().from(opsIncidents)
      .where(eq(opsIncidents.slaBreach, true))
      .orderBy(desc(opsIncidents.reportedAt));
  }

  async getIncidentsBySeverity(severity: string): Promise<any[]> {
    return await db.select().from(opsIncidents)
      .where(eq(opsIncidents.severity, severity))
      .orderBy(desc(opsIncidents.reportedAt));
  }

  // Operations SLA Tracking
  async createSlaTracking(sla: any): Promise<any> {
    const [tracking] = await db.insert(opsSlaTracking).values(sla).returning();
    return tracking;
  }

  async getSlaTracking(id: number): Promise<any | undefined> {
    const [tracking] = await db.select().from(opsSlaTracking).where(eq(opsSlaTracking.id, id));
    return tracking;
  }

  async getSlaTrackings(filters: any = {}): Promise<any[]> {
    let query = db.select().from(opsSlaTracking);
    const conditions = [];
    
    if (filters.entityType) conditions.push(eq(opsSlaTracking.entityType, filters.entityType));
    if (filters.entityId) conditions.push(eq(opsSlaTracking.entityId, filters.entityId));
    if (filters.slaType) conditions.push(eq(opsSlaTracking.slaType, filters.slaType));
    if (filters.status) conditions.push(eq(opsSlaTracking.status, filters.status));
    if (filters.isBreach !== undefined) conditions.push(eq(opsSlaTracking.isBreach, filters.isBreach));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const trackings = await query.orderBy(desc(opsSlaTracking.createdAt)).limit(filters.limit || 100).offset(filters.offset || 0);
    return trackings;
  }

  async updateSlaTracking(id: number, updates: any): Promise<any> {
    const [tracking] = await db.update(opsSlaTracking)
      .set(updates)
      .where(eq(opsSlaTracking.id, id))
      .returning();
    if (!tracking) throw new Error("SLA tracking not found");
    return tracking;
  }

  async completeSlaTracking(id: number, completedTime: Date): Promise<any> {
    const [tracking] = await db.select().from(opsSlaTracking).where(eq(opsSlaTracking.id, id));
    if (!tracking) throw new Error("SLA tracking not found");
    
    const actualMinutes = Math.floor((completedTime.getTime() - new Date(tracking.startTime).getTime()) / 60000);
    const isBreach = actualMinutes > tracking.targetMinutes;
    const breachMinutes = isBreach ? actualMinutes - tracking.targetMinutes : 0;
    
    const [updated] = await db.update(opsSlaTracking)
      .set({
        completedTime,
        actualMinutes,
        isBreach,
        breachMinutes,
        status: isBreach ? 'breached' : 'met',
      })
      .where(eq(opsSlaTracking.id, id))
      .returning();
      
    // Update incident SLA breach flag if applicable
    if (tracking.entityType === 'incident' && isBreach) {
      await db.update(opsIncidents)
        .set({ slaBreach: true })
        .where(eq(opsIncidents.id, tracking.entityId));
    }
    
    return updated;
  }

  async getSlaBreaches(entityType?: string): Promise<any[]> {
    let query = db.select().from(opsSlaTracking).where(eq(opsSlaTracking.isBreach, true));
    
    if (entityType) {
      query = query.where(and(eq(opsSlaTracking.isBreach, true), eq(opsSlaTracking.entityType, entityType))) as any;
    }
    
    return await query.orderBy(desc(opsSlaTracking.createdAt));
  }

  async getSlaMetrics(entityType?: string): Promise<{
    totalSlas: number;
    breachCount: number;
    breachRate: number;
    avgResponseTime: number;
    avgResolutionTime: number;
  }> {
    let query = db.select().from(opsSlaTracking);
    
    if (entityType) {
      query = query.where(eq(opsSlaTracking.entityType, entityType)) as any;
    }
    
    const slas = await query;
    const totalSlas = slas.length;
    const breachCount = slas.filter((s: any) => s.isBreach).length;
    const breachRate = totalSlas > 0 ? (breachCount / totalSlas) * 100 : 0;
    
    const completedSlas = slas.filter((s: any) => s.completedTime);
    const avgActualMinutes = completedSlas.length > 0
      ? completedSlas.reduce((sum: number, s: any) => sum + (s.actualMinutes || 0), 0) / completedSlas.length
      : 0;
      
    const responseSlas = slas.filter((s: any) => s.slaType === 'response_time' && s.completedTime);
    const avgResponseTime = responseSlas.length > 0
      ? responseSlas.reduce((sum: number, s: any) => sum + (s.actualMinutes || 0), 0) / responseSlas.length
      : 0;
      
    const resolutionSlas = slas.filter((s: any) => s.slaType === 'resolution_time' && s.completedTime);
    const avgResolutionTime = resolutionSlas.length > 0
      ? resolutionSlas.reduce((sum: number, s: any) => sum + (s.actualMinutes || 0), 0) / resolutionSlas.length
      : 0;
    
    return {
      totalSlas,
      breachCount,
      breachRate: Math.round(breachRate * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime),
      avgResolutionTime: Math.round(avgResolutionTime),
    };
  }
  
  // =================== LOGISTICS WAREHOUSES ===================
  
  async createWarehouse(warehouse: InsertLogisticsWarehouse): Promise<LogisticsWarehouse> {
    const [created] = await db.insert(logisticsWarehouses).values(warehouse).returning();
    return created;
  }

  async getWarehouse(id: number): Promise<LogisticsWarehouse | undefined> {
    const [warehouse] = await db.select().from(logisticsWarehouses).where(eq(logisticsWarehouses.id, id));
    return warehouse;
  }

  async getWarehouses(filters?: { isActive?: boolean; country?: string; limit?: number; offset?: number }): Promise<LogisticsWarehouse[]> {
    let query = db.select().from(logisticsWarehouses);
    
    const conditions = [];
    if (filters?.isActive !== undefined) {
      conditions.push(eq(logisticsWarehouses.isActive, filters.isActive));
    }
    if (filters?.country) {
      conditions.push(eq(logisticsWarehouses.country, filters.country));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    query = query.orderBy(desc(logisticsWarehouses.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }
    
    return await query;
  }

  async updateWarehouse(id: number, updates: Partial<LogisticsWarehouse>): Promise<LogisticsWarehouse> {
    const [updated] = await db.update(logisticsWarehouses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(logisticsWarehouses.id, id))
      .returning();
    return updated;
  }

  async deactivateWarehouse(id: number): Promise<LogisticsWarehouse> {
    const [deactivated] = await db.update(logisticsWarehouses)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(logisticsWarehouses.id, id))
      .returning();
    return deactivated;
  }

  async getWarehouseUtilization(): Promise<{ id: number; warehouseId: string; name: string; currentUtilization: string; capacity: number }[]> {
    const warehouses = await db.select().from(logisticsWarehouses).where(eq(logisticsWarehouses.isActive, true));
    return warehouses.map(w => ({
      id: w.id,
      warehouseId: w.warehouseId,
      name: w.name,
      currentUtilization: w.currentUtilization || '0',
      capacity: w.capacity || 0,
    }));
  }

  // =================== LOGISTICS INVENTORY ===================
  
  async createInventoryItem(item: InsertLogisticsInventory): Promise<LogisticsInventory> {
    const [created] = await db.insert(logisticsInventory).values(item).returning();
    return created;
  }

  async getInventoryItem(id: number): Promise<LogisticsInventory | undefined> {
    const [item] = await db.select().from(logisticsInventory).where(eq(logisticsInventory.id, id));
    return item;
  }

  async getInventoryBySku(sku: string): Promise<LogisticsInventory | undefined> {
    const [item] = await db.select().from(logisticsInventory).where(eq(logisticsInventory.sku, sku));
    return item;
  }

  async getInventoryItems(filters?: {
    warehouseId?: number;
    category?: string;
    searchTerm?: string;
    limit?: number;
    offset?: number;
  }): Promise<LogisticsInventory[]> {
    let query = db.select().from(logisticsInventory);
    
    const conditions = [];
    if (filters?.warehouseId) {
      conditions.push(eq(logisticsInventory.warehouseId, filters.warehouseId));
    }
    if (filters?.category) {
      conditions.push(eq(logisticsInventory.category, filters.category));
    }
    if (filters?.searchTerm) {
      conditions.push(
        or(
          like(logisticsInventory.productName, `%${filters.searchTerm}%`),
          like(logisticsInventory.sku, `%${filters.searchTerm}%`)
        )
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    query = query.orderBy(logisticsInventory.productName) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }
    
    return await query;
  }

  async updateInventoryItem(id: number, updates: Partial<LogisticsInventory>): Promise<LogisticsInventory> {
    const [updated] = await db.update(logisticsInventory)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(logisticsInventory.id, id))
      .returning();
    return updated;
  }

  async adjustInventoryQuantity(id: number, quantityChange: number, notes?: string): Promise<LogisticsInventory> {
    const item = await this.getInventoryItem(id);
    if (!item) {
      throw new Error(`Inventory item ${id} not found`);
    }
    
    const newQuantity = (item.quantity || 0) + quantityChange;
    if (newQuantity < 0) {
      throw new Error(`Insufficient inventory. Current: ${item.quantity}, Requested change: ${quantityChange}`);
    }
    
    const [updated] = await db.update(logisticsInventory)
      .set({ quantity: newQuantity, updatedAt: new Date() })
      .where(eq(logisticsInventory.id, id))
      .returning();
    
    return updated;
  }

  async getLowStockItems(): Promise<LogisticsInventory[]> {
    const items = await db.select()
      .from(logisticsInventory)
      .where(sql`${logisticsInventory.quantity} <= ${logisticsInventory.reorderLevel}`);
    return items;
  }

  async getExpiringItems(daysThreshold: number = 30): Promise<LogisticsInventory[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
    
    const items = await db.select()
      .from(logisticsInventory)
      .where(
        and(
          sql`${logisticsInventory.expiryDate} IS NOT NULL`,
          lte(logisticsInventory.expiryDate, thresholdDate.toISOString().split('T')[0])
        )
      )
      .orderBy(logisticsInventory.expiryDate);
    
    return items;
  }

  async getInventoryByWarehouse(warehouseId: number): Promise<LogisticsInventory[]> {
    return await db.select()
      .from(logisticsInventory)
      .where(eq(logisticsInventory.warehouseId, warehouseId))
      .orderBy(logisticsInventory.productName);
  }

  // =================== LOGISTICS FULFILLMENT ORDERS ===================
  
  async createFulfillmentOrder(order: InsertLogisticsFulfillmentOrder): Promise<LogisticsFulfillmentOrder> {
    const [created] = await db.insert(logisticsFulfillmentOrders).values(order).returning();
    return created;
  }

  async getFulfillmentOrder(id: number): Promise<LogisticsFulfillmentOrder | undefined> {
    const [order] = await db.select().from(logisticsFulfillmentOrders).where(eq(logisticsFulfillmentOrders.id, id));
    return order;
  }

  async getFulfillmentOrders(filters?: {
    orderType?: string;
    status?: string;
    priority?: string;
    stationId?: string;
    warehouseId?: number;
    limit?: number;
    offset?: number;
  }): Promise<LogisticsFulfillmentOrder[]> {
    let query = db.select().from(logisticsFulfillmentOrders);
    
    const conditions = [];
    if (filters?.orderType) {
      conditions.push(eq(logisticsFulfillmentOrders.orderType, filters.orderType));
    }
    if (filters?.status) {
      conditions.push(eq(logisticsFulfillmentOrders.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(logisticsFulfillmentOrders.priority, filters.priority));
    }
    if (filters?.stationId) {
      conditions.push(eq(logisticsFulfillmentOrders.stationId, filters.stationId));
    }
    if (filters?.warehouseId) {
      conditions.push(eq(logisticsFulfillmentOrders.warehouseId, filters.warehouseId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    query = query.orderBy(desc(logisticsFulfillmentOrders.orderDate)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }
    
    return await query;
  }

  async updateFulfillmentOrder(id: number, updates: Partial<LogisticsFulfillmentOrder>): Promise<LogisticsFulfillmentOrder> {
    const [updated] = await db.update(logisticsFulfillmentOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(logisticsFulfillmentOrders.id, id))
      .returning();
    return updated;
  }

  async shipFulfillmentOrder(id: number, trackingNumber: string, carrier: string): Promise<LogisticsFulfillmentOrder> {
    const [shipped] = await db.update(logisticsFulfillmentOrders)
      .set({
        status: 'shipped',
        shipDate: new Date(),
        trackingNumber,
        shippingCarrier: carrier,
        updatedAt: new Date(),
      })
      .where(eq(logisticsFulfillmentOrders.id, id))
      .returning();
    return shipped;
  }

  async deliverFulfillmentOrder(id: number): Promise<LogisticsFulfillmentOrder> {
    const [delivered] = await db.update(logisticsFulfillmentOrders)
      .set({
        status: 'delivered',
        deliveryDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(logisticsFulfillmentOrders.id, id))
      .returning();
    return delivered;
  }

  async cancelFulfillmentOrder(id: number, reason?: string): Promise<LogisticsFulfillmentOrder> {
    const [cancelled] = await db.update(logisticsFulfillmentOrders)
      .set({
        status: 'cancelled',
        deliveryNotes: reason || 'Cancelled',
        updatedAt: new Date(),
      })
      .where(eq(logisticsFulfillmentOrders.id, id))
      .returning();
    return cancelled;
  }

  async getPendingOrders(): Promise<LogisticsFulfillmentOrder[]> {
    return await db.select()
      .from(logisticsFulfillmentOrders)
      .where(eq(logisticsFulfillmentOrders.status, 'pending'))
      .orderBy(desc(logisticsFulfillmentOrders.priority), logisticsFulfillmentOrders.orderDate);
  }

  async getOrdersByStation(stationId: string): Promise<LogisticsFulfillmentOrder[]> {
    return await db.select()
      .from(logisticsFulfillmentOrders)
      .where(eq(logisticsFulfillmentOrders.stationId, stationId))
      .orderBy(desc(logisticsFulfillmentOrders.orderDate));
  }
  
  // =================== FINANCE - ACCOUNTS PAYABLE ===================
  
  async getAllAccountsPayable(): Promise<AccountsPayable[]> {
    return await db.select().from(accountsPayable).orderBy(desc(accountsPayable.dueDate));
  }
  
  async getAccountsPayableById(id: number): Promise<AccountsPayable | undefined> {
    const results = await db.select().from(accountsPayable).where(eq(accountsPayable.id, id));
    return results[0];
  }
  
  async createAccountsPayable(data: InsertAccountsPayable): Promise<AccountsPayable> {
    const results = await db.insert(accountsPayable).values(data).returning();
    return results[0];
  }
  
  async updateAccountsPayable(id: number, updates: Partial<AccountsPayable>): Promise<AccountsPayable> {
    const results = await db.update(accountsPayable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(accountsPayable.id, id))
      .returning();
    if (!results[0]) throw new Error("Accounts payable not found");
    return results[0];
  }
  
  async deleteAccountsPayable(id: number): Promise<void> {
    await db.delete(accountsPayable).where(eq(accountsPayable.id, id));
  }
  
  async getOverduePayables(): Promise<AccountsPayable[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return await db.select()
      .from(accountsPayable)
      .where(
        and(
          lt(accountsPayable.dueDate, today.toISOString().split('T')[0]),
          or(
            eq(accountsPayable.paymentStatus, 'pending'),
            eq(accountsPayable.paymentStatus, 'overdue')
          )
        )
      )
      .orderBy(accountsPayable.dueDate);
  }
  
  async getPayablesBySupplier(supplierId: number): Promise<AccountsPayable[]> {
    return await db.select()
      .from(accountsPayable)
      .where(eq(accountsPayable.supplierId, supplierId))
      .orderBy(desc(accountsPayable.invoiceDate));
  }
  
  async getPayablesByStatus(status: string): Promise<AccountsPayable[]> {
    return await db.select()
      .from(accountsPayable)
      .where(eq(accountsPayable.paymentStatus, status))
      .orderBy(desc(accountsPayable.dueDate));
  }
  
  async markPayableAsPaid(
    id: number,
    paymentDate: Date,
    paymentMethod: string,
    paymentReference?: string
  ): Promise<AccountsPayable> {
    const results = await db.update(accountsPayable)
      .set({
        paymentStatus: 'paid',
        paymentDate: paymentDate.toISOString().split('T')[0],
        paymentMethod,
        paymentReference,
        updatedAt: new Date(),
      })
      .where(eq(accountsPayable.id, id))
      .returning();
    if (!results[0]) throw new Error("Accounts payable not found");
    return results[0];
  }
  
  // =================== FINANCE - ACCOUNTS RECEIVABLE ===================
  
  async getAllAccountsReceivable(): Promise<AccountsReceivable[]> {
    return await db.select().from(accountsReceivable).orderBy(desc(accountsReceivable.dueDate));
  }
  
  async getAccountsReceivableById(id: number): Promise<AccountsReceivable | undefined> {
    const results = await db.select().from(accountsReceivable).where(eq(accountsReceivable.id, id));
    return results[0];
  }
  
  async createAccountsReceivable(data: InsertAccountsReceivable): Promise<AccountsReceivable> {
    const results = await db.insert(accountsReceivable).values(data).returning();
    return results[0];
  }
  
  async updateAccountsReceivable(id: number, updates: Partial<AccountsReceivable>): Promise<AccountsReceivable> {
    const results = await db.update(accountsReceivable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(accountsReceivable.id, id))
      .returning();
    if (!results[0]) throw new Error("Accounts receivable not found");
    return results[0];
  }
  
  async deleteAccountsReceivable(id: number): Promise<void> {
    await db.delete(accountsReceivable).where(eq(accountsReceivable.id, id));
  }
  
  async getOverdueReceivables(): Promise<AccountsReceivable[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return await db.select()
      .from(accountsReceivable)
      .where(
        and(
          lt(accountsReceivable.dueDate, today.toISOString().split('T')[0]),
          or(
            eq(accountsReceivable.paymentStatus, 'pending'),
            eq(accountsReceivable.paymentStatus, 'overdue'),
            eq(accountsReceivable.paymentStatus, 'partial')
          )
        )
      )
      .orderBy(accountsReceivable.dueDate);
  }
  
  async getReceivablesByCustomer(customerId: string): Promise<AccountsReceivable[]> {
    return await db.select()
      .from(accountsReceivable)
      .where(eq(accountsReceivable.customerId, customerId))
      .orderBy(desc(accountsReceivable.invoiceDate));
  }
  
  async getReceivablesByStatus(status: string): Promise<AccountsReceivable[]> {
    return await db.select()
      .from(accountsReceivable)
      .where(eq(accountsReceivable.paymentStatus, status))
      .orderBy(desc(accountsReceivable.dueDate));
  }
  
  async recordReceivablePayment(
    id: number,
    amount: number,
    paymentDate: Date,
    paymentMethod: string
  ): Promise<AccountsReceivable> {
    const receivable = await this.getAccountsReceivableById(id);
    if (!receivable) throw new Error("Accounts receivable not found");
    
    const currentPaid = parseFloat(receivable.paidAmount || '0');
    const newPaidAmount = currentPaid + amount;
    const totalAmount = parseFloat(receivable.totalAmount);
    const newBalanceDue = totalAmount - newPaidAmount;
    
    let newStatus = receivable.paymentStatus;
    if (newBalanceDue <= 0) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }
    
    const results = await db.update(accountsReceivable)
      .set({
        paidAmount: newPaidAmount.toFixed(2),
        balanceDue: newBalanceDue.toFixed(2),
        paymentStatus: newStatus,
        paymentDate: paymentDate.toISOString().split('T')[0],
        paymentMethod,
        updatedAt: new Date(),
      })
      .where(eq(accountsReceivable.id, id))
      .returning();
    return results[0];
  }
  
  // =================== FINANCE - GENERAL LEDGER ===================
  
  async getAllGeneralLedgerEntries(): Promise<GeneralLedger[]> {
    return await db.select().from(generalLedger).orderBy(desc(generalLedger.entryDate));
  }
  
  async getGeneralLedgerById(id: number): Promise<GeneralLedger | undefined> {
    const results = await db.select().from(generalLedger).where(eq(generalLedger.id, id));
    return results[0];
  }
  
  async createGeneralLedgerEntry(data: InsertGeneralLedger): Promise<GeneralLedger> {
    const results = await db.insert(generalLedger).values(data).returning();
    return results[0];
  }
  
  async getEntriesByAccount(accountCode: string): Promise<GeneralLedger[]> {
    return await db.select()
      .from(generalLedger)
      .where(eq(generalLedger.accountCode, accountCode))
      .orderBy(desc(generalLedger.entryDate));
  }
  
  async getEntriesByFiscalPeriod(fiscalYear: number, fiscalPeriod: number): Promise<GeneralLedger[]> {
    return await db.select()
      .from(generalLedger)
      .where(
        and(
          eq(generalLedger.fiscalYear, fiscalYear),
          eq(generalLedger.fiscalPeriod, fiscalPeriod)
        )
      )
      .orderBy(generalLedger.entryDate);
  }
  
  async getTrialBalance(fiscalYear: number, fiscalPeriod: number): Promise<any[]> {
    const entries = await this.getEntriesByFiscalPeriod(fiscalYear, fiscalPeriod);
    
    const balanceMap = new Map<string, { accountCode: string; accountName: string; accountType: string; debit: number; credit: number }>();
    
    entries.forEach(entry => {
      const key = entry.accountCode;
      if (!balanceMap.has(key)) {
        balanceMap.set(key, {
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          accountType: entry.accountType,
          debit: 0,
          credit: 0,
        });
      }
      const balance = balanceMap.get(key)!;
      balance.debit += parseFloat(entry.debit || '0');
      balance.credit += parseFloat(entry.credit || '0');
    });
    
    return Array.from(balanceMap.values()).map(balance => ({
      ...balance,
      balance: balance.debit - balance.credit,
    }));
  }
  
  async reconcileEntry(id: number): Promise<GeneralLedger> {
    const results = await db.update(generalLedger)
      .set({ isReconciled: true })
      .where(eq(generalLedger.id, id))
      .returning();
    if (!results[0]) throw new Error("General ledger entry not found");
    return results[0];
  }
  
  // =================== FINANCE - TAX COMPLIANCE ===================
  
  async getAllTaxReturns(): Promise<TaxReturn[]> {
    return await db.select().from(taxReturns).orderBy(desc(taxReturns.dueDate));
  }
  
  async getTaxReturnById(id: number): Promise<TaxReturn | undefined> {
    const results = await db.select().from(taxReturns).where(eq(taxReturns.id, id));
    return results[0];
  }
  
  async createTaxReturn(data: InsertTaxReturn): Promise<TaxReturn> {
    const results = await db.insert(taxReturns).values(data).returning();
    return results[0];
  }
  
  async updateTaxReturn(id: number, updates: Partial<TaxReturn>): Promise<TaxReturn> {
    const results = await db.update(taxReturns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(taxReturns.id, id))
      .returning();
    if (!results[0]) throw new Error("Tax return not found");
    return results[0];
  }
  
  async getTaxReturnsByPeriod(taxYear: number, taxPeriod: string): Promise<TaxReturn[]> {
    return await db.select()
      .from(taxReturns)
      .where(
        and(
          eq(taxReturns.taxYear, taxYear),
          eq(taxReturns.taxPeriod, taxPeriod)
        )
      )
      .orderBy(desc(taxReturns.dueDate));
  }
  
  async getTaxReturnsByStatus(status: string): Promise<TaxReturn[]> {
    return await db.select()
      .from(taxReturns)
      .where(eq(taxReturns.status, status))
      .orderBy(desc(taxReturns.dueDate));
  }
  
  async submitTaxReturn(id: number, submittedBy: string): Promise<TaxReturn> {
    const results = await db.update(taxReturns)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        submittedBy,
        updatedAt: new Date(),
      })
      .where(eq(taxReturns.id, id))
      .returning();
    if (!results[0]) throw new Error("Tax return not found");
    return results[0];
  }
  
  async getAllTaxPayments(): Promise<TaxPayment[]> {
    return await db.select().from(taxPayments).orderBy(desc(taxPayments.paymentDate));
  }
  
  async getTaxPaymentById(id: number): Promise<TaxPayment | undefined> {
    const results = await db.select().from(taxPayments).where(eq(taxPayments.id, id));
    return results[0];
  }
  
  async createTaxPayment(data: InsertTaxPayment): Promise<TaxPayment> {
    const results = await db.insert(taxPayments).values(data).returning();
    return results[0];
  }
  
  async getTaxPaymentsByReturn(taxReturnId: number): Promise<TaxPayment[]> {
    return await db.select()
      .from(taxPayments)
      .where(eq(taxPayments.taxReturnId, taxReturnId))
      .orderBy(desc(taxPayments.paymentDate));
  }
  
  async getTaxPaymentsByDateRange(startDate: Date, endDate: Date): Promise<TaxPayment[]> {
    return await db.select()
      .from(taxPayments)
      .where(
        and(
          gte(taxPayments.paymentDate, startDate),
          lte(taxPayments.paymentDate, endDate)
        )
      )
      .orderBy(taxPayments.paymentDate);
  }
  
  async getAllTaxAuditLogs(): Promise<TaxAuditLog[]> {
    return await db.select().from(taxAuditLogs).orderBy(desc(taxAuditLogs.timestamp));
  }
  
  async getTaxAuditLogById(id: number): Promise<TaxAuditLog | undefined> {
    const results = await db.select().from(taxAuditLogs).where(eq(taxAuditLogs.id, id));
    return results[0];
  }
  
  async createTaxAuditLog(data: InsertTaxAuditLog): Promise<TaxAuditLog> {
    const results = await db.insert(taxAuditLogs).values(data).returning();
    return results[0];
  }
  
  async getTaxAuditLogsByEntity(entityType: string, entityId: number): Promise<TaxAuditLog[]> {
    return await db.select()
      .from(taxAuditLogs)
      .where(
        and(
          eq(taxAuditLogs.entityType, entityType),
          eq(taxAuditLogs.entityId, entityId)
        )
      )
      .orderBy(desc(taxAuditLogs.timestamp));
  }
  
  async getTaxAuditLogsByUser(userId: string): Promise<TaxAuditLog[]> {
    return await db.select()
      .from(taxAuditLogs)
      .where(eq(taxAuditLogs.userId, userId))
      .orderBy(desc(taxAuditLogs.timestamp));
  }
  
  async getTaxAuditLogsByDateRange(startDate: Date, endDate: Date): Promise<TaxAuditLog[]> {
    return await db.select()
      .from(taxAuditLogs)
      .where(
        and(
          gte(taxAuditLogs.timestamp, startDate),
          lte(taxAuditLogs.timestamp, endDate)
        )
      )
      .orderBy(taxAuditLogs.timestamp);
  }
  
  // Policy Documents - Stub implementations
  async getAllPolicyDocuments(): Promise<PolicyDocument[]> {
    return await db.select().from(policyDocuments).orderBy(desc(policyDocuments.createdAt));
  }
  
  async getPolicyDocumentById(id: number): Promise<PolicyDocument | undefined> {
    const results = await db.select().from(policyDocuments).where(eq(policyDocuments.id, id));
    return results[0];
  }
  
  async getActivePolicyDocuments(): Promise<PolicyDocument[]> {
    return await db.select()
      .from(policyDocuments)
      .where(eq(policyDocuments.isActive, true))
      .orderBy(desc(policyDocuments.createdAt));
  }
  
  async getPolicyDocumentsByCategory(category: string): Promise<PolicyDocument[]> {
    return await db.select()
      .from(policyDocuments)
      .where(eq(policyDocuments.category, category))
      .orderBy(desc(policyDocuments.createdAt));
  }
  
  async createPolicyDocument(data: InsertPolicyDocument): Promise<PolicyDocument> {
    const results = await db.insert(policyDocuments).values(data).returning();
    return results[0];
  }
  
  async updatePolicyDocument(id: number, updates: Partial<PolicyDocument>): Promise<PolicyDocument> {
    const results = await db.update(policyDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(policyDocuments.id, id))
      .returning();
    if (!results[0]) throw new Error("Policy document not found");
    return results[0];
  }
  
  async deletePolicyDocument(id: number): Promise<void> {
    await db.delete(policyDocuments).where(eq(policyDocuments.id, id));
  }
  
  async recordPolicyAcknowledgment(data: InsertPolicyAcknowledgment): Promise<PolicyAcknowledgment> {
    const results = await db.insert(policyAcknowledgments).values(data).returning();
    return results[0];
  }
  
  async getPolicyAcknowledgments(policyId: number): Promise<PolicyAcknowledgment[]> {
    return await db.select()
      .from(policyAcknowledgments)
      .where(eq(policyAcknowledgments.policyId, policyId))
      .orderBy(desc(policyAcknowledgments.acknowledgedAt));
  }
  
  // Compliance Certifications
  async getAllComplianceCertifications(): Promise<ComplianceCertification[]> {
    return await db.select()
      .from(complianceCertifications)
      .orderBy(desc(complianceCertifications.expiryDate));
  }
  
  async getComplianceCertificationById(id: number): Promise<ComplianceCertification | undefined> {
    const results = await db.select().from(complianceCertifications).where(eq(complianceCertifications.id, id));
    return results[0];
  }
  
  async getEmployeeCertifications(employeeId: number): Promise<ComplianceCertification[]> {
    return await db.select()
      .from(complianceCertifications)
      .where(eq(complianceCertifications.employeeId, employeeId))
      .orderBy(desc(complianceCertifications.expiryDate));
  }
  
  async createComplianceCertification(data: InsertComplianceCertification): Promise<ComplianceCertification> {
    const results = await db.insert(complianceCertifications).values(data).returning();
    return results[0];
  }
  
  async updateComplianceCertification(id: number, updates: Partial<ComplianceCertification>): Promise<ComplianceCertification> {
    const results = await db.update(complianceCertifications)
      .set(updates)
      .where(eq(complianceCertifications.id, id))
      .returning();
    if (!results[0]) throw new Error("Certification not found");
    return results[0];
  }
  
  async getExpiringCertifications(daysAhead: number): Promise<ComplianceCertification[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    return await db.select()
      .from(complianceCertifications)
      .where(
        and(
          eq(complianceCertifications.status, 'active'),
          lte(complianceCertifications.expiryDate, futureDate.toISOString().split('T')[0])
        )
      )
      .orderBy(complianceCertifications.expiryDate);
  }
  
  // =================== FRANCHISEES ===================
  
  async getAllFranchisees(): Promise<Franchisee[]> {
    return await db.select().from(franchisees).orderBy(desc(franchisees.createdAt));
  }

  async getFranchiseeById(id: number): Promise<Franchisee | undefined> {
    const result = await db.select().from(franchisees).where(eq(franchisees.id, id)).limit(1);
    return result[0];
  }

  async getActiveFranchisees(): Promise<Franchisee[]> {
    return await db.select().from(franchisees)
      .where(eq(franchisees.status, 'active'))
      .orderBy(desc(franchisees.createdAt));
  }

  async getFranchiseesByCountry(country: string): Promise<Franchisee[]> {
    return await db.select().from(franchisees)
      .where(eq(franchisees.country, country))
      .orderBy(desc(franchisees.createdAt));
  }

  async createFranchisee(data: InsertFranchisee): Promise<Franchisee> {
    const result = await db.insert(franchisees).values(data).returning();
    return result[0];
  }

  async updateFranchisee(id: number, updates: Partial<Franchisee>): Promise<Franchisee> {
    const result = await db.update(franchisees)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(franchisees.id, id))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError(`Franchisee with id ${id} not found`);
    }
    return result[0];
  }

  // =================== FRANCHISE ROYALTY PAYMENTS ===================
  
  async getAllRoyaltyPayments(): Promise<FranchiseRoyaltyPayment[]> {
    return await db.select().from(franchiseRoyaltyPayments)
      .orderBy(desc(franchiseRoyaltyPayments.periodStart));
  }

  async getRoyaltyPaymentById(id: number): Promise<FranchiseRoyaltyPayment | undefined> {
    const result = await db.select().from(franchiseRoyaltyPayments)
      .where(eq(franchiseRoyaltyPayments.id, id)).limit(1);
    return result[0];
  }

  async getFranchiseeRoyaltyPayments(franchiseeId: number): Promise<FranchiseRoyaltyPayment[]> {
    return await db.select().from(franchiseRoyaltyPayments)
      .where(eq(franchiseRoyaltyPayments.franchiseeId, franchiseeId))
      .orderBy(desc(franchiseRoyaltyPayments.periodStart));
  }

  async getPendingRoyaltyPayments(): Promise<FranchiseRoyaltyPayment[]> {
    return await db.select().from(franchiseRoyaltyPayments)
      .where(eq(franchiseRoyaltyPayments.paymentStatus, 'pending'))
      .orderBy(franchiseRoyaltyPayments.dueDate);
  }

  async getOverdueRoyaltyPayments(): Promise<FranchiseRoyaltyPayment[]> {
    const today = new Date().toISOString().split('T')[0];
    return await db.select().from(franchiseRoyaltyPayments)
      .where(
        and(
          eq(franchiseRoyaltyPayments.paymentStatus, 'pending'),
          lt(franchiseRoyaltyPayments.dueDate, today)
        )
      )
      .orderBy(franchiseRoyaltyPayments.dueDate);
  }

  async createRoyaltyPayment(data: InsertFranchiseRoyaltyPayment): Promise<FranchiseRoyaltyPayment> {
    const result = await db.insert(franchiseRoyaltyPayments).values(data).returning();
    return result[0];
  }

  async updateRoyaltyPayment(id: number, updates: Partial<FranchiseRoyaltyPayment>): Promise<FranchiseRoyaltyPayment> {
    const result = await db.update(franchiseRoyaltyPayments)
      .set(updates)
      .where(eq(franchiseRoyaltyPayments.id, id))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError(`Royalty payment with id ${id} not found`);
    }
    return result[0];
  }

  async recordRoyaltyPayment(
    id: number, 
    paymentData: { paidDate: string; paymentMethod: string; paymentReference?: string }
  ): Promise<FranchiseRoyaltyPayment> {
    const result = await db.update(franchiseRoyaltyPayments)
      .set({
        paymentStatus: 'paid',
        paidDate: paymentData.paidDate,
        paymentMethod: paymentData.paymentMethod,
        paymentReference: paymentData.paymentReference,
      })
      .where(eq(franchiseRoyaltyPayments.id, id))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError(`Royalty payment with id ${id} not found`);
    }
    return result[0];
  }
}

export const storage = new DatabaseStorage();
