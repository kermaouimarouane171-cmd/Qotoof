-- ============================================
-- Migration 022: Delivery Zone Pricing & Payment RLS Hardening
-- Purpose: Align city-level delivery prices with Moroccan market reality
--          and replace the legacy permissive payments admin policy.
-- ============================================

BEGIN;

WITH zone_updates (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) AS (
  VALUES
    ('Casablanca', 'Centre Ville', 'CASA-C', 13.50, 1.60, 28),
    ('Casablanca', 'Ain Diab', 'CASA-AD', 14.00, 1.80, 30),
    ('Casablanca', 'Anfa', 'CASA-AN', 14.00, 1.70, 28),
    ('Casablanca', 'Maarif', 'CASA-MA', 13.00, 1.60, 25),
    ('Casablanca', 'Hay Hassani', 'CASA-HH', 12.00, 1.50, 24),
    ('Casablanca', 'Sidi Bernoussi', 'CASA-SB', 11.00, 1.40, 22),
    ('Casablanca', 'Ain Sebaa', 'CASA-AS', 11.00, 1.40, 22),
    ('Casablanca', 'Ben M''sik', 'CASA-BM', 10.00, 1.30, 20),
    ('Casablanca', 'Sidi Othmane', 'CASA-SO', 10.00, 1.30, 20),
    ('Casablanca', 'Moulay Rachid', 'CASA-MR', 10.00, 1.20, 20),
    ('Rabat', 'Centre Ville', 'RABAT-C', 12.00, 1.50, 24),
    ('Rabat', 'Agdal', 'RABAT-AG', 12.50, 1.50, 25),
    ('Rabat', 'Hassan', 'RABAT-HA', 12.00, 1.40, 22),
    ('Rabat', 'Souissi', 'RABAT-SO', 13.50, 1.70, 26),
    ('Rabat', 'Yacoub El Mansour', 'RABAT-YM', 11.00, 1.30, 22),
    ('Rabat', 'Ocean', 'RABAT-OC', 12.00, 1.40, 22),
    ('Rabat', 'Akkray', 'RABAT-AK', 11.00, 1.30, 22),
    ('Marrakech', 'Medina', 'MARR-ME', 10.00, 1.30, 18),
    ('Marrakech', 'Gueliz', 'MARR-GU', 11.50, 1.50, 20),
    ('Marrakech', 'Menara', 'MARR-MN', 10.50, 1.30, 20),
    ('Marrakech', 'Hivernage', 'MARR-HI', 13.00, 1.70, 22),
    ('Marrakech', 'Sidi Youssef', 'MARR-SY', 9.50, 1.20, 18),
    ('Marrakech', 'Massira', 'MARR-MS', 10.00, 1.20, 18),
    ('Tangier', 'Centre Ville', 'TANG-C', 11.50, 1.50, 22),
    ('Tangier', 'Malabata', 'TANG-ML', 13.00, 1.70, 24),
    ('Tangier', 'Boukhalef', 'TANG-BK', 12.00, 1.50, 22),
    ('Tangier', 'Iberia', 'TANG-IB', 12.50, 1.60, 22),
    ('Tangier', 'Beni Makada', 'TANG-BM', 10.50, 1.30, 20),
    ('Fes', 'Medina', 'FES-ME', 10.00, 1.30, 18),
    ('Fes', 'Ville Nouvelle', 'FES-VN', 11.50, 1.50, 20),
    ('Fes', 'Zouagha', 'FES-ZO', 10.50, 1.30, 18),
    ('Fes', 'Saiss', 'FES-SA', 10.50, 1.30, 20),
    ('Fes', 'Agdal', 'FES-AG', 11.50, 1.50, 20),
    ('Agadir', 'Centre', 'AGAD-C', 11.00, 1.40, 20),
    ('Agadir', 'Sonaba', 'AGAD-SN', 12.00, 1.50, 22),
    ('Agadir', 'Founty', 'AGAD-FO', 12.50, 1.60, 22),
    ('Agadir', 'Ben Sergao', 'AGAD-BS', 10.50, 1.30, 20),
    ('Agadir', 'Tikiouine', 'AGAD-TI', 10.00, 1.20, 18),
    ('Meknes', 'Medina', 'MEKN-ME', 9.50, 1.20, 18),
    ('Meknes', 'Ville Nouvelle', 'MEKN-VN', 10.50, 1.40, 20),
    ('Meknes', 'Hamria', 'MEKN-HA', 10.50, 1.30, 20),
    ('Meknes', 'Toulal', 'MEKN-TO', 9.50, 1.20, 18),
    ('Oujda', 'Centre', 'OUJD-C', 10.00, 1.30, 18),
    ('Oujda', 'Hay Al Qods', 'OUJD-HQ', 9.50, 1.20, 18),
    ('Oujda', 'Sidi Yahya', 'OUJD-SY', 10.50, 1.30, 20),
    ('Kenitra', 'Centre', 'KENI-C', 10.50, 1.30, 20),
    ('Kenitra', 'Mimosas', 'KENI-MI', 11.00, 1.40, 22),
    ('Kenitra', 'Val Fleuri', 'KENI-VF', 11.00, 1.40, 22),
    ('Kenitra', 'Ouled Oujih', 'KENI-OO', 10.00, 1.20, 20),
    ('Tetouan', 'Medina', 'TET-ME', 9.50, 1.20, 18),
    ('Tetouan', 'Centre', 'TET-C', 10.50, 1.40, 20),
    ('Tetouan', 'M''hannech', 'TET-MH', 10.00, 1.30, 18),
    ('Tetouan', 'Azla', 'TET-AZ', 11.00, 1.50, 20),
    ('Temara', 'Centre', 'TEMA-C', 11.00, 1.30, 20),
    ('Temara', 'Harhoura', 'TEMA-HA', 13.00, 1.70, 24),
    ('Temara', 'Wafaa', 'TEMA-WA', 10.50, 1.30, 20),
    ('Sale', 'Medina', 'SALE-ME', 10.00, 1.20, 20),
    ('Sale', 'Tabriquet', 'SALE-TA', 10.50, 1.30, 22),
    ('Sale', 'Bettana', 'SALE-BE', 10.50, 1.30, 22),
    ('Sale', 'Hay Salam', 'SALE-HS', 10.00, 1.20, 20),
    ('Sale', 'Kariat', 'SALE-KA', 10.00, 1.20, 20),
    ('Nador', 'Centre', 'NADO-C', 10.00, 1.30, 18),
    ('Nador', 'Al Aarar', 'NADO-AA', 9.50, 1.20, 18),
    ('Nador', 'Ben Ansar', 'NADO-BA', 10.50, 1.40, 20),
    ('Settat', 'Centre', 'SETT-C', 9.50, 1.20, 18),
    ('Settat', 'Hay Hassani', 'SETT-HH', 10.00, 1.20, 18),
    ('El Jadida', 'Centre', 'ELJA-C', 10.00, 1.30, 18),
    ('El Jadida', 'Haouzia', 'ELJA-HA', 11.00, 1.40, 20),
    ('Beni Mellal', 'Centre', 'BENI-C', 10.00, 1.20, 18),
    ('Beni Mellal', 'Hay Salam', 'BENI-HS', 10.00, 1.20, 18),
    ('Mohammedia', 'Centre', 'MOHA-C', 12.00, 1.50, 22),
    ('Mohammedia', 'Corniche', 'MOHA-CO', 13.50, 1.70, 24),
    ('Khouribga', 'Centre', 'KHOU-C', 9.50, 1.20, 18),
    ('Khouribga', 'Oued Zem', 'KHOU-OZ', 10.00, 1.30, 20),
    ('Tiznit', 'Centre', 'TIZN-C', 9.50, 1.20, 18),
    ('Essaouira', 'Medina', 'ESSA-ME', 10.00, 1.30, 18),
    ('Essaouira', 'Centre', 'ESSA-C', 10.50, 1.40, 18)
)
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km)
SELECT city, zone_name, zone_code, base_price, price_per_km, max_distance_km
FROM zone_updates
ON CONFLICT (city, zone_name) DO UPDATE SET
  zone_code = EXCLUDED.zone_code,
  base_price = EXCLUDED.base_price,
  price_per_km = EXCLUDED.price_per_km,
  max_distance_km = EXCLUDED.max_distance_km,
  updated_at = NOW();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

COMMIT;