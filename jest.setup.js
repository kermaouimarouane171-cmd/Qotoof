import '@testing-library/jest-dom'
import { toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

// Mock import.meta.env for Vite (must be before any imports)
if (typeof globalThis.import === 'undefined') {
  globalThis.import = { meta: { env: { DEV: true, PROD: false, MODE: 'test' } } }
}

// Define import.meta globally for Jest
Object.defineProperty(globalThis, 'import', {
  value: { meta: { env: { DEV: true, PROD: false, MODE: 'test' } } },
  writable: true,
  configurable: true
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock react-leaflet components
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => children,
  TileLayer: () => null,
  Marker: ({ children }) => children,
  Popup: ({ children }) => children,
  Circle: ({ children }) => children,
  Polygon: ({ children }) => children,
  Polyline: ({ children }) => children,
  LayerGroup: ({ children }) => children,
  FeatureGroup: ({ children }) => children,
  LayersControl: ({ children }) => children,
  useMap: () => ({
    setView: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  }),
  useMapEvents: () => ({
    on: jest.fn(),
    off: jest.fn(),
  }),
  Icon: jest.fn(),
  LatLng: jest.fn().mockImplementation((lat, lng) => ({ lat, lng })),
}))

// Mock Leaflet
jest.mock('leaflet', () => ({
  Icon: jest.fn(),
  Marker: jest.fn(),
  Map: jest.fn(),
  TileLayer: jest.fn(),
  latLng: jest.fn(),
}))

// Mock @react-pdf/renderer
jest.mock('@react-pdf/renderer', () => ({
  Document: ({ children }) => children,
  Page: ({ children }) => children,
  View: ({ children }) => children,
  Text: ({ children }) => children,
  StyleSheet: { create: () => ({}) },
  pdf: jest.fn(),
}))

// Suppress console errors during tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
}
