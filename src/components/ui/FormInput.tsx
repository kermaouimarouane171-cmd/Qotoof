import Input from '@/components/ui/Input'

const resolveFieldError = (errors, fieldName) => {
  if (!errors || !fieldName) return ''

  const parts = String(fieldName).split('.')
  let current = errors

  for (const part of parts) {
    current = current?.[part]
    if (!current) return ''
  }

  return current?.message || ''
}

const FormInput = ({
  form,
  name,
  label,
  type = 'text',
  required,
  ...inputProps
}) => {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <Input
      label={label}
      type={type}
      required={required}
      error={resolveFieldError(errors, name)}
      {...register(name)}
      {...inputProps}
    />
  )
}

export default FormInput
