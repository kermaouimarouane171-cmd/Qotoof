import clsx from 'clsx'

const Card = ({ children, className, hover = false, onClick, ...props }) => {
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      {...props}
      role={onClick ? 'button' : undefined}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(e) } : undefined}
      className={clsx(
        hover ? 'card-hover' : 'card',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export default Card
