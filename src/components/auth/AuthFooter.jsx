import { Link } from 'react-router-dom'

const AuthFooter = ({ question, linkTo, linkText }) => {
  if (!question && !linkTo) return null

  return (
    <p className="mt-8 text-sm text-center text-gray-500">
      {question}{' '}
      {linkTo && linkText && (
        <Link
          to={linkTo}
          className="font-semibold text-green-600 hover:text-green-700 hover:underline transition-colors"
        >
          {linkText}
        </Link>
      )}
    </p>
  )
}

export default AuthFooter
