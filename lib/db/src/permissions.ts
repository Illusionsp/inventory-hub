/**
 * Granular permission keys used across the system.
 * When a user's `permissions` column is null, role-based defaults apply.
 * super_admin always receives every permission regardless of the stored value.
 */
export const PERMISSIONS = {
  CAN_CREATE_STORE_REQUESTS: "can_create_store_requests",
  CAN_APPROVE_REQUESTS: "can_approve_requests",
  CAN_RECEIVE_ITEMS: "can_receive_items",
  CAN_VIEW_REQUEST_STATUS: "can_view_request_status",
  CAN_CREATE_BATCH_PRODUCTION: "can_create_batch_production",
  CAN_MANAGE_INVENTORY: "can_manage_inventory",
  CAN_VIEW_REPORTS: "can_view_reports",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Default permissions granted to each role when no explicit overrides are set. */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  store_manager: [
    PERMISSIONS.CAN_CREATE_STORE_REQUESTS,
    PERMISSIONS.CAN_RECEIVE_ITEMS,
    PERMISSIONS.CAN_VIEW_REQUEST_STATUS,
    PERMISSIONS.CAN_MANAGE_INVENTORY,
    PERMISSIONS.CAN_VIEW_REPORTS,
    PERMISSIONS.CAN_CREATE_BATCH_PRODUCTION,
  ],
  approver: [
    PERMISSIONS.CAN_APPROVE_REQUESTS,
    PERMISSIONS.CAN_VIEW_REQUEST_STATUS,
    PERMISSIONS.CAN_VIEW_REPORTS,
  ],
  finance: [
    PERMISSIONS.CAN_VIEW_REPORTS,
    PERMISSIONS.CAN_VIEW_REQUEST_STATUS,
  ],
  accountant: [
    PERMISSIONS.CAN_VIEW_REPORTS,
    PERMISSIONS.CAN_VIEW_REQUEST_STATUS,
  ],
  sales_officer: [
    PERMISSIONS.CAN_VIEW_REPORTS,
  ],
};

/**
 * Returns the effective permission list for a user.
 * super_admin always gets all permissions.
 * Other roles use stored overrides if present, otherwise role defaults.
 */
export function getEffectivePermissions(user: {
  role: string;
  permissions?: string[] | null;
}): string[] {
  if (user.role === "super_admin") return ALL_PERMISSIONS;
  if (user.permissions && user.permissions.length > 0) return user.permissions;
  return ROLE_DEFAULT_PERMISSIONS[user.role] ?? [];
}
