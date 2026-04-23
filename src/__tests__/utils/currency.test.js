 

// Import only pure functions — no React components
const { formatPrice, formatPriceArabic, formatPriceShort } = require('@/utils/currency');

describe('currency utilities', () => {
  describe('formatPrice', () => {
    it('should format positive MAD amount with symbol and decimals (en-MA)', () => {
      const result = formatPrice(123.45);
      expect(result).toBe('MAD 123,45');
    });

    it('should format zero with symbol and decimals', () => {
      const result = formatPrice(0);
      expect(result).toBe('MAD 0,00');
    });

    it('should format negative amount', () => {
      const result = formatPrice(-99.99);
      expect(result).toBe('MAD -99,99');
    });

    it('should handle null', () => {
      const result = formatPrice(null);
      expect(result).toBe('MAD 0,00');
    });

    it('should handle undefined', () => {
      const result = formatPrice(undefined);
      expect(result).toBe('MAD 0,00');
    });

    it('should handle NaN', () => {
      const result = formatPrice(NaN);
      expect(result).toBe('MAD 0,00');
    });

    it('should format without symbol when showSymbol=false', () => {
      const result = formatPrice(123.45, { showSymbol: false });
      expect(result).toBe('123,45');
    });

    it('should format without decimals when showDecimals=false', () => {
      const result = formatPrice(123.45, { showDecimals: false });
      expect(result).toBe('MAD 123');
    });

    it('should format USD with en-US locale', () => {
      const result = formatPrice(123.45, {
        currencyCode: 'USD',
        locale: 'en-US',
      });
      expect(result).toBe('$123.45');
    });

    it('should format EUR with en-US locale', () => {
      const result = formatPrice(123.45, {
        currencyCode: 'EUR',
        locale: 'en-US',
      });
      expect(result).toBe('€123.45');
    });

    it('should format DHS with en-AE locale', () => {
      const result = formatPrice(123.45, {
        currencyCode: 'DHS',
        locale: 'en-AE',
      });
      expect(result).toBe('AED 123.45');
    });

    it('should fallback gracefully on invalid locale', () => {
      const result = formatPrice(123.45, {
        locale: 'invalid-locale',
      });
      expect(result).toMatch(/MAD \d+\.\d+/);
    });
  });

  describe('formatPriceArabic', () => {
    it('should format positive amount in Arabic numerals', () => {
      const result = formatPriceArabic(123.45);
      expect(result).toContain('درهم');
    });

    it('should handle zero', () => {
      const result = formatPriceArabic(0);
      expect(result).toContain('درهم');
    });

    it('should handle null', () => {
      const result = formatPriceArabic(null);
      expect(result).toContain('درهم');
    });
  });

  describe('formatPriceShort', () => {
    it('should format small amount', () => {
      const result = formatPriceShort(123);
      expect(result).toBe('123 MAD');
    });

    it('should abbreviate thousands', () => {
      const result = formatPriceShort(1500);
      expect(result).toBe('1.5K MAD');
    });

    it('should abbreviate millions', () => {
      const result = formatPriceShort(2500000);
      expect(result).toBe('2.5M MAD');
    });

    it('should handle zero', () => {
      const result = formatPriceShort(0);
      expect(result).toBe('0 MAD');
    });

    it('should handle negative', () => {
      const result = formatPriceShort(-1000);
      expect(result).toBe('-1.0K MAD');
    });

    it('should support custom currency code', () => {
      const result = formatPriceShort(1500, { currencyCode: 'USD' });
      expect(result).toBe('1.5K USD');
    });
  });
});
