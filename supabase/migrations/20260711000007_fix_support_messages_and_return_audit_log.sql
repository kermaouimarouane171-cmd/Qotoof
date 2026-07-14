-- =============================================================================
-- Migration: Fix support_messages and return_audit_log schema mismatches + RLS
--
-- Problem: Both tables exist in the live database but their columns don't match
--          what the application code expects, causing 400 errors from PostgREST.
--
-- support_messages:
--   DB has: body (text)        Code uses: message (text)     ← MISMATCH
--   RLS: support_messages_policy (sender_id = auth.uid()) for ALL — too restrictive
--        (admin can't see messages, join from support_tickets fails for non-senders)
--
-- return_audit_log:
--   DB has: details (jsonb), created_at (timestamptz)
--   Code uses: notes (text), performed_at (timestamptz)      ← MISMATCH
--   RLS: DISABLED (rowsecurity=false) — security risk
--
-- Both tables have 0 rows, so renaming/adding columns is safe.
-- =============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. support_messages: add `message` column (keep `body` for backward compat)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS message TEXT;

-- Copy any data from body → message (table is empty, but safe practice)
UPDATE public.support_messages
SET message = body
WHERE message IS NULL AND body IS NOT NULL;

-- Make message NOT NULL to match code expectations (insert always provides it)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.support_messages WHERE message IS NULL) THEN
    ALTER TABLE public.support_messages ALTER COLUMN message SET NOT NULL;
  END IF;
END $$;

-- Make body nullable — code uses `message` column, not `body`.
-- Without this, INSERT fails with "null value in column body violates not-null constraint"
-- because the code (useSupportTicketQueries.js:98-101) only provides `message`, not `body`.
ALTER TABLE public.support_messages ALTER COLUMN body DROP NOT NULL;

-- Add index for ticket-based queries (used in useSupportTicketQueries.js:58)
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id
  ON public.support_messages(ticket_id);

CREATE INDEX IF NOT EXISTS idx_support_messages_created_at
  ON public.support_messages(created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. support_messages: fix RLS policies
-- ════════════════════════════════════════════════════════════════════════════
-- Drop the overly restrictive existing policy
DROP POLICY IF EXISTS "support_messages_policy" ON public.support_messages;

-- SELECT: ticket owner or admin can read messages
-- (useSupportTicketQueries.js:58 does a join: messages:support_messages(*)
--  from support_tickets — so the user viewing the ticket must see its messages)
CREATE POLICY "support_messages_ticket_owner_select"
  ON public.support_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = support_messages.ticket_id
        AND (st.user_id = auth.uid() OR public.current_user_role() = 'admin')
    )
  );

-- INSERT: ticket owner or admin can send messages
-- (useSupportTicketQueries.js:96-101 inserts with ticket_id, sender_id, message)
CREATE POLICY "support_messages_ticket_owner_insert"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = support_messages.ticket_id
        AND (st.user_id = auth.uid() OR public.current_user_role() = 'admin')
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 3. return_audit_log: add missing columns
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.return_audit_log
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS performed_at TIMESTAMPTZ DEFAULT NOW();

-- Add CHECK constraint on action (code only uses: refund_issued, escalated, closed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'return_audit_log_action_check'
  ) THEN
    ALTER TABLE public.return_audit_log
      ADD CONSTRAINT return_audit_log_action_check
      CHECK (action IN ('refund_issued', 'escalated', 'closed'));
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_return_audit_log_return_id
  ON public.return_audit_log(return_id);

CREATE INDEX IF NOT EXISTS idx_return_audit_log_performed_at
  ON public.return_audit_log(performed_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. return_audit_log: enable RLS + add policies
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.return_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: return participants (buyer, vendor) or admin can read audit entries
-- (buyer wants to know what happened to their return;
--  vendor wants to know admin decisions on their products)
CREATE POLICY "return_audit_log_participants_select"
  ON public.return_audit_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.return_requests rr
      WHERE rr.id = return_audit_log.return_id
        AND (rr.buyer_id = auth.uid() OR rr.vendor_id = auth.uid() OR public.current_user_role() = 'admin')
    )
  );

-- INSERT: admin only (processReturn in returns.js:259 is called with adminId)
-- Vendor approve/reject (respondToReturnRequest) does NOT write to return_audit_log
-- — it only updates return_requests columns (vendor_response, vendor_response_at)
CREATE POLICY "return_audit_log_admin_insert"
  ON public.return_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

DO $$
BEGIN
  RAISE NOTICE '✅ support_messages: added message column + fixed RLS (ticket owner + admin)';
  RAISE NOTICE '✅ return_audit_log: added notes + performed_at columns + enabled RLS';
  RAISE NOTICE '✅ return_audit_log: INSERT admin-only (vendor does not write audit log)';
END $$;
