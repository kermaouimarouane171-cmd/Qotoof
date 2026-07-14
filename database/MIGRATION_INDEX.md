# Database Migration Index

_Last updated: 2026-05-24_

This file is the single source of truth for database schema setup and migration execution in this repository.

## Canonical Strategy (From Scratch to Current)

Use one migration track only. The canonical track is:

1. `supabase/migrations/*.sql` in ascending filename order (timestamp/number order).
2. Post-canonical patch set (apply in this exact order if needed by current app behavior):
   1. `database/migrations/20260519_add_missing_profiles_columns.sql`
   2. `database/migrations/20260519_fix_driver_schema.sql`
   3. `database/migrations/20260519_fix_product_images_fk.sql`
   4. `database/migrations/20260519_rls_hardening_audit.sql`
   5. `database/migrations/027-add-driver-assignment-functions.sql` (only if functions are missing)
   6. `database/migrations/028-delivery-zone-dedup-and-uniqueness.sql` (only if uniqueness constraints are missing)

> Do **not** run `database/migrations/000-026*` and `migrations/SUPABASE_*.sql` on top of the canonical supabase track; they overlap heavily and cause duplicate-object conflicts.

## Unified Migration Track (Data Stabilization)

For fresh environments or full schema consolidation, use the unified migration set instead of the scattered tracks:

1. `database/migrations/030-unified-schema.sql` — canonical schema with 81 tables
2. `database/migrations/031-unified-rls-policies.sql` — consolidated RLS policies
3. `database/migrations/032-order-state-machine.sql` — order/delivery state machine
4. `database/migrations/033-verify-schema.sql` — post-migration verification

Tables consolidated into `030-unified-schema.sql` from scattered migrations include: `carts`, `cart_items`, `checkout_requests`, `regions`, `city_distances`, `vendor_cancellation_policies`, `vendor_delivery_slots`, `vendor_wait_responses`, `vendor_contracts`, `product_waitlists`, `notification_preferences`, `loyalty_rewards`, `referrals`, `invoices`, `payment_methods`, `user_payment_methods`, `platform_commissions`, `vendor_monthly_sales`, `confirmed_transactions`, `commission_notifications`, `cancellation_log`, `payment_disputes`, `payment_terms_acceptance`, `driver_broadcast_events`.

Tables dropped during cleanup: `active_sessions`, `payouts`, `driver_location_history`, `user_violations`, `user_creation_audit`, `request_rate_limits`.

Tables kept for future use (not added to unified schema): `mfa_settings`, `otp_codes`, `digital_signatures`, `offline_sync_queue`, `rfqs`, `rfq_offers`, `subscription_plans`, `subscription_history`, `partnership_requests`.

## How To Run Migrations

### Prerequisites
- Supabase CLI installed and project linked.
- PostgreSQL access for target DB (local or hosted).
- Environment configured (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, service role/DB URL as needed).

### Recommended Commands
- Local rebuild from scratch: `npx supabase db reset`
- Apply pending canonical migrations: `npx supabase db push`
- Project wrapper: `npm run db:push`
- Apply one manual patch file: `psql "$DATABASE_URL" -f <path/to/file.sql>`

## Conflict Map (Tables Created in Multiple Files)

High-risk duplicates (top by number of create-table definitions):

