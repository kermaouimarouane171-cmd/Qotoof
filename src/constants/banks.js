/**
 * Moroccan banks configuration.
 * Centralized from:
 * - pages/BankAccount.jsx
 * - pages/CheckoutSimplified.jsx
 */

export const MOROCCAN_BANKS = [
  { name: 'Attijariwafa Bank', code: 'attijariwafa', color: '#F37021' },
  { name: 'BMCE Bank of Africa', code: 'bmce', color: '#0066B3' },
  { name: 'Banque Populaire', code: 'bp', color: '#E30613' },
  { name: 'CIH Bank', code: 'cih', color: '#6B2D8B' },
  { name: 'Crédit du Maroc', code: 'cdm', color: '#00529C' },
  { name: 'Crédit Agricole du Maroc', code: 'cam', color: '#007A33' },
  { name: 'Al Barid Bank', code: 'barid', color: '#FFD100' },
  { name: 'Société Générale Maroc', code: 'sg', color: '#E2001A' },
  { name: 'CFG Bank', code: 'cfg', color: '#003366' },
  { name: 'Umnia Bank', code: 'umnia', color: '#8B0000' },
  { name: 'Bank Assafa', code: 'assafa', color: '#00A651' },
]

// Helper: find bank by code
export const getBankByCode = (code) => {
  return MOROCCAN_BANKS.find((bank) => bank.code === code) || MOROCCAN_BANKS[0]
}

// Helper: get bank by name
export const getBankByName = (name) => {
  return MOROCCAN_BANKS.find((bank) => bank.name === name) || MOROCCAN_BANKS[0]
}
