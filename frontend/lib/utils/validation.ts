import { ValidationError } from './errorHandling'

export interface ValidationRule<T = unknown> {
  validate: (value: T) => boolean | string
  message?: string
}

// Type guard to check if a value is a string
function isString(value: unknown): value is string {
  return typeof value === 'string'
}

// Type guard to check if a value is a number or can be converted to a number
function isNumberLike(value: unknown): boolean {
  if (typeof value === 'number') return true
  if (typeof value === 'string') return !isNaN(Number(value))
  return false
}

export interface FieldValidation {
  required?: boolean
  rules?: ValidationRule<unknown>[]
}

export interface FormValidation {
  [fieldName: string]: FieldValidation
}

// Basic validation rules
export const validationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    validate: (value: unknown) => {
      if (value === null || value === undefined) return false
      if (typeof value === 'string') return value.trim().length > 0
      if (Array.isArray(value)) return value.length > 0
      return true
    },
    message
  }),

  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      if (!isString(value)) return false
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(value)
    },
    message
  }),

  phoneNumber: (message = 'Please enter a valid Singapore phone number'): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      if (!isString(value)) return false
      const phoneRegex = /^(\+65)?[689]\d{7}$/
      return phoneRegex.test(value.replace(/\s/g, ''))
    },
    message
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      if (!isString(value)) return false
      return value.length >= min
    },
    message: message || `Must be at least ${min} characters long`
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      if (!isString(value)) return false
      return value.length <= max
    },
    message: message || `Must be no more than ${max} characters long`
  }),

  pattern: (regex: RegExp, message = 'Invalid format'): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      if (!isString(value)) return false
      return regex.test(value)
    },
    message
  }),

  number: (message = 'Must be a valid number'): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      return isNumberLike(value)
    },
    message
  }),

  min: (min: number, message?: string): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      if (!isNumberLike(value)) return false
      const num = Number(value)
      return !isNaN(num) && num >= min
    },
    message: message || `Must be at least ${min}`
  }),

  max: (max: number, message?: string): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      if (!isNumberLike(value)) return false
      const num = Number(value)
      return !isNaN(num) && num <= max
    },
    message: message || `Must be no more than ${max}`
  }),

  url: (message = 'Please enter a valid URL'): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      if (!isString(value)) return false
      try {
        new URL(value)
        return true
      } catch {
        return false
      }
    },
    message
  }),

  date: (message = 'Please enter a valid date'): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      if (!isString(value)) return false
      const date = new Date(value)
      return !isNaN(date.getTime())
    },
    message
  }),

  futureDate: (message = 'Date must be in the future'): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      if (!isString(value)) return false
      const date = new Date(value)
      return !isNaN(date.getTime()) && date > new Date()
    },
    message
  }),

  pastDate: (message = 'Date must be in the past'): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      if (!isString(value)) return false
      const date = new Date(value)
      return !isNaN(date.getTime()) && date < new Date()
    },
    message
  }),

  oneOf: (options: unknown[], message?: string): ValidationRule => ({
    validate: (value: unknown) => {
      if (!value) return true // Allow empty if not required
      return options.includes(value)
    },
    message: message || `Must be one of: ${options.join(', ')}`
  }),

  custom: (validator: (value: unknown) => boolean | string, message = 'Invalid value'): ValidationRule => ({
    validate: validator,
    message
  })
}

// Validate a single field
export function validateField(value: any, validation: FieldValidation): string | null {
  // Check required
  if (validation.required) {
    const requiredRule = validationRules.required()
    const isValid = requiredRule.validate(value)
    if (!isValid) {
      return requiredRule.message || 'This field is required'
    }
  }

  // Check other rules
  if (validation.rules) {
    for (const rule of validation.rules) {
      const result = rule.validate(value)
      if (result === false) {
        return rule.message || 'Invalid value'
      }
      if (typeof result === 'string') {
        return result
      }
    }
  }

  return null
}