| Table | Duplicate Create Count | Example Files |
|---|---:|---|
| driver_locations | 5 | `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/002-create-missing-tables.sql`; `supabase/migrations/20260414000003_geographic_delivery_system.sql` |
| active_sessions | 5 | `database/migrations/009-add-security-features.sql`; `database/migrations/023-create-missing-tables.sql`; `supabase/migrations/20260414000006_mfa_and_sessions.sql` |
| partnership_requests | 4 | `migrations/SUPABASE_FULL_MIGRATION.sql`; `migrations/SUPABASE_FINAL_MIGRATION.sql`; `supabase/migrations/20260421000012_supabase_full_migration.sql` |
| driver_broadcast_events | 4 | `migrations/SUPABASE_FULL_MIGRATION.sql`; `migrations/SUPABASE_FINAL_MIGRATION.sql`; `supabase/migrations/20260422000014_final_marketplace_features.sql` |
| delivery_zones | 4 | `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/005-add-delivery-tracking.sql`; `supabase/migrations/20260504000030_delivery_zone_pricing_and_rls_hardening.sql` |
| delivery_tracking | 4 | `database/fixes-critical.sql`; `database/migrations/002-create-missing-tables.sql`; `database/migrations/005-add-delivery-tracking.sql` |
| audit_logs | 4 | `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/009-add-security-features.sql`; `migrations/add_audit_logs.sql` |
| verification_documents | 3 | `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/001-add-favorites-table.sql`; `database/migrations/002-create-missing-tables.sql` |
| vendor_monthly_sales | 3 | `migrations/SUPABASE_COMMISSION_MIGRATION.sql`; `migrations/SUPABASE_FINAL_MIGRATION.sql`; `supabase/migrations/20260422000014_final_marketplace_features.sql` |
| vendor_contracts | 3 | `migrations/SUPABASE_COMMISSION_MIGRATION.sql`; `migrations/SUPABASE_FINAL_MIGRATION.sql`; `supabase/migrations/20260422000014_final_marketplace_features.sql` |
| user_reports | 3 | `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/002-create-missing-tables.sql`; `database/migrations/006b-add-user-reporting.sql` |
| support_tickets | 3 | `database/migrations/000-complete-fresh-setup.sql`; `migrations/SUPABASE_CRITICAL_MIGRATION.sql`; `supabase/migrations/20260422000022_supabase_critical_migration.sql` |
| security_alerts | 3 | `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/008b-add-security-alerts-and-ip-blocking.sql`; `database/migrations/023-create-missing-tables.sql` |
| payments | 3 | `database/fixes-critical.sql`; `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/004-add-bank-accounts.sql` |
| order_timeline | 3 | `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/001-add-favorites-table.sql`; `database/migrations/002-create-missing-tables.sql` |
| mfa_settings | 3 | `database/migrations/009-add-security-features.sql`; `database/migrations/023-create-missing-tables.sql`; `supabase/migrations/20260414000006_mfa_and_sessions.sql` |
| messages | 3 | `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/001-add-favorites-table.sql`; `database/migrations/002-create-missing-tables.sql` |
| invoices | 3 | `database/migrations/017-vendor-subscriptions.sql`; `migrations/SUPABASE_MISSING_FEATURES_MIGRATION.sql`; `supabase/migrations/20260422000017_missing_features.sql` |
| driver_pricing | 3 | `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/002-create-missing-tables.sql`; `database/migrations/005-add-delivery-tracking.sql` |
| driver_location_history | 3 | `database/migrations/005-add-delivery-tracking.sql`; `migrations/SUPABASE_FINAL_MIGRATION.sql`; `supabase/migrations/20260422000014_final_marketplace_features.sql` |
| delivery_requests | 3 | `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/002-create-missing-tables.sql`; `supabase/migrations/20260414000003_geographic_delivery_system.sql` |
| delivery_checklist | 3 | `database/driver-enhancements.sql`; `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/002-create-missing-tables.sql` |
| confirmed_transactions | 3 | `migrations/SUPABASE_COMMISSION_MIGRATION.sql`; `migrations/SUPABASE_FINAL_MIGRATION.sql`; `supabase/migrations/20260422000014_final_marketplace_features.sql` |
| commission_notifications | 3 | `migrations/SUPABASE_COMMISSION_MIGRATION.sql`; `migrations/SUPABASE_FINAL_MIGRATION.sql`; `supabase/migrations/20260422000014_final_marketplace_features.sql` |
| blocked_ips | 3 | `database/migrations/000-complete-fresh-setup.sql`; `database/migrations/008b-add-security-alerts-and-ip-blocking.sql`; `database/migrations/023-create-missing-tables.sql` |

Full duplicate details are derivable from `/tmp/duplicate_created_tables.txt` (generated during analysis).

## Files Without Clear Ordering Number

These files have no leading sequence/timestamp and should be treated as manual/legacy patches:

- `database/driver-enhancements.sql`
- `database/enable-email-confirmations.sql`
- `database/fixes-critical.sql`
- `database/fix-rls.sql`
- `database/fix-signup-all-roles.sql`
- `database/fix-signup.sql`
- `database/security-enhancements.sql`
- `database/seed.sql`
- `migrations/add_audit_logs.sql`
- `migrations/add_outbox_pattern.sql`
- `migrations/create_driver_tables.sql` ⚠️ REMOVED — replaced by `database/migrations/030-unified-schema.sql`
- `migrations/SUPABASE_APPROVE_PRODUCTS.sql`
- `migrations/SUPABASE_CLEAN_FAKE_DATA.sql`
- `migrations/SUPABASE_COMMISSION_MIGRATION.sql`
- `migrations/SUPABASE_CRITICAL_MIGRATION.sql`
- `migrations/SUPABASE_DELIVERY_DOCS_MIGRATION.sql`
- `migrations/SUPABASE_FINAL_MIGRATION.sql`
- `migrations/SUPABASE_FIX_RLS_SCRIPT.sql`
- `migrations/SUPABASE_FULL_MIGRATION.sql`
- `migrations/SUPABASE_INVOICE_PARTY_POLICIES.sql`
- `migrations/SUPABASE_LOCATION_MIGRATION.sql`
- `migrations/SUPABASE_LOYALTY_REFERRAL_ENABLEMENT.sql`
- `migrations/SUPABASE_MISSING_FEATURES_MIGRATION.sql`
- `migrations/SUPABASE_NOTIFICATION_CENTER_ENABLEMENT.sql`
- `migrations/SUPABASE_PAYMENT_POLICY_MIGRATION.sql`
- `migrations/SUPABASE_SEED_REALISTIC_MOROCCO.sql`
- `migrations/SUPABASE_STORE_TYPE_MIGRATION.sql`

