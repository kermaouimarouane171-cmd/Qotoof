import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

/**
 * Logo — unified brand component for Qotoof (قطوف).
 *
 * Renders the official tree icon (SVG) + the app name.
 * Used across all layouts: MainLayout, DashboardLayout, AuthLayout,
 * MFAVerify, ProtectedRoute footer, vendor pages.
 *
 * @param {Object} props
 * @param {string} [props.size='md']    — icon size: 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} [props.showText=true] — whether to show the "قطوف" text
 * @param {string} [props.textClass]    — extra classes for the text span
 * @param {string} [props.to='/']       — Link destination
 * @param {boolean} [props.rtlText]     — if true, show Arabic "قطوف"; else "Qotoof"
 * @param {boolean} [props.whiteBg]     — if true, icon sits on translucent white (for dark hero sections)
 * @param {string} [props.className]    — extra wrapper classes
 */
const ICON_SIZES = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-10 h-10',
  xl: 'w-11 h-11',
}

const TEXT_SIZES = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-xl',
  xl: 'text-2xl',
}

const Logo = ({
  size = 'md',
  showText = true,
  textClass = '',
  to = '/',
  rtlText = true,
  whiteBg = false,
  className = '',
  ...rest
}) => {
  const { i18n } = useTranslation()
  const isArabic = i18n.language === 'ar'
  const displayName = rtlText && isArabic ? 'قطوف' : 'Qotoof'

  const iconClass = ICON_SIZES[size] || ICON_SIZES.md
  const textClass_ = TEXT_SIZES[size] || TEXT_SIZES.md

  const wrapperClass = whiteBg
    ? `${iconClass} bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg overflow-hidden`
    : `${iconClass} rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-green-500/20`

  return (
    <Link to={to} className={`flex items-center gap-2.5 flex-shrink-0 ${className}`} {...rest}>
      <div className={wrapperClass}>
        <img
          src="/icon-192x192.png"
          alt="Qotoof"
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
      </div>
      {showText && (
        <span className={`font-bold ${textClass_} ${textClass}`}>
          {displayName}
        </span>
      )}
    </Link>
  )
}

export default Logo
