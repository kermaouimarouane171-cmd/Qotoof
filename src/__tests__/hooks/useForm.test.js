import { useState, useCallback } from 'react'
import { renderHook, act } from '@testing-library/react'

// Simulated useForm hook (isolated, no real imports)
const useForm = (initialValues = {}, validationSchema = null) => {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reset = useCallback((newValues = initialValues) => {
    setValues(newValues)
    setErrors({})
    setTouched({})
    setIsSubmitting(false)
  }, [initialValues])

  const setValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const setError = useCallback((name, error) => {
    setErrors(prev => ({ ...prev, [name]: error }))
  }, [])

  const touch = useCallback((name) => {
    setTouched(prev => ({ ...prev, [name]: true }))
  }, [])

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    const finalValue = type === 'checkbox' ? checked : value
    setValues(prev => ({ ...prev, [name]: finalValue }))
    setTouched(prev => ({ ...prev, [name]: true }))
  }, [])

  const validate = useCallback(() => {
    if (!validationSchema) return true
    try {
      validationSchema.parse(values)
      setErrors({})
      return true
    } catch (error) {
      if (error.errors) {
        const newErrors = {}
        error.errors.forEach(err => {
          newErrors[err.path.join('.')] = err.message
        })
        setErrors(newErrors)
      }
      return false
    }
  }, [values, validationSchema])

  const handleSubmit = useCallback(async (onSubmit) => {
    if (!validate()) return false
    setIsSubmitting(true)
    try {
      await onSubmit(values)
      return true
    } catch (error) {
      setErrors({ form: error.message || 'Submission failed' })
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [values, validate])

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setValue,
    setError,
    touch,
    handleChange,
    handleSubmit,
    reset,
    validate,
  }
}

describe('useForm Hook', () => {
  it('should initialize with given values and empty errors/touched', () => {
    const initialValues = { name: '', email: '' }
    const { result } = renderHook(() => useForm(initialValues))

    expect(result.current.values).toEqual(initialValues)
    expect(result.current.errors).toEqual({})
    expect(result.current.touched).toEqual({})
    expect(result.current.isSubmitting).toBe(false)
  })

  it('should update field values via setValue and handleChange', () => {
    const { result } = renderHook(() => useForm({ name: '', email: '' }))

    act(() => {
      result.current.setValue('name', 'John')
    })
    expect(result.current.values.name).toBe('John')

    act(() => {
      result.current.handleChange({ target: { name: 'email', value: 'john@test.com' } })
    })
    expect(result.current.values.email).toBe('john@test.com')
    expect(result.current.touched.email).toBe(true)
  })

  it('should handle checkbox inputs via handleChange', () => {
    const { result } = renderHook(() => useForm({ agree: false }))

    act(() => {
      result.current.handleChange({ target: { name: 'agree', type: 'checkbox', checked: true } })
    })
    expect(result.current.values.agree).toBe(true)
    expect(result.current.touched.agree).toBe(true)
  })

  it('should reset form to initial values and clear errors/touched', () => {
    const initialValues = { name: 'Initial', email: '' }
    const { result } = renderHook(() => useForm(initialValues))

    act(() => {
      result.current.setValue('name', 'Changed')
      result.current.setError('name', 'Required')
      result.current.touch('name')
    })
    expect(result.current.values.name).toBe('Changed')
    expect(result.current.errors.name).toBe('Required')
    expect(result.current.touched.name).toBe(true)

    act(() => {
      result.current.reset()
    })
    expect(result.current.values).toEqual(initialValues)
    expect(result.current.errors).toEqual({})
    expect(result.current.touched).toEqual({})
    expect(result.current.isSubmitting).toBe(false)
  })
})
