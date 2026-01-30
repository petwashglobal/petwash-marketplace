// FILE: shared/petwashRoles.ts
// Pet Wash™ - Platform Roles & Permissions
// Defines all roles across the ecosystem
export const ROLE_DEFINITIONS = {
    SUPER_ADMIN: {
        role: "SUPER_ADMIN",
        permissions: ["*"],
        requiresBackgroundCheck: true,
        requiresDriverLicense: false,
        canEnterCustomerHomes: false,
    },
    ADMIN: {
        role: "ADMIN",
        permissions: ["platform.*", "users.*", "contractors.*"],
        requiresBackgroundCheck: true,
        requiresDriverLicense: false,
        canEnterCustomerHomes: false,
    },
    FRANCHISE_OWNER: {
        role: "FRANCHISE_OWNER",
        permissions: ["franchise.*", "stations.*", "reports.*"],
        requiresBackgroundCheck: true,
        requiresDriverLicense: false,
        canEnterCustomerHomes: false,
    },
    STATION_MANAGER: {
        role: "STATION_MANAGER",
        permissions: ["stations.view", "stations.manage", "tasks.*"],
        requiresBackgroundCheck: false,
        requiresDriverLicense: false,
        canEnterCustomerHomes: false,
    },
    TECHNICIAN: {
        role: "TECHNICIAN",
        permissions: ["stations.service", "tasks.complete"],
        requiresBackgroundCheck: false,
        requiresDriverLicense: false,
        canEnterCustomerHomes: false,
    },
    DRIVER: {
        role: "DRIVER",
        permissions: ["jobs.view", "jobs.complete", "navigation.*"],
        requiresBackgroundCheck: true,
        requiresDriverLicense: true,
        canEnterCustomerHomes: false,
    },
    PET_SITTER: {
        role: "PET_SITTER",
        permissions: ["bookings.view", "bookings.complete", "pets.*"],
        requiresBackgroundCheck: true,
        requiresDriverLicense: false,
        canEnterCustomerHomes: true,
    },
    PET_HOST: {
        role: "PET_HOST",
        permissions: ["bookings.view", "bookings.complete", "pets.*"],
        requiresBackgroundCheck: true,
        requiresDriverLicense: false,
        canEnterCustomerHomes: true,
    },
    GROOMER: {
        role: "GROOMER",
        permissions: ["grooming.*", "bookings.view"],
        requiresBackgroundCheck: false,
        requiresDriverLicense: false,
        canEnterCustomerHomes: false,
    },
    TRAINER: {
        role: "TRAINER",
        permissions: ["training.*", "bookings.view"],
        requiresBackgroundCheck: false,
        requiresDriverLicense: false,
        canEnterCustomerHomes: false,
    },
    VET_ASSISTANT: {
        role: "VET_ASSISTANT",
        permissions: ["vet.*", "bookings.view"],
        requiresBackgroundCheck: true,
        requiresDriverLicense: false,
        canEnterCustomerHomes: false,
    },
    CUSTOMER_SUPPORT: {
        role: "CUSTOMER_SUPPORT",
        permissions: ["support.*", "users.view", "bookings.view"],
        requiresBackgroundCheck: false,
        requiresDriverLicense: false,
        canEnterCustomerHomes: false,
    },
    FINANCE_MANAGER: {
        role: "FINANCE_MANAGER",
        permissions: ["finance.*", "settlements.*", "reports.*"],
        requiresBackgroundCheck: true,
        requiresDriverLicense: false,
        canEnterCustomerHomes: false,
    },
    OPERATIONS_MANAGER: {
        role: "OPERATIONS_MANAGER",
        permissions: ["operations.*", "logistics.*", "tasks.*"],
        requiresBackgroundCheck: false,
        requiresDriverLicense: false,
        canEnterCustomerHomes: false,
    },
    MARKETING_MANAGER: {
        role: "MARKETING_MANAGER",
        permissions: ["marketing.*", "analytics.*"],
        requiresBackgroundCheck: false,
        requiresDriverLicense: false,
        canEnterCustomerHomes: false,
    },
};
export function requiresBackgroundCheck(role) {
    return ROLE_DEFINITIONS[role].requiresBackgroundCheck;
}
export function requiresDriverLicense(role) {
    return ROLE_DEFINITIONS[role].requiresDriverLicense;
}
export function canEnterCustomerHomes(role) {
    return ROLE_DEFINITIONS[role].canEnterCustomerHomes;
}
