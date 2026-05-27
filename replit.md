# Multi-Store Inventory Pro

A full-stack manufacturing inventory, production & sales management system. Tracks materials from raw purchase → semi-finished → finished product → sales, with GRN approvals, store transfers, production batches, wastage tracking, credit sales, and comprehensive dashboards.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm --filter @workspace/inventory-pro run dev` — run the frontend (proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter routing, TanStack Query, shadcn/ui, Tailwind CSS v4
- API: Express 5 + Pino logging
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `packages/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)

## Where things live

- `packages/db/src/schema/` — Drizzle schema (14 tables)
- `packages/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `packages/api-client-react/src/generated/` — generated React Query hooks + Zod schemas
- `apps/api-server/src/routes/` — Express route handlers
- `apps/api-server/src/app.ts` — Express app + session/cookie config
- `apps/inventory-pro/src/pages/` — all frontend pages
- `apps/inventory-pro/src/components/layout/app-layout.tsx` — sidebar nav

## Architecture decisions

- Cookie-based sessions (express-session) — no JWT; session stored server-side
- Numeric DB fields use Drizzle `numeric` type → returned as strings from pg; use `String()` before parseFloat
- OpenAPI contract-first: never edit generated files; always run codegen after spec changes
- All routes prefixed with `/api` — handled by the global proxy
- `useGetXxx(id, { query: { enabled: !!id, queryKey: [...] } })` pattern required by Orval-generated hooks

## Product

- **Dashboard**: KPI cards (revenue, GRN pending, transfers, credit outstanding), sales trend chart, low-stock & overdue alerts, pending approvals widget
- **Inventory**: stock levels by store/product, movement history (GRN receipts, transfers, production, sales)
- **GRN**: create → submit → approve/reject → mark paid workflow with full line-item tracking
- **Transfers**: inter-store transfer requests with approval workflow
- **Production**: batch tracking (raw→semi, semi→finished), input materials, actual vs planned output, yield & wastage %
- **Sales**: invoicing (cash + credit), VAT support, partial payment tracking, customer statements
- **Payments**: payment history for credit sales
- **Admin**: users (6 roles), stores, notifications, audit log

## Demo credentials

- `admin@inventorypro.com` / `admin123` — Super Admin
- `manager@inventorypro.com` / `manager123` — Store Manager

## User preferences

- Currency displayed as ETB (Ethiopian Birr) throughout
- All numeric DB fields must be cast with `String()` before `parseFloat()` due to pg returning numerics as strings

## Gotchas

- `pnpm --filter @workspace/api-spec run codegen` must be run after any OpenAPI spec change
- `useSubmitGrn` takes `{ id }` only (no `data`); other approval mutations take `{ id, data }`
- Status filter params (ListTransfersStatus, ListSalesStatus, etc.) are enum types — cast with `as ListXxxStatus` when passing from local string state
- ListAuditLogsParams, ListNotificationsParams, ListPaymentsParams have no `limit` param — pagination via `page` only
- ListInventoryParams has no `search` — filter client-side or by `storeId`/`productId`/`lowStock`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
