# Express Sidecar Deprecation Plan

The Express sidecar (`src/api/`) is a legacy Node.js server that predates the
Supabase migration. All frontend UI already calls Supabase directly. These
routes have **zero active consumers in the React app** unless explicitly noted.

## Route Decision Table

### `driver.routes.js` — all RETIRE

| Method | Path | Decision | Replacement |
|--------|------|----------|-------------|
| GET | `/api/driver/metrics` | RETIRE | `deliveriesApi.getMetrics()` (Supabase) |
| GET | `/api/driver/deliveries` | RETIRE | `deliveriesApi.getDriverDeliveries()` |
| GET | `/api/driver/deliveries/available` | RETIRE | `deliveriesApi.getAvailableDeliveries()` |
| POST | `/api/driver/deliveries/:id/accept` | RETIRE | `deliveriesApi.acceptDelivery()` |
| PATCH | `/api/driver/deliveries/:id` | RETIRE | `deliveriesApi.updateStatus()` |
| GET | `/api/driver/stats` | RETIRE | `deliveriesApi.getStats()` |

### `admin-drivers.routes.js` — READ routes RETIRE, write routes KEEP temporarily

| Method | Path | Decision | Reasoning |
|--------|------|----------|-----------|
| GET | `/api/admin/drivers/stats/overview` | RETIRE | Supabase `profiles?role=driver` + aggregate |
| GET | `/api/admin/drivers` | RETIRE | Supabase `profiles?role=driver` (PostgREST filters) |
| GET | `/api/admin/drivers/:id` | RETIRE | Supabase profile + deliveries join |
| POST | `/api/admin/drivers/:id/suspend` | **KEEP** | No Edge Function equivalent yet; writes to legacy `drivers` table |
| POST | `/api/admin/drivers/:id/activate` | **KEEP** | Same as above |

## Dead modules

| File | Status | Reason |
|------|--------|--------|
| `src/services/axiosInstance.js` | PROPOSE DELETE | Only imported by `authMiddleware.js`; no active UI consumer |
| `src/middleware/authMiddleware.js` | PROPOSE DELETE | 0 imports in any page or component |

## Migration path for KEEP routes

The `/suspend` and `/activate` routes write to a legacy `drivers` table (not
`profiles`). To retire them, create a Supabase Edge Function
`admin-set-driver-status` that:
1. Accepts `{ driverId, status: 'active' | 'suspended' }`.
2. Updates `profiles.driver_status` (or `profiles.is_suspended`) with
   `service_role` key.
3. Verifies caller is admin via `auth.uid()` role check.

Once that Edge Function ships, the two Express routes can be deleted.

## Timeline

- **Now**: Routes marked `@deprecated` in source. Sidecar still starts.
- **Next sprint**: Create `admin-set-driver-status` Edge Function.
- **After**: Remove `driver.routes.js` entirely; remove KEEP routes from
  `admin-drivers.routes.js`; delete `axiosInstance.js` + `authMiddleware.js`.
