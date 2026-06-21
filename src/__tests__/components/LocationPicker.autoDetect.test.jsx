import { render, screen, fireEvent } from '@testing-library/react'
import LocationPicker from '@/components/ui/LocationPicker'

const mockGeolocation = {
  getCurrentPosition: jest.fn(),
}

const mockMap = () => null

jest.mock('@/components/ui/Map', () => ({
  __esModule: true,
  default: function MapMock() {
    return <div data-testid="map">Map</div>
  },
}))

describe('LocationPicker auto-detect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.navigator.geolocation = mockGeolocation
  })

  afterEach(() => {
    delete global.navigator.geolocation
  })

  it('does not call getCurrentPosition on mount when autoDetect is not enabled', () => {
    render(<LocationPicker value={{}} onChange={jest.fn()} />)
    expect(mockGeolocation.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('calls getCurrentPosition when the GPS button is clicked', () => {
    render(<LocationPicker value={{}} onChange={jest.fn()} />)
    const button = screen.getByTestId('location-detect-btn')
    fireEvent.click(button)
    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('does not call getCurrentPosition on mount even when autoDetect is false', () => {
    render(<LocationPicker value={{}} onChange={jest.fn()} autoDetect={false} />)
    expect(mockGeolocation.getCurrentPosition).not.toHaveBeenCalled()
  })
})
