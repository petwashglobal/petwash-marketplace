// FILE: shared/petwashIncidents.ts
// Pet Wash™ - Incident Management
// Tracks safety incidents, pet injuries, customer complaints, and critical events
export function isCritical(incident) {
    // Critical incidents that should block contractor immediately
    const criticalTypes = [
        "PET_INJURY",
        "AGGRESSION",
        "DRIVING_ACCIDENT",
    ];
    if (incident.severity === "CRITICAL") {
        return true;
    }
    if (criticalTypes.includes(incident.type) && incident.severity === "HIGH") {
        return true;
    }
    return false;
}
export function getOpenCriticalCount(contractorId, incidents) {
    return incidents.filter((i) => i.contractorId === contractorId &&
        (i.status === "OPEN" || i.status === "INVESTIGATING") &&
        isCritical(i)).length;
}