## Tables Referenced in Code But Not Found In SQL Migrations

The following tables are referenced via `supabase.from(...)` in code but were not found in analyzed SQL files:

- `avatars`
- `cart_items`
- `driver_profiles`
- `refunds`
- `return_audit_log`
- `signatures`
- `support_messages`

Potential interpretation:
- Created outside this repo (manual SQL or remote history), or
- Renamed/removed tables still referenced in code, or
- Views/materialized objects not represented as table DDL in current files.

## Inventory By Directory (Filename, Scope, Dependencies, Re-run Safety)

### database

| Filename | Location | Approx Tables Created/Modified | Dependencies (Approx) | Re-run Safety |
|---|---|---|---|---|
| `driver-enhancements.sql` | `database/driver-enhancements.sql` | deliveries, delivery_checklist, driver_performance, driver_verification_documents, notifications, orders, profiles, storage | profiles, orders, deliveries, notifications | caution-re-runnable |
| `enable-email-confirmations.sql` | `database/enable-email-confirmations.sql` | profiles | profiles | caution-re-runnable |
| `fixes-critical.sql` | `database/fixes-critical.sql` | delivery_tracking, notifications, orders, payments, products, profiles | profiles, orders, products, payments, notifications | caution-re-runnable |
| `fix-rls.sql` | `database/fix-rls.sql` | (none detected) | (none) | caution-re-runnable |
| `fix-signup-all-roles.sql` | `database/fix-signup-all-roles.sql` | profiles | profiles | caution-re-runnable |
| `fix-signup.sql` | `database/fix-signup.sql` | profiles | profiles | caution-re-runnable |
| `000-complete-fresh-setup.sql` | `database/migrations/000-complete-fresh-setup.sql` | addresses, audit_logs, bank_accounts, blocked_ips, comparison_lists, contact_messages, conversation_participants, conversations, coupon_redemptions, coupons, deliveries, delivery_checklist, delivery_requests, delivery_tracking, delivery_zones, driver_availability_log, driver_availability_requests, driver_locations, driver_pricing, driver_reviews, driver_verification_documents, favorites, financial_audit_log, loyalty_points, loyalty_transactions, messages, notifications, order_items, orders, order_timeline, payments, platform_settings, product_images, product_reviews, products, profiles, rate_limits, return_requests, returns, reviews, security_alerts, settings_audit_log, shopping_list_items, shopping_lists, stock_history, storage, store_follows, stores, support_tickets, tier_pricing, user_reports, user_settings, vendor_documents, vendor_schedules, verification_documents | profiles, orders, deliveries, products, payments, notifications, driver_locations, delivery_zones | caution-re-runnable |
| `001-add-favorites-table.sql` | `database/migrations/001-add-favorites-table.sql` | favorites, messages, order_timeline, profiles, storage, stores, verification_documents | profiles | caution-re-runnable |
| `002-create-missing-tables.sql` | `database/migrations/002-create-missing-tables.sql` | conversation_participants, conversations, delivery_checklist, delivery_requests, delivery_tracking, delivery_zones, driver_locations, driver_pricing, messages, order_timeline, storage, tier_pricing, user_reports, verification_documents | driver_locations, delivery_zones | caution-re-runnable |
| `004-add-bank-accounts.sql` | `database/migrations/004-add-bank-accounts.sql` | bank_accounts, moroccan_banks, orders, payments | orders, payments | caution-re-runnable |
| `005-add-delivery-tracking.sql` | `database/migrations/005-add-delivery-tracking.sql` | delivery_tracking, delivery_zones, driver_location_history, driver_pricing | delivery_zones | caution-re-runnable |
| `006-add-driver-notification-preferences.sql` | `database/migrations/006-add-driver-notification-preferences.sql` | profiles | profiles | caution-re-runnable |
| `006b-add-user-reporting.sql` | `database/migrations/006b-add-user-reporting.sql` | profiles, user_reports, user_violations | profiles | caution-re-runnable |
| `007-add-delivery-zones-morocco.sql` | `database/migrations/007-add-delivery-zones-morocco.sql` | delivery_zones | delivery_zones | run-once |
| `007b-add-vendor-notification-triggers.sql` | `database/migrations/007b-add-vendor-notification-triggers.sql` | notifications | notifications | caution-re-runnable |
| `008-add-notification-triggers.sql` | `database/migrations/008-add-notification-triggers.sql` | notifications | notifications | caution-re-runnable |
| `008b-add-security-alerts-and-ip-blocking.sql` | `database/migrations/008b-add-security-alerts-and-ip-blocking.sql` | blocked_ips, notifications, security_alerts | notifications | caution-re-runnable |
| `008c-complete-setup.sql` | `database/migrations/008c-complete-setup.sql` | addresses, coupons, deliveries, favorites, messages, notifications, order_items, orders, payments, products, profiles, returns, reviews, storage | profiles, orders, deliveries, products, payments, notifications | caution-re-runnable |
| `009-add-security-features.sql` | `database/migrations/009-add-security-features.sql` | active_sessions, audit_logs, digital_signatures, mfa_settings, offline_sync_queue, otp_codes, rate_limits | (none) | caution-re-runnable |
| `010-fix-missing-columns.sql` | `database/migrations/010-fix-missing-columns.sql` | profiles | profiles | caution-re-runnable |
| `011-add-subcategory-index.sql` | `database/migrations/011-add-subcategory-index.sql` | products | products | caution-re-runnable |
| `012-privacy-settings-and-deletion.sql` | `database/migrations/012-privacy-settings-and-deletion.sql` | profiles | profiles | caution-re-runnable |
| `013-return-requests-table.sql` | `database/migrations/013-return-requests-table.sql` | orders, return_requests | orders | caution-re-runnable |
| `014-vendor-review-replies.sql` | `database/migrations/014-vendor-review-replies.sql` | reviews | (none) | caution-re-runnable |
| `015-vendor-schedules.sql` | `database/migrations/015-vendor-schedules.sql` | profiles, vendor_schedules | profiles | caution-re-runnable |
| `016-stock-history.sql` | `database/migrations/016-stock-history.sql` | notifications, stock_history | notifications | caution-re-runnable |
| `017-vendor-subscriptions.sql` | `database/migrations/017-vendor-subscriptions.sql` | invoices, profiles, subscription_history, subscription_plans | profiles | caution-re-runnable |
| `018-delivery-race-condition-protection.sql` | `database/migrations/018-delivery-race-condition-protection.sql` | (none detected) | (none) | caution-re-runnable |
| `018-rfq-system.sql` | `database/migrations/018-rfq-system.sql` | rfq_offers, rfqs | (none) | caution-re-runnable |
| `020-product-approval-workflow.sql` | `database/migrations/020-product-approval-workflow.sql` | notifications, products | products, notifications | caution-re-runnable |
| `021-admin-orders-refund-audit.sql` | `database/migrations/021-admin-orders-refund-audit.sql` | audit_logs, orders, payments, return_requests | orders, payments | caution-re-runnable |
| `021b-payouts-audit-trail.sql` | `database/migrations/021b-payouts-audit-trail.sql` | financial_audit_log, notifications, payouts | notifications | caution-re-runnable |
| `022-delivery-zone-pricing-and-payment-rls-hardening.sql` | `database/migrations/022-delivery-zone-pricing-and-payment-rls-hardening.sql` | delivery_zones, payments | payments, delivery_zones | caution-re-runnable |
| `022-hash-backup-codes.sql` | `database/migrations/022-hash-backup-codes.sql` | audit_logs, mfa_settings, mfa_settings_backup_plaintext | (none) | caution-re-runnable |
| `023b-fix-schema-conflicts.sql` | `database/migrations/023b-fix-schema-conflicts.sql` | messages, order_timeline, verification_documents | (none) | caution-re-runnable |
| `023-create-missing-tables.sql` | `database/migrations/023-create-missing-tables.sql` | active_sessions, audit_logs, blocked_ips, digital_signatures, mfa_settings, offline_sync_queue, security_alerts | (none) | caution-re-runnable |
| `025-soft-deletes.sql` | `database/migrations/025-soft-deletes.sql` | deliveries, favorites, messages, notifications, order_items, orders, products, profiles, reviews | profiles, orders, deliveries, products, notifications | caution-re-runnable |
| `026-fix-all-schema-issues.sql` | `database/migrations/026-fix-all-schema-issues.sql` | audit_logs, delivery_requests, messages, payments, profiles, rate_limits, tier_pricing, vendor_schedules | profiles, payments | caution-re-runnable |
| `027-add-driver-assignment-functions.sql` | `database/migrations/027-add-driver-assignment-functions.sql` | deliveries, delivery_requests, driver_locations, profiles | profiles, deliveries, driver_locations | caution-re-runnable |
| `028-delivery-zone-dedup-and-uniqueness.sql` | `database/migrations/028-delivery-zone-dedup-and-uniqueness.sql` | delivery_zones | delivery_zones | caution-re-runnable |
| `20260519_add_missing_profiles_columns.sql` | `database/migrations/20260519_add_missing_profiles_columns.sql` | profiles | profiles | caution-re-runnable |
| `20260519_fix_driver_schema.sql` | `database/migrations/20260519_fix_driver_schema.sql` | deliveries, driver_earnings, driver_ratings, driver_reviews, drivers | deliveries | caution-re-runnable |
| `20260519_fix_product_images_fk.sql` | `database/migrations/20260519_fix_product_images_fk.sql` | product_images | (none) | caution-re-runnable |
| `20260519_rls_hardening_audit.sql` | `database/migrations/20260519_rls_hardening_audit.sql` | deliveries | deliveries | caution-re-runnable |
| `030-unified-schema.sql` | `database/migrations/030-unified-schema.sql` | consolidated canonical schema (81 tables) | auth.users, profiles | idempotent |
| `031-unified-rls-policies.sql` | `database/migrations/031-unified-rls-policies.sql` | RLS enablement + policies for all tables | all tables | idempotent |
| `032-order-state-machine.sql` | `database/migrations/032-order-state-machine.sql` | order/delivery state transition tables and triggers | orders, deliveries | idempotent |
| `033-verify-schema.sql` | `database/migrations/033-verify-schema.sql` | post-migration verification checks | all tables | idempotent |
| `security-enhancements.sql` | `database/security-enhancements.sql` | audit_logs, deliveries, orders, products, profiles, rate_limits | profiles, orders, deliveries, products | caution-re-runnable |
| `seed.sql` | `database/seed.sql` | product_images, products | products | run-once |

