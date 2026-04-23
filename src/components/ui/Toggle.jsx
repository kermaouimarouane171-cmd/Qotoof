/**
 * Toggle Switch Component
 */

const Toggle = ({ checked, onChange, disabled = false, label, id }) => {
  const handleChange = (e) => {
    onChange?.(e.target.checked)
  }

  return (
    <label className="inline-flex items-center cursor-pointer" htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-100 rounded-full peer transition-all ${
          checked ? 'bg-green-500' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <div className={`absolute top-0.5 left-0.5 bg-white border-gray-300 border rounded-full h-5 w-5 transition-all ${
            checked ? 'translate-x-full' : ''
          }`} />
        </div>
      </div>
      {label && (
        <span className="ml-3 text-sm font-medium text-gray-700">{label}</span>
      )}
    </label>
  )
}

export default Toggle
