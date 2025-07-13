import { toast } from 'sonner'

export interface ApiError {
  message: string
  code?: string
  status?: number
  details?: any
}

export class AppError extends Error {
  public readonly code: string
  public readonly status: number
  public readonly details?: any

  constructor(message: string, code = 'UNKNOWN_ERROR', status = 500, details?: any) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403)
    this.name = 'AuthorizationError'
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network error occurred') {
    super(message, 'NETWORK_ERROR', 0)
    this.name = 'NetworkError'
  }
}

export class WABAError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'WABA_ERROR', 500, details)
    this.name = 'WABAError'
  }
}

export class IntegrationError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(`${service} integration error: ${message}`, 'INTEGRATION_ERROR', 500, details)
    this.name = 'IntegrationError'
  }
}

// Error handling utilities
export function handleApiError(error: any): AppError {
  // Handle Axios errors
  if (error.response) {
    const { status, data } = error.response
    const message = data?.error || data?.message || 'An error occurred'
    const code = data?.code || `HTTP_${status}`
    return new AppError(message, code, status, data)
  }

  // Handle network errors
  if (error.request) {
    return new NetworkError('Unable to connect to server')
  }

  // Handle custom app errors
  if (error instanceof AppError) {
    return error
  }

  // Handle generic errors
  return new AppError(error.message || 'An unexpected error occurred')
}

export function getErrorMessage(error: any): string {
  if (error instanceof AppError) {
    return error.message
  }

  if (error?.response?.data?.error) {
    return error.response.data.error
  }

  if (error?.response?.data?.message) {
    return error.response.data.message
  }

  if (error?.message) {
    return error.message
  }

  return 'An unexpected error occurred'
}

export function showErrorToast(error: any, title = 'Error') {
  const message = getErrorMessage(error)
  
  toast.error(title, {
    description: message,
    duration: 5000,
  })
}

export function showSuccessToast(title: string, description?: string) {
  toast.success(title, {
    description,
    duration: 3000,
  })
}

export function showWarningToast(title: string, description?: string) {
  toast.warning(title, {
    description,
    duration: 4000,
  })
}

export function showInfoToast(title: string, description?: string) {
  toast.info(title, {
    description,
    duration: 3000,
  })
}

// Retry utilities
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (attempt === maxRetries) {
        break
      }

      // Don't retry on authentication/authorization errors
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        break
      }

      // Don't retry on validation errors
      if (error instanceof ValidationError) {
        break
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt))
    }
  }

  throw lastError
}

// Form validation utilities
export function validateRequired(value: any, fieldName: string): void {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new ValidationError(`${fieldName} is required`)
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new ValidationError('Please enter a valid email address')
  }
}

export function validatePhoneNumber(phone: string): void {
  // Singapore phone number validation
  const phoneRegex = /^(\+65)?[689]\d{7}$/
  if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
    throw new ValidationError('Please enter a valid Singapore phone number')
  }
}

export function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long')
  }
  
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    throw new ValidationError('Password must contain at least one uppercase letter, one lowercase letter, and one number')
  }
}

// Connection status utilities
export function isOnline(): boolean {
  return navigator.onLine
}

export function onConnectionChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

// Error boundary utilities
export function logError(error: any, context?: string) {
  console.error(`[${context || 'App'}] Error:`, error)
  
  // In production, you might want to send this to an error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Example: Sentry.captureException(error, { tags: { context } })
  }
}

export function createErrorBoundaryHandler(context: string) {
  return (error: any, errorInfo: any) => {
    logError(error, context)
    
    // Show user-friendly error message
    showErrorToast(error, 'Something went wrong')
  }
}

// Multi-tenant error handling
export function handleMultiTenantError(error: any, agentId?: string): AppError {
  const appError = handleApiError(error)
  
  // Add agent context to error
  if (agentId) {
    appError.details = {
      ...appError.details,
      agentId,
      timestamp: new Date().toISOString()
    }
  }
  
  // Handle specific multi-tenant errors
  if (appError.code === 'AGENT_ACCESS_DENIED') {
    return new AuthorizationError('You can only access your own data')
  }
  
  if (appError.code === 'WABA_NOT_CONFIGURED') {
    return new WABAError('WhatsApp Business API is not configured for this agent')
  }
  
  return appError
}

// WABA specific error handling
export function handleWABAError(error: any): WABAError {
  const message = getErrorMessage(error)
  
  if (message.includes('invalid credentials')) {
    return new WABAError('Invalid WABA credentials. Please check your API key and App ID.')
  }
  
  if (message.includes('rate limit')) {
    return new WABAError('WABA rate limit exceeded. Please try again later.')
  }
  
  if (message.includes('template not approved')) {
    return new WABAError('Message template is not approved. Please use an approved template.')
  }
  
  return new WABAError(message)
}
