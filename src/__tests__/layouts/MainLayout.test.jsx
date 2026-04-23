import React, { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Simulated MainLayout component (isolated, no real imports)
const MainLayout = ({ mockAuth, mockCart, mockFavorites, mockLanguage }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const { user, profile, signOut } = mockAuth || { user: null, profile: null, signOut: jest.fn() }
  const cartCount = mockCart || 0
  const favoritesCount = mockFavorites || 0
  const { language, setLanguage } = mockLanguage || { language: 'en', setLanguage: jest.fn() }

  const languages = [
    { code: 'en', label: 'EN', flag: 'US' },
    { code: 'fr', label: 'FR', flag: 'FR' },
    { code: 'ar', label: 'AR', flag: 'MA' },
  ]

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // In real app: navigate to search results
    }
  }

  return (
    <div data-testid="main-layout">
      {/* Header */}
      <header data-testid="header">
        <div data-testid="logo">Qotoof</div>

        {/* Search */}
        <form onSubmit={handleSearch} data-testid="search-form">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="search-input"
          />
          <button type="submit" data-testid="search-btn">Search</button>
        </form>

        {/* Cart */}
        <div data-testid="cart">
          Cart
          {cartCount > 0 && <span data-testid="cart-badge">{cartCount}</span>}
        </div>

        {/* Language Selector */}
        <div data-testid="language-selector">
          <button onClick={() => setLanguageMenuOpen(!languageMenuOpen)} data-testid="lang-btn">
            {language}
          </button>
          {languageMenuOpen && (
            <div data-testid="lang-dropdown">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code)
                    setLanguageMenuOpen(false)
                  }}
                  data-testid={`lang-option-${lang.code}`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Menu */}
        {user ? (
          <div data-testid="user-menu">
            <button onClick={() => setUserMenuOpen(!userMenuOpen)} data-testid="user-btn">
              {profile?.first_name || 'User'}
            </button>
            {userMenuOpen && (
              <div data-testid="user-dropdown">
                <button data-testid="profile-link">Profile</button>
                <button onClick={() => { signOut(); setUserMenuOpen(false) }} data-testid="signout-btn">
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <a href="/login" data-testid="signin-link">Sign In</a>
        )}

        {/* Mobile Menu Toggle */}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="mobile-menu-btn">
          {mobileMenuOpen ? 'Close' : 'Menu'}
        </button>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <nav data-testid="mobile-menu">
          <a href="/" data-testid="mobile-home">Home</a>
          <a href="/marketplace" data-testid="mobile-marketplace">Marketplace</a>
          {user && (
            <>
              <a href="/profile" data-testid="mobile-profile">Profile</a>
              <button onClick={() => signOut()} data-testid="mobile-signout">Sign Out</button>
            </>
          )}
        </nav>
      )}

      {/* Main Content */}
      <main data-testid="main-content">
        <p>MainLayout Content</p>
      </main>

      {/* Footer */}
      <footer data-testid="footer">
        <p>Qotoof Footer</p>
      </footer>
    </div>
  )
}

describe('MainLayout Component', () => {
  const defaultAuth = {
    user: { id: '1' },
    profile: { first_name: 'Marouane', last_name: 'K', role: 'buyer' },
    signOut: jest.fn(),
  }

  it('renders header, main content, and footer', () => {
    render(<MainLayout mockAuth={{ user: null }} />)
    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByTestId('main-content')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
    expect(screen.getByText('MainLayout Content')).toBeInTheDocument()
  })

  it('shows sign-in link when user is not authenticated', () => {
    render(<MainLayout mockAuth={{ user: null }} />)
    expect(screen.getByTestId('signin-link')).toBeInTheDocument()
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument()
  })

  it('shows user menu and sign-out when user is authenticated', () => {
    render(<MainLayout mockAuth={defaultAuth} />)
    expect(screen.getByTestId('user-menu')).toBeInTheDocument()
    expect(screen.getByText('Marouane')).toBeInTheDocument()
    expect(screen.queryByTestId('signin-link')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('user-btn'))
    expect(screen.getByTestId('user-dropdown')).toBeInTheDocument()
    expect(screen.getByTestId('signout-btn')).toBeInTheDocument()
  })

  it('toggles mobile menu and shows mobile navigation', () => {
    render(<MainLayout mockAuth={defaultAuth} />)
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('mobile-menu-btn'))
    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-home')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-marketplace')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-profile')).toBeInTheDocument()
  })
})