### supabase/migrations

| Filename | Location | Approx Tables Created/Modified | Dependencies (Approx) | Re-run Safety |
|---|---|---|---|---|
| `001_add_cin_to_profiles.sql` | `supabase/migrations/001_add_cin_to_profiles.sql` | profiles | profiles | caution-re-runnable |
| `002_add_driver_assignment.sql` | `supabase/migrations/002_add_driver_assignment.sql` | driver_availability_log, orders, vendor_wait_responses | orders | caution-re-runnable |
| `003_add_vendor_compliance.sql` | `supabase/migrations/003_add_vendor_compliance.sql` | orders, products, profiles, vendor_compliance_log | profiles, orders, products | caution-re-runnable |
| `004_add_commission_tracking.sql` | `supabase/migrations/004_add_commission_tracking.sql` | orders, platform_commissions | orders | idempotent-ish |
| `20260414000001_add_awaiting_driver_status.sql` | `supabase/migrations/20260414000001_add_awaiting_driver_status.sql` | (none detected) | (none) | run-once |
| `20260414000002_add_order_statuses.sql` | `supabase/migrations/20260414000002_add_order_statuses.sql` | (none detected) | (none) | run-once |
| `20260414000003_geographic_delivery_system.sql` | `supabase/migrations/20260414000003_geographic_delivery_system.sql` | city_distances, delivery_requests, driver_locations, regions | driver_locations | caution-re-runnable |
| `20260414000004_create_order_status_indexes.sql` | `supabase/migrations/20260414000004_create_order_status_indexes.sql` | (none detected) | (none) | idempotent-ish |
| `20260414000005_fix_profiles_rls.sql` | `supabase/migrations/20260414000005_fix_profiles_rls.sql` | profiles | profiles | caution-re-runnable |
| `20260414000006_mfa_and_sessions.sql` | `supabase/migrations/20260414000006_mfa_and_sessions.sql` | active_sessions, mfa_settings | (none) | caution-re-runnable |
| `20260414000007_fix_mfa_sessions.sql` | `supabase/migrations/20260414000007_fix_mfa_sessions.sql` | active_sessions, mfa_settings | (none) | idempotent-ish |
| `20260414000008_fix_audit_logs.sql` | `supabase/migrations/20260414000008_fix_audit_logs.sql` | audit_logs | (none) | caution-re-runnable |
| `20260414000009_fix_auth_remaining.sql` | `supabase/migrations/20260414000009_fix_auth_remaining.sql` | active_sessions, mfa_settings, otp_codes | (none) | caution-re-runnable |
| `20260414000010_fix_active_sessions.sql` | `supabase/migrations/20260414000010_fix_active_sessions.sql` | active_sessions | (none) | idempotent-ish |
| `20260414000011_verify_otp_codes.sql` | `supabase/migrations/20260414000011_verify_otp_codes.sql` | otp_codes | (none) | caution-re-runnable |
| `20260421000012_supabase_full_migration.sql` | `supabase/migrations/20260421000012_supabase_full_migration.sql` | deliveries, driver_broadcast_events, driver_locations, orders, partnership_requests, profiles | profiles, orders, deliveries, driver_locations | caution-re-runnable |
| `20260421000013_store_type_delivery_options.sql` | `supabase/migrations/20260421000013_store_type_delivery_options.sql` | notifications, orders, products, profiles, store_type_evolution_log, store_type_rules | profiles, orders, products, notifications | caution-re-runnable |
| `20260422000014_final_marketplace_features.sql` | `supabase/migrations/20260422000014_final_marketplace_features.sql` | commission_notifications, confirmed_transactions, deliveries, driver_broadcast_events, driver_location_history, driver_locations, orders, partnership_requests, profiles, vendor_contracts, vendor_monthly_sales | profiles, orders, deliveries, driver_locations | caution-re-runnable |
| `20260422000015_payment_policy_and_disputes.sql` | `supabase/migrations/20260422000015_payment_policy_and_disputes.sql` | orders, payment_disputes, payment_terms_acceptance, profiles | profiles, orders | caution-re-runnable |
| `20260422000016_payment_receipts_storage.sql` | `supabase/migrations/20260422000016_payment_receipts_storage.sql` | storage | (none) | caution-re-runnable |
| `20260422000017_missing_features.sql` | `supabase/migrations/20260422000017_missing_features.sql` | coupon_redemptions, coupons, invoices, loyalty_points, loyalty_rewards, loyalty_transactions, notification_preferences, notifications, orders, products, product_waitlists, profiles, referrals, reviews, vendor_cancellation_policies, vendor_delivery_slots | profiles, orders, products, notifications | caution-re-runnable |
| `20260422000018_invoice_party_policies.sql` | `supabase/migrations/20260422000018_invoice_party_policies.sql` | (none detected) | (none) | caution-re-runnable |
| `20260422000019_loyalty_referral_enablement.sql` | `supabase/migrations/20260422000019_loyalty_referral_enablement.sql` | loyalty_rewards | (none) | caution-re-runnable |
| `20260422000020_notification_center_enablement.sql` | `supabase/migrations/20260422000020_notification_center_enablement.sql` | notifications | notifications | caution-re-runnable |
| `20260422000021_delivery_docs_fraud_system.sql` | `supabase/migrations/20260422000021_delivery_docs_fraud_system.sql` | deliveries, fraud_reports, orders, product_condition_photos, profiles, storage | profiles, orders, deliveries | caution-re-runnable |
| `20260422000022_supabase_critical_migration.sql` | `supabase/migrations/20260422000022_supabase_critical_migration.sql` | active_sessions, phone_otp, profiles, refund_policies, support_tickets, user_activity_log | profiles | caution-re-runnable |
| `20260423000023_add_cancellation_log.sql` | `supabase/migrations/20260423000023_add_cancellation_log.sql` | cancellation_log, orders | orders | caution-re-runnable |
| `20260504000030_delivery_zone_pricing_and_rls_hardening.sql` | `supabase/migrations/20260504000030_delivery_zone_pricing_and_rls_hardening.sql` | delivery_requests, delivery_zones, driver_locations, payments | payments, driver_locations, delivery_zones | caution-re-runnable |
| `20260504000031_enforce_delivery_zone_uniqueness.sql` | `supabase/migrations/20260504000031_enforce_delivery_zone_uniqueness.sql` | delivery_zones | delivery_zones | caution-re-runnable |
| `20260505000032_server_side_rate_limits.sql` | `supabase/migrations/20260505000032_server_side_rate_limits.sql` | request_rate_limits | (none) | caution-re-runnable |
| `20260505000033_add_location_columns.sql` | `supabase/migrations/20260505000033_add_location_columns.sql` | orders, profiles | profiles, orders | idempotent-ish |
| `20260514000033_checkout_inventory_reservation.sql` | `supabase/migrations/20260514000033_checkout_inventory_reservation.sql` | (none detected) | (none) | caution-re-runnable |
| `20260514000034_checkout_idempotency_and_commission_guards.sql` | `supabase/migrations/20260514000034_checkout_idempotency_and_commission_guards.sql` | checkout_requests, confirmed_transactions, vendor_monthly_sales | (none) | caution-re-runnable |
| `20260519_create_order_view_rpc.sql` | `supabase/migrations/20260519_create_order_view_rpc.sql` | (none detected) | (none) | idempotent-ish |
| `20260519_create_outbox_table.sql` | `supabase/migrations/20260519_create_outbox_table.sql` | domain_events_outbox | (none) | idempotent-ish |
| `20260519_fix_session_schema_drift.sql` | `supabase/migrations/20260519_fix_session_schema_drift.sql` | active_sessions, mfa_settings | (none) | caution-re-runnable |
| `20260519_schedule_outbox_worker.sql` | `supabase/migrations/20260519_schedule_outbox_worker.sql` | (none detected) | (none) | run-once |
| `20260519_spatial_driver_query.sql` | `supabase/migrations/20260519_spatial_driver_query.sql` | (none detected) | (none) | idempotent-ish |

