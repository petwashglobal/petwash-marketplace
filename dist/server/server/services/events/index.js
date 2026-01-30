import { DomainEventType } from '@shared/events';
import { handleStationStatusChanged } from './StationStatusChangedHandler';
import { handleInventoryLow } from './InventoryLowHandler';
import { handleIncidentReported } from './IncidentReportedHandler';
import { handleSettlementGenerated } from './SettlementGeneratedHandler';
import { logger } from '../../lib/logger';
export function registerEventHandlers(eventBus) {
    logger.info('[Event Handlers] Registering domain event handlers');
    eventBus.subscribe(DomainEventType.STATION_STATUS_CHANGED, async (event) => {
        await handleStationStatusChanged(event);
    });
    eventBus.subscribe(DomainEventType.INVENTORY_LOW, async (event) => {
        await handleInventoryLow(event);
    });
    eventBus.subscribe(DomainEventType.INCIDENT_REPORTED, async (event) => {
        await handleIncidentReported(event);
    });
    eventBus.subscribe(DomainEventType.SETTLEMENT_GENERATED, async (event) => {
        await handleSettlementGenerated(event);
    });
    logger.info('[Event Handlers] All domain event handlers registered successfully');
}
export { handleStationStatusChanged, handleInventoryLow, handleIncidentReported, handleSettlementGenerated, };
