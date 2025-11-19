export enum DomainEventType {
  // Station events
  STATION_CREATED = "station.created",
  STATION_STATUS_CHANGED = "station.status_changed",
  STATION_HEARTBEAT_MISSED = "station.heartbeat_missed",
  
  // Wash events
  WASH_STARTED = "wash.started",
  WASH_COMPLETED = "wash.completed",
  
  // Payment events
  TRANSACTION_RECORDED = "transaction.recorded",
  PAYMENT_CAPTURED = "payment.captured",
  REFUND_ISSUED = "refund.issued",
  
  // Inventory events
  INVENTORY_LOW = "inventory.low",
  INVENTORY_REFILLED = "inventory.refilled",
  
  // Field operations
  FIELD_UPDATE_CREATED = "field_update.created",
  
  // Incidents
  INCIDENT_REPORTED = "incident.reported",
  INCIDENT_RESOLVED = "incident.resolved",
  
  // Logistics
  LOGISTICS_TASK_CREATED = "logistics_task.created",
  LOGISTICS_TASK_ASSIGNED = "logistics_task.assigned",
  LOGISTICS_TASK_COMPLETED = "logistics_task.completed",
  
  // Settlements
  SETTLEMENT_GENERATED = "settlement.generated",
  SETTLEMENT_APPROVED = "settlement.approved",
  SETTLEMENT_PAID = "settlement.paid",
  
  // User events
  USER_LOGGED_IN = "user.logged_in",
  USER_ROLE_ASSIGNED = "user.role_assigned",
}

export interface DomainEvent<T = any> {
  id: string;
  type: DomainEventType;
  occurredAt: string;
  aggregateType?: string;
  aggregateId?: string;
  payload: T;
  metadata?: any;
}

export interface StationCreatedPayload {
  stationId: string;
  location: string;
  locationHe: string;
  machineType: string;
}

export interface StationStatusChangedPayload {
  stationId: string;
  oldStatus: string;
  newStatus: string;
  reason?: string;
}

export interface WashStartedPayload {
  washId: string;
  stationId: string;
  customerId?: string;
  programType: string;
  amount: number;
}

export interface WashCompletedPayload {
  washId: string;
  stationId: string;
  customerId?: string;
  duration: number;
  success: boolean;
}

export interface TransactionRecordedPayload {
  transactionId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  customerId?: string;
}

export interface InventoryLowPayload {
  stationId: string;
  itemType: string;
  currentLevel: number;
  threshold: number;
}

export interface IncidentReportedPayload {
  incidentId: string;
  stationId: string;
  severity: string;
  description: string;
  reportedBy: string;
}

export interface SettlementGeneratedPayload {
  settlementId: string;
  franchiseId: string;
  amount: number;
  period: string;
}