### migrations

| Filename | Location | Approx Tables Created/Modified | Dependencies (Approx) | Re-run Safety |
|---|---|---|---|---|
| `add_audit_logs.sql` | `migrations/add_audit_logs.sql` | audit_logs | (none) | caution-re-runnable |
| `add_outbox_pattern.sql` | `migrations/add_outbox_pattern.sql` | domain_events_outbox | (none) | run-once |
| `create_driver_tables.sql` | `migrations/create_driver_tables.sql` | deliveries, driver_earnings, drivers | deliveries | caution-re-runnable |
| `SUPABASE_APPROVE_PRODUCTS.sql` | `migrations/SUPABASE_APPROVE_PRODUCTS.sql` | products | products | caution-re-runnable |
| `SUPABASE_CLEAN_FAKE_DATA.sql` | `migrations/SUPABASE_CLEAN_FAKE_DATA.sql` | seed_user_ids | (none) | run-once |
| `SUPABASE_COMMISSION_MIGRATION.sql` | `migrations/SUPABASE_COMMISSION_MIGRATION.sql` | commission_notifications, confirmed_transactions, orders, profiles, vendor_contracts, vendor_monthly_sales | profiles, orders | caution-re-runnable |
| `SUPABASE_CRITICAL_MIGRATION.sql` | `migrations/SUPABASE_CRITICAL_MIGRATION.sql` | active_sessions, phone_otp, profiles, refund_policies, support_tickets, user_activity_log | profiles | caution-re-runnable |
| `SUPABASE_DELIVERY_DOCS_MIGRATION.sql` | `migrations/SUPABASE_DELIVERY_DOCS_MIGRATION.sql` | deliveries, fraud_reports, orders, product_condition_photos, profiles, storage | profiles, orders, deliveries | caution-re-runnable |
| `SUPABASE_FINAL_MIGRATION.sql` | `migrations/SUPABASE_FINAL_MIGRATION.sql` | commission_notifications, confirmed_transactions, deliveries, driver_broadcast_events, driver_location_history, driver_locations, orders, partnership_requests, profiles, vendor_contracts, vendor_monthly_sales | profiles, orders, deliveries, driver_locations | caution-re-runnable |
| `SUPABASE_FIX_RLS_SCRIPT.sql` | `migrations/SUPABASE_FIX_RLS_SCRIPT.sql` | profiles | profiles | caution-re-runnable |
| `SUPABASE_FULL_MIGRATION.sql` | `migrations/SUPABASE_FULL_MIGRATION.sql` | deliveries, driver_broadcast_events, driver_locations, orders, partnership_requests, profiles | profiles, orders, deliveries, driver_locations | caution-re-runnable |
| `SUPABASE_INVOICE_PARTY_POLICIES.sql` | `migrations/SUPABASE_INVOICE_PARTY_POLICIES.sql` | (none detected) | (none) | caution-re-runnable |
| `SUPABASE_LOCATION_MIGRATION.sql` | `migrations/SUPABASE_LOCATION_MIGRATION.sql` | orders, profiles | profiles, orders | idempotent-ish |
| `SUPABASE_LOYALTY_REFERRAL_ENABLEMENT.sql` | `migrations/SUPABASE_LOYALTY_REFERRAL_ENABLEMENT.sql` | loyalty_rewards | (none) | caution-re-runnable |
| `SUPABASE_MISSING_FEATURES_MIGRATION.sql` | `migrations/SUPABASE_MISSING_FEATURES_MIGRATION.sql` | coupon_redemptions, coupons, invoices, loyalty_points, loyalty_rewards, loyalty_transactions, notification_preferences, notifications, orders, products, product_waitlists, profiles, referrals, reviews, vendor_cancellation_policies, vendor_delivery_slots | profiles, orders, products, notifications | caution-re-runnable |
| `SUPABASE_NOTIFICATION_CENTER_ENABLEMENT.sql` | `migrations/SUPABASE_NOTIFICATION_CENTER_ENABLEMENT.sql` | notifications | notifications | caution-re-runnable |
| `SUPABASE_PAYMENT_POLICY_MIGRATION.sql` | `migrations/SUPABASE_PAYMENT_POLICY_MIGRATION.sql` | orders, payment_disputes, payment_terms_acceptance, profiles | profiles, orders | caution-re-runnable |
| `SUPABASE_SEED_REALISTIC_MOROCCO.sql` | `migrations/SUPABASE_SEED_REALISTIC_MOROCCO.sql` | auth, driver_locations, product_images, products, profiles | profiles, products, driver_locations | run-once |
| `SUPABASE_STORE_TYPE_MIGRATION.sql` | `migrations/SUPABASE_STORE_TYPE_MIGRATION.sql` | notifications, orders, products, profiles, store_type_evolution_log, store_type_rules | profiles, orders, products, notifications | caution-re-runnable |