// Validate entire form
export function validateForm(data: Record<string, any>, validation: FormValidation): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const [fieldName, fieldValidation] of Object.entries(validation)) {
    const value = data[fieldName]
    const error = validateField(value, fieldValidation)
    if (error) {
      errors[fieldName] = error
    }
  }

  return errors
}

// Check if form has errors
export function hasFormErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0
}

// Get first error message
export function getFirstError(errors: Record<string, string>): string | null {
  const errorKeys = Object.keys(errors)
  if (errorKeys.length === 0) return null
  const firstKey = errorKeys[0]!
  return errors[firstKey] || null
}

// Specific validation schemas
export const leadValidation: FormValidation = {
  phoneNumber: {
    required: true,
    rules: [validationRules.phoneNumber()]
  },
  fullName: {
    rules: [validationRules.minLength(2), validationRules.maxLength(100)]
  },
  email: {
    rules: [validationRules.email()]
  },
  source: {
    required: true,
    rules: [validationRules.oneOf(['WhatsApp', 'Facebook', 'Instagram', 'Website', 'Referral'])]
  },
  budget: {
    rules: [validationRules.oneOf(['Under $500K', '$500K - $1M', '$1M - $2M', '$2M - $5M', 'Above $5M'])]
  },
  propertyType: {
    rules: [validationRules.oneOf(['Condo', 'HDB', 'Landed', 'Commercial'])]
  },
  timeline: {
    rules: [validationRules.oneOf(['Immediate', '1-3 months', '3-6 months', '6-12 months', 'More than 1 year'])]
  }
}

export const appointmentValidation: FormValidation = {
  leadId: {
    required: true
  },
  appointmentTime: {
    required: true,
    rules: [validationRules.date(), validationRules.futureDate()]
  },
  durationMinutes: {
    rules: [validationRules.number(), validationRules.min(15), validationRules.max(240)]
  }
}

export const wabaConfigValidation: FormValidation = {
  phoneNumber: {
    required: true,
    rules: [validationRules.phoneNumber()]
  },
  displayName: {
    required: true,
    rules: [validationRules.minLength(2), validationRules.maxLength(50)]
  },
  apiKey: {
    required: true,
    rules: [validationRules.minLength(10)]
  },
  appId: {
    required: true,
    rules: [validationRules.minLength(10)]
  }
}

export const messageValidation: FormValidation = {
  message: {
    required: true,
    rules: [validationRules.minLength(1), validationRules.maxLength(4096)]
  },
  messageType: {
    rules: [validationRules.oneOf(['text', 'template', 'media', 'interactive'])]
  }
}

export const testScenarioValidation: FormValidation = {
  name: {
    required: true,
    rules: [validationRules.minLength(3), validationRules.maxLength(100)]
  },
  description: {
    required: true,
    rules: [validationRules.minLength(10), validationRules.maxLength(500)]
  },
  difficulty: {
    required: true,
    rules: [validationRules.oneOf(['easy', 'medium', 'hard'])]
  },
  category: {
    required: true,
    rules: [validationRules.oneOf(['lead_qualification', 'appointment_booking', 'objection_handling', 'follow_up'])]
  },
  expectedOutcome: {
    required: true,
    rules: [validationRules.minLength(10), validationRules.maxLength(200)]
  }
}

// Real-time validation hook
export function useFormValidation(validation: FormValidation) {
  const validateSingleField = (fieldName: string, value: any): string | null => {
    const fieldValidation = validation[fieldName]
    if (!fieldValidation) return null
    return validateField(value, fieldValidation)
  }

  const validateAllFields = (data: Record<string, any>): Record<string, string> => {
    return validateForm(data, validation)
  }

  return {
    validateField: validateSingleField,
    validateForm: validateAllFields,
    hasErrors: hasFormErrors,
    getFirstError
  }
}

// Sanitization utilities
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .substring(0, 1000) // Limit length
}

export function sanitizePhoneNumber(phone: string): string {
  return phone
    .replace(/\D/g, '') // Remove non-digits
    .replace(/^65/, '+65') // Add country code if missing
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim()
}
