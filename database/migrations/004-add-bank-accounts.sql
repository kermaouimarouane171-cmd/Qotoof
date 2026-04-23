-- ============================================
-- Migration 004: Bank Accounts & Payments
-- Purpose: Add bank account management and payment tracking
-- ============================================

-- ============================================
-- 1. BANK ACCOUNTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    bank_name TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    rib TEXT NOT NULL UNIQUE,
    iban TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_rib ON bank_accounts(rib);

-- RLS
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Users can view their own bank account
DROP POLICY IF EXISTS "Users can view own bank account" ON bank_accounts;
CREATE POLICY "Users can view own bank account" ON bank_accounts
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own bank account
DROP POLICY IF EXISTS "Users can insert own bank account" ON bank_accounts;
CREATE POLICY "Users can insert own bank account" ON bank_accounts
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own bank account
DROP POLICY IF EXISTS "Users can update own bank account" ON bank_accounts;
CREATE POLICY "Users can update own bank account" ON bank_accounts
    FOR UPDATE USING (user_id = auth.uid());

-- Admins can view all bank accounts
DROP POLICY IF EXISTS "Admins can view all bank accounts" ON bank_accounts;
CREATE POLICY "Admins can view all bank accounts" ON bank_accounts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- 2. PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    amount DECIMAL(10, 2) NOT NULL,
    commission DECIMAL(10, 2) DEFAULT 0, -- Platform commission (2%)
    commission_rate DECIMAL(5, 2) DEFAULT 2.0, -- Commission percentage
    vendor_amount DECIMAL(10, 2) DEFAULT 0, -- Amount vendor receives
    currency TEXT DEFAULT 'MAD',
    payment_method TEXT NOT NULL, -- 'cod', 'bank_transfer', 'card'
    bank_name TEXT, -- For bank transfers
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'refunded'
    transaction_id TEXT, -- Bank transaction reference
    payment_proof_url TEXT, -- Screenshot of transfer
    admin_notes TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (user_id = auth.uid());

-- Users can create their own payments
DROP POLICY IF EXISTS "Users can create own payments" ON payments;
CREATE POLICY "Users can create own payments" ON payments
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own payment proof
DROP POLICY IF EXISTS "Users can update own payment proof" ON payments;
CREATE POLICY "Users can update own payment proof" ON payments
    FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

-- Vendors can view payments for their orders
DROP POLICY IF EXISTS "Vendors can view payments for their orders" ON payments;
CREATE POLICY "Vendors can view payments for their orders" ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = payments.order_id
            AND orders.vendor_id = auth.uid()
        )
    );

-- Admins can view all payments
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments" ON payments
    FOR SELECT USING (true);

-- Admins can update payment status
DROP POLICY IF EXISTS "Admins can update payment status" ON payments;
CREATE POLICY "Admins can update payment status" ON payments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- 3. MOROCCAN BANKS ENUM (as a table for flexibility)
-- ============================================
CREATE TABLE IF NOT EXISTS moroccan_banks (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code TEXT UNIQUE,
    color TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert major Moroccan banks
INSERT INTO moroccan_banks (name, code, color) VALUES
    ('Attijariwafa Bank', 'attijariwafa', '#F37021'),
    ('BMCE Bank of Africa', 'bmce', '#0066B3'),
    ('Banque Populaire', 'bp', '#E30613'),
    ('CIH Bank', 'cih', '#6B2D8B'),
    ('Credit du Maroc', 'cdm', '#009639'),
    ('Societe Generale Maroc', 'sg', '#E2001A'),
    ('Bank Al-Maghrib', 'bam', '#00529C'),
    ('Al Barid Bank', 'barid', '#FFD100'),
    ('CDG Capital', 'cdg', '#005EB8'),
    ('CFG Bank', 'cfg', '#003366'),
    ('Umnia Bank', 'umnia', '#8B0000'),
    ('Bank Assafa', 'assafa', '#00A651'),
    ('Dar Al Amane', 'daralamane', '#0057B8'),
    ('Al Akhdar Bank', 'akhdar', '#00843D')
ON CONFLICT (name) DO NOTHING;

-- Everyone can view banks
ALTER TABLE moroccan_banks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view banks" ON moroccan_banks;
CREATE POLICY "Everyone can view banks" ON moroccan_banks
    FOR SELECT USING (true);

-- ============================================
-- 4. FUNCTIONS
-- ============================================

-- Function: Get bank account by user ID
CREATE OR REPLACE FUNCTION get_bank_account(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    bank_name TEXT,
    account_holder TEXT,
    rib TEXT,
    iban TEXT,
    is_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT ba.id, ba.bank_name, ba.account_holder, ba.rib, ba.iban, ba.is_verified
    FROM bank_accounts ba
    WHERE ba.user_id = p_user_id;
END;
$$;

-- Function: Create or update bank account
CREATE OR REPLACE FUNCTION upsert_bank_account(
    p_user_id UUID,
    p_bank_name TEXT,
    p_account_holder TEXT,
    p_rib TEXT,
    p_iban TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Validate RIB (24 digits for Morocco)
    IF p_rib !~ '^[0-9]{24}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid RIB format (24 digits required)');
    END IF;

    INSERT INTO bank_accounts (user_id, bank_name, account_holder, rib, iban)
    VALUES (p_user_id, p_bank_name, p_account_holder, p_rib, p_iban)
    ON CONFLICT (user_id) DO UPDATE SET
        bank_name = EXCLUDED.bank_name,
        account_holder = EXCLUDED.account_holder,
        rib = EXCLUDED.rib,
        iban = EXCLUDED.iban,
        updated_at = NOW()
    RETURNING jsonb_build_object(
        'success', true,
        'id', id,
        'bank_name', bank_name,
        'rib', rib
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Function: Calculate commission
CREATE OR REPLACE FUNCTION calculate_commission(
    p_amount DECIMAL,
    p_rate DECIMAL DEFAULT 2.0
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_commission DECIMAL;
    v_vendor_amount DECIMAL;
BEGIN
    v_commission := ROUND(p_amount * (p_rate / 100), 2);
    v_vendor_amount := ROUND(p_amount - v_commission, 2);

    RETURN jsonb_build_object(
        'amount', p_amount,
        'commission_rate', p_rate,
        'commission', v_commission,
        'vendor_amount', v_vendor_amount
    );
END;
$$;

-- ============================================
-- 5. ADD COMMISSION COLUMNS TO ORDERS TABLE
-- ============================================
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS commission DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS vendor_amount DECIMAL(10, 2) DEFAULT 0;

-- ============================================
-- Migration complete!
-- ============================================
COMMENT ON TABLE bank_accounts IS 'User bank account information for payments';
COMMENT ON TABLE payments IS 'Payment records for orders';
COMMENT ON TABLE moroccan_banks IS 'List of Moroccan banks for selection';
