const Badge = ({ children, variant = 'gray', className }) => {
  const variants = {
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    success: 'badge-green bg-green-100 text-green-800',
    warning: 'badge-warning',
    danger: 'badge-danger',
    gray: 'badge-gray',
  }
  
  return (
    <span className={`badge ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

export default Badge
