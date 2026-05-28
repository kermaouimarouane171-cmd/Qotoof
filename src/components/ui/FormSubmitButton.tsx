import Button from '@/components/ui/Button'

const FormSubmitButton = ({
  form,
  children,
  disabled = false,
  isLoading = false,
  ...props
}) => {
  const submitting = Boolean(form?.formState?.isSubmitting)

  return (
    <Button
      type="submit"
      isLoading={isLoading || submitting}
      disabled={disabled || submitting}
      {...props}
    >
      {children}
    </Button>
  )
}

export default FormSubmitButton