### Root SUPABASE_*.sql

- No root-level `SUPABASE_*.sql` files were found.

## Known Issues

- `database/migrations/000-complete-fresh-setup.sql` overlaps with most other migrations and should not be combined with canonical supabase migration chain.
- `migrations/SUPABASE_FULL_MIGRATION.sql` and `supabase/migrations/20260421000012_supabase_full_migration.sql` contain parallel/duplicated intent; run only canonical supabase file.
- `migrations/SUPABASE_FINAL_MIGRATION.sql` overlaps with `supabase/migrations/20260422000014_final_marketplace_features.sql`.
- Seed/cleanup files (`database/seed.sql`, `migrations/SUPABASE_SEED_REALISTIC_MOROCCO.sql`, `migrations/SUPABASE_CLEAN_FAKE_DATA.sql`) are operational scripts, not schema baseline; run manually and cautiously.
- Unordered patch files (listed above) should be applied only with explicit environment-specific need and backup.

## Recommended Canonical Order (Explicit)

1. Run all `supabase/migrations/*.sql` in lexical order:
   - `supabase/migrations/001_add_cin_to_profiles.sql`
   - `supabase/migrations/002_add_driver_assignment.sql`
   - `supabase/migrations/003_add_vendor_compliance.sql`
   - `supabase/migrations/004_add_commission_tracking.sql`
   - `supabase/migrations/20260414000001_add_awaiting_driver_status.sql`
   - `supabase/migrations/20260414000002_add_order_statuses.sql`
   - `supabase/migrations/20260414000003_geographic_delivery_system.sql`
   - `supabase/migrations/20260414000004_create_order_status_indexes.sql`
   - `supabase/migrations/20260414000005_fix_profiles_rls.sql`
   - `supabase/migrations/20260414000006_mfa_and_sessions.sql`
   - `supabase/migrations/20260414000007_fix_mfa_sessions.sql`
   - `supabase/migrations/20260414000008_fix_audit_logs.sql`
   - `supabase/migrations/20260414000009_fix_auth_remaining.sql`
   - `supabase/migrations/20260414000010_fix_active_sessions.sql`
   - `supabase/migrations/20260414000011_verify_otp_codes.sql`
   - `supabase/migrations/20260421000012_supabase_full_migration.sql`
   - `supabase/migrations/20260421000013_store_type_delivery_options.sql`
   - `supabase/migrations/20260422000014_final_marketplace_features.sql`
   - `supabase/migrations/20260422000015_payment_policy_and_disputes.sql`
   - `supabase/migrations/20260422000016_payment_receipts_storage.sql`
   - `supabase/migrations/20260422000017_missing_features.sql`
   - `supabase/migrations/20260422000018_invoice_party_policies.sql`
   - `supabase/migrations/20260422000019_loyalty_referral_enablement.sql`
   - `supabase/migrations/20260422000020_notification_center_enablement.sql`
   - `supabase/migrations/20260422000021_delivery_docs_fraud_system.sql`
   - `supabase/migrations/20260422000022_supabase_critical_migration.sql`
   - `supabase/migrations/20260423000023_add_cancellation_log.sql`
   - `supabase/migrations/20260504000030_delivery_zone_pricing_and_rls_hardening.sql`
   - `supabase/migrations/20260504000031_enforce_delivery_zone_uniqueness.sql`
   - `supabase/migrations/20260505000032_server_side_rate_limits.sql`
   - `supabase/migrations/20260505000033_add_location_columns.sql`
   - `supabase/migrations/20260514000033_checkout_inventory_reservation.sql`
   - `supabase/migrations/20260514000034_checkout_idempotency_and_commission_guards.sql`
   - `supabase/migrations/20260519_create_order_view_rpc.sql`
   - `supabase/migrations/20260519_create_outbox_table.sql`
   - `supabase/migrations/20260519_fix_session_schema_drift.sql`
   - `supabase/migrations/20260519_schedule_outbox_worker.sql`
   - `supabase/migrations/20260519_spatial_driver_query.sql`
2. Optional post-canonical patches (only when validation shows missing objects):
   - `database/migrations/20260519_add_missing_profiles_columns.sql`
   - `database/migrations/20260519_fix_driver_schema.sql`
   - `database/migrations/20260519_fix_product_images_fk.sql`
   - `database/migrations/20260519_rls_hardening_audit.sql`
   - `database/migrations/027-add-driver-assignment-functions.sql`
   - `database/migrations/028-delivery-zone-dedup-and-uniqueness.sql`

- Additional tables consolidated into `030-unified-schema.sql` (carts, checkout_requests, regions, vendor contracts, financial tables, etc.)
- Tables dropped: `active_sessions`, `payouts`, `driver_location_history`, `user_violations`, `user_creation_audit`, `request_rate_limits`
