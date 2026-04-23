-- ============================================
-- Delivery Zones - Morocco Major Cities
-- Purpose: Add default delivery zones for Moroccan cities
-- ============================================

-- Clear existing data (optional)
-- DELETE FROM delivery_zones;

-- ============================================
-- CASABLANCA
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Casablanca', 'Centre Ville', 'CASA-C', 15.0, 2.0, 50),
('Casablanca', 'Ain Diab', 'CASA-AD', 18.0, 2.5, 50),
('Casablanca', 'Anfa', 'CASA-AN', 16.0, 2.0, 50),
('Casablanca', 'Maarif', 'CASA-MA', 15.0, 2.0, 50),
('Casablanca', 'Hay Hassani', 'CASA-HH', 14.0, 1.8, 50),
('Casablanca', 'Sidi Bernoussi', 'CASA-SB', 13.0, 1.5, 50),
('Casablanca', 'Ain Sebaa', 'CASA-AS', 13.0, 1.5, 50),
('Casablanca', 'Ben M''sik', 'CASA-BM', 12.0, 1.5, 50),
('Casablanca', 'Sidi Othmane', 'CASA-SO', 12.0, 1.5, 50),
('Casablanca', 'Moulay Rachid', 'CASA-MR', 12.0, 1.5, 50)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- RABAT
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Rabat', 'Centre Ville', 'RABAT-C', 12.0, 1.8, 40),
('Rabat', 'Agdal', 'RABAT-AG', 13.0, 1.8, 40),
('Rabat', 'Hassan', 'RABAT-HA', 12.0, 1.8, 40),
('Rabat', 'Souissi', 'RABAT-SO', 15.0, 2.0, 40),
('Rabat', 'Yacoub El Mansour', 'RABAT-YM', 11.0, 1.5, 40),
('Rabat', 'Ocean', 'RABAT-OC', 12.0, 1.8, 40),
('Rabat', 'Akkray', 'RABAT-AK', 11.0, 1.5, 40)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- MARRAKECH
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Marrakech', 'Medina', 'MARR-ME', 10.0, 1.5, 30),
('Marrakech', 'Gueliz', 'MARR-GU', 12.0, 1.8, 30),
('Marrakech', 'Menara', 'MARR-MN', 11.0, 1.5, 30),
('Marrakech', 'Hivernage', 'MARR-HI', 13.0, 2.0, 30),
('Marrakech', 'Sidi Youssef', 'MARR-SY', 10.0, 1.5, 30),
('Marrakech', 'Massira', 'MARR-MS', 10.0, 1.5, 30)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- TANGIER
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Tangier', 'Centre Ville', 'TANG-C', 12.0, 2.0, 40),
('Tangier', 'Malabata', 'TANG-ML', 14.0, 2.0, 40),
('Tangier', 'Boukhalef', 'TANG-BK', 13.0, 2.0, 40),
('Tangier', 'Iberia', 'TANG-IB', 12.0, 1.8, 40),
('Tangier', 'Beni Makada', 'TANG-BM', 11.0, 1.5, 40)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- FES
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Fes', 'Medina', 'FES-ME', 10.0, 1.5, 35),
('Fes', 'Ville Nouvelle', 'FES-VN', 12.0, 1.8, 35),
('Fes', 'Zouagha', 'FES-ZO', 11.0, 1.5, 35),
('Fes', 'Saiss', 'FES-SA', 11.0, 1.5, 35),
('Fes', 'Agdal', 'FES-AG', 12.0, 1.8, 35)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- AGADIR
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Agadir', 'Centre', 'AGAD-C', 11.0, 1.8, 35),
('Agadir', 'Sonaba', 'AGAD-SN', 12.0, 1.8, 35),
('Agadir', 'Founty', 'AGAD-FO', 13.0, 2.0, 35),
('Agadir', 'Ben Sergao', 'AGAD-BS', 10.0, 1.5, 35),
('Agadir', 'Tikiouine', 'AGAD-TI', 10.0, 1.5, 35)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- MEKNES
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Meknes', 'Medina', 'MEKN-ME', 10.0, 1.5, 30),
('Meknes', 'Ville Nouvelle', 'MEKN-VN', 11.0, 1.8, 30),
('Meknes', 'Hamria', 'MEKN-HA', 11.0, 1.5, 30),
('Meknes', 'Toulal', 'MEKN-TO', 10.0, 1.5, 30)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- OUJDA
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Oujda', 'Centre', 'OUJD-C', 10.0, 1.5, 30),
('Oujda', 'Hay Al Qods', 'OUJD-HQ', 10.0, 1.5, 30),
('Oujda', 'Sidi Yahya', 'OUJD-SY', 11.0, 1.5, 30)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- KENITRA
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Kenitra', 'Centre', 'KENI-C', 10.0, 1.5, 30),
('Kenitra', 'Mimosas', 'KENI-MI', 11.0, 1.5, 30),
('Kenitra', 'Val Fleuri', 'KENI-VF', 11.0, 1.5, 30),
('Kenitra', 'Ouled Oujih', 'KENI-OO', 10.0, 1.5, 30)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- TETOUAN
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Tetouan', 'Medina', 'TET-ME', 10.0, 1.5, 25),
('Tetouan', 'Centre', 'TET-C', 11.0, 1.8, 25),
('Tetouan', 'M''hannech', 'TET-MH', 11.0, 1.5, 25),
('Tetouan', 'Azla', 'TET-AZ', 10.0, 1.5, 25)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- TEMARA
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Temara', 'Centre', 'TEMA-C', 11.0, 1.5, 30),
('Temara', 'Harhoura', 'TEMA-HA', 13.0, 2.0, 30),
('Temara', 'Wafaa', 'TEMA-WA', 11.0, 1.5, 30)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- SALE
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Sale', 'Medina', 'SALE-ME', 10.0, 1.5, 30),
('Sale', 'Tabriquet', 'SALE-TA', 11.0, 1.5, 30),
('Sale', 'Bettana', 'SALE-BE', 11.0, 1.5, 30),
('Sale', 'Hay Salam', 'SALE-HS', 10.0, 1.5, 30),
('Sale', 'Kariat', 'SALE-KA', 10.0, 1.5, 30)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- NADOR
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Nador', 'Centre', 'NADO-C', 10.0, 1.5, 25),
('Nador', 'Al Aarar', 'NADO-AA', 10.0, 1.5, 25),
('Nador', 'Ben Ansar', 'NADO-BA', 11.0, 1.5, 25)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- SETTAT
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Settat', 'Centre', 'SETT-C', 10.0, 1.5, 25),
('Settat', 'Hay Hassani', 'SETT-HH', 10.0, 1.5, 25)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- EL JADIDA
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('El Jadida', 'Centre', 'ELJA-C', 10.0, 1.5, 25),
('El Jadida', 'Haouzia', 'ELJA-HA', 11.0, 1.5, 25)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- BENI MELLAL
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Beni Mellal', 'Centre', 'BENI-C', 10.0, 1.5, 25),
('Beni Mellal', 'Hay Salam', 'BENI-HS', 10.0, 1.5, 25)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- MOHAMMEDIA
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Mohammedia', 'Centre', 'MOHA-C', 12.0, 1.8, 30),
('Mohammedia', 'Corniche', 'MOHA-CO', 14.0, 2.0, 30)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- KHOURIBGA
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Khouribga', 'Centre', 'KHOU-C', 10.0, 1.5, 25),
('Khouribga', 'Oued Zem', 'KHOU-OZ', 11.0, 1.5, 25)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- TIZNIT
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Tiznit', 'Centre', 'TIZN-C', 10.0, 1.5, 20)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- ESSAOUIRA
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Essaouira', 'Medina', 'ESSA-ME', 10.0, 1.5, 20),
('Essaouira', 'Centre', 'ESSA-C', 11.0, 1.5, 20)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- Verification
-- ============================================
SELECT city, COUNT(*) as zones
FROM delivery_zones
GROUP BY city
ORDER BY city;

-- Total count
SELECT COUNT(*) as total_zones FROM delivery_zones;
