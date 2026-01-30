export var DomainEventType;
(function (DomainEventType) {
    // Station events
    DomainEventType["STATION_CREATED"] = "station.created";
    DomainEventType["STATION_STATUS_CHANGED"] = "station.status_changed";
    DomainEventType["STATION_HEARTBEAT_MISSED"] = "station.heartbeat_missed";
    // Wash events
    DomainEventType["WASH_STARTED"] = "wash.started";
    DomainEventType["WASH_COMPLETED"] = "wash.completed";
    // Payment events
    DomainEventType["TRANSACTION_RECORDED"] = "transaction.recorded";
    DomainEventType["PAYMENT_CAPTURED"] = "payment.captured";
    DomainEventType["REFUND_ISSUED"] = "refund.issued";
    // Inventory events
    DomainEventType["INVENTORY_LOW"] = "inventory.low";
    DomainEventType["INVENTORY_REFILLED"] = "inventory.refilled";
    // Field operations
    DomainEventType["FIELD_UPDATE_CREATED"] = "field_update.created";
    // Incidents
    DomainEventType["INCIDENT_REPORTED"] = "incident.reported";
    DomainEventType["INCIDENT_RESOLVED"] = "incident.resolved";
    // Logistics
    DomainEventType["LOGISTICS_TASK_CREATED"] = "logistics_task.created";
    DomainEventType["LOGISTICS_TASK_ASSIGNED"] = "logistics_task.assigned";
    DomainEventType["LOGISTICS_TASK_COMPLETED"] = "logistics_task.completed";
    // Settlements
    DomainEventType["SETTLEMENT_GENERATED"] = "settlement.generated";
    DomainEventType["SETTLEMENT_APPROVED"] = "settlement.approved";
    DomainEventType["SETTLEMENT_PAID"] = "settlement.paid";
    // User events
    DomainEventType["USER_LOGGED_IN"] = "user.logged_in";
    DomainEventType["USER_ROLE_ASSIGNED"] = "user.role_assigned";
})(DomainEventType || (DomainEventType = {}));
