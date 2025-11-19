// FILE: shared/petwashRoles.ts
// Pet Wash™ - Platform Roles & Permissions
// Defines all roles across the ecosystem

export type PlatformRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "FRANCHISE_OWNER"
  | "STATION_MANAGER"
  | "TECHNICIAN"
  | "DRIVER"
  | "PET_SITTER"
  | "PET_HOST"
  | "GROOMER"
  | "TRAINER"
  | "VET_ASSISTANT"
  | "CUSTOMER_SUPPORT"
  | "FINANCE_MANAGER"
  | "OPERATIONS_MANAGER"
  | "MARKETING_MANAGER";

export interface RolePermissions {
  role: PlatformRole;
  permissions: string[];
  requiresBackgroundCheck: boolean;
  requiresDriverLicense: boolean;
  canEnterCustomerHomes: boolean;
}

export const ROLE_DEFINITIONS: Record<PlatformRole, RolePermissions> = {
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

export function requiresBackgroundCheck(role: PlatformRole): boolean {
  return ROLE_DEFINITIONS[role].requiresBackgroundCheck;
}

export function requiresDriverLicense(role: PlatformRole): boolean {
  return ROLE_DEFINITIONS[role].requiresDriverLicense;
}

export function canEnterCustomerHomes(role: PlatformRole): boolean {
  return ROLE_DEFINITIONS[role].canEnterCustomerHomes;
}
