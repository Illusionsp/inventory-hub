---
name: Permission system
description: Task-based permission enforcement layered on top of the existing role system.
---

# Permission System

## Rule
Seven permission keys (`can_create_store_requests`, `can_approve_requests`, `can_receive_items`, `can_view_request_status`, `can_create_batch_production`, `can_manage_inventory`, `can_view_reports`) stored in `users.permissions text[]`. `null` means use role defaults; an explicit array overrides.

**Why:** Granular per-user overrides needed beyond the six fixed roles. super_admin always gets all permissions regardless of stored value.

**How to apply:** When adding a new protected action:
1. Add a `requirePermission("can_xyz")` middleware to the Express route
2. Add `hasPermission("can_xyz")` guard in the frontend to hide/disable the button

## Architecture
- `lib/db/src/permissions.ts` — `PERMISSIONS`, `ALL_PERMISSIONS`, `ROLE_DEFAULT_PERMISSIONS`, `getEffectivePermissions()`
- `artifacts/api-server/src/lib/auth.ts` — `requirePermission(perm)` middleware + `refreshUserData()` sets `req.session.userPermissions`
- `GET /api/auth/me` returns `permissions: string[]` = EFFECTIVE permissions (never null); computed from session which applies role defaults
- `GET /api/users` returns raw `permissions` from DB (null = role defaults; shown as "Role defaults" badge in Users page)
- `artifacts/inventory-pro/src/lib/auth.tsx` — `hasPermission(perm)` in AuthContext; super_admin check is embedded (returns true always)

## DB note
`permissions text[]` was added via raw SQL `ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions text[]`. Do NOT use drizzle-kit push (it wants to drop the `session` table which is managed by connect-pg-simple).

## Frontend permission gating
- `PERMISSION_LIST` and `ROLE_DEFAULT_PERMISSIONS` are duplicated inline in `users/index.tsx` (cannot import server-side `@workspace/db` in the frontend)
- Users page Edit dialog: super_admin sees checkboxes for non-super_admin users; "Role defaults" toggle saves `null`; custom saves explicit array
