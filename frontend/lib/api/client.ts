import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios'
import { toast } from 'sonner'
import { handleApiError, AuthenticationError, NetworkError, showErrorToast } from '@/lib/utils/errorHandling'

// Environment-based API configuration
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use environment variable or detect from window location
    return process.env.NEXT_PUBLIC_API_URL ||
           (window.location.hostname === 'localhost'
             ? 'http://localhost:8080'
             : `${window.location.protocol}//${window.location.hostname}:8080`)
  }
  // Server-side: use environment variable or default
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
}

const API_BASE_URL = getApiBaseUrl()

interface ApiError {
  message: string
  status?: number
  code?: string
}

class ApiClient {
  private client: AxiosInstance
  private refreshPromise: Promise<string> | null = null

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: false,
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor to add auth token and request ID
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token
        const token = localStorage.getItem('auth_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // Add request ID for tracing
        config.headers['X-Request-ID'] = crypto.randomUUID()

        // Add timestamp
        config.headers['X-Request-Time'] = new Date().toISOString()

        return config
      },
      (error) => {
        return Promise.reject(this.normalizeError(error))
      }
    )

    // Response interceptor for error handling and token refresh
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log successful responses in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            data: response.data,
          })
        }
        return response
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

        // Handle 401 errors (unauthorized) with token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            // Prevent multiple refresh requests
            if (!this.refreshPromise) {
              this.refreshPromise = this.refreshToken()
            }

            const newToken = await this.refreshPromise
            this.refreshPromise = null

            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              return this.client(originalRequest)
            }
          } catch (refreshError) {
            this.refreshPromise = null
            this.handleAuthFailure()
            return Promise.reject(this.normalizeError(refreshError as AxiosError))
          }
        }

        // Handle network errors
        if (!error.response) {
          const networkError = this.createNetworkError(error)
          this.showErrorToast(networkError, originalRequest)
          return Promise.reject(networkError)
        }

        // Handle other errors
        const normalizedError = this.normalizeError(error)
        this.showErrorToast(normalizedError, originalRequest)

        return Promise.reject(normalizedError)
      }
    )
  }

  private async refreshToken(): Promise<string> {
    try {
      const response = await this.client.post('/frontend-auth/refresh')
      const newToken = response.data.token
      localStorage.setItem('auth_token', newToken)
      return newToken
    } catch (error) {
      throw error
    }
  }

  private handleAuthFailure(): void {
    localStorage.removeItem('auth_token')

    // Only redirect if we're in the browser and not already on login page
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
      window.location.href = '/auth/login'
    }
  }

  private normalizeError(error: AxiosError): ApiError {
    // Use the enhanced error handling utility
    const appError = handleApiError(error)

    return {
      message: appError.message,
      status: appError.status,
      code: appError.code,
      details: appError.details,
    }
  }

  private createNetworkError(error: AxiosError): ApiError {
    return {
      message: 'Network error. Please check your connection and try again.',
      code: 'NETWORK_ERROR',
    }
  }

  private showErrorToast(error: ApiError, originalRequest?: AxiosRequestConfig): void {
    // Don't show toast for certain endpoints
    const silentEndpoints = ['/auth/me', '/auth/refresh', '/frontend-auth/refresh']
    const isSilentEndpoint = silentEndpoints.some(endpoint =>
      originalRequest?.url?.includes(endpoint)
    )

    if (!isSilentEndpoint && error.status && error.status >= 400) {
      toast.error(error.message, {
        id: `error-${error.status}-${originalRequest?.url}`, // Prevent duplicate toasts
      })
    }
  }

  private getErrorMessage(error: AxiosError): string {
    const response = error.response

    // Try to get message from response data
    if (response?.data && typeof response.data === 'object') {
      const data = response.data as any
      if (data.message) return data.message
      if (data.error) return data.error
      if (data.detail) return data.detail
    }

    // Fallback to status-based messages
    switch (response?.status) {
      case 400:
        return 'Bad request. Please check your input.'
      case 401:
        return 'Authentication required. Please log in.'
      case 403:
        return 'Access denied. You don\'t have permission for this action.'
      case 404:
        return 'Resource not found.'
      case 409:
        return 'Conflict. The resource already exists or is in use.'
      case 422:
        return 'Validation error. Please check your input.'
      case 429:
        return 'Too many requests. Please try again later.'
      case 500:
        return 'Server error. Please try again later.'
      case 502:
        return 'Bad gateway. The server is temporarily unavailable.'
      case 503:
        return 'Service unavailable. Please try again later.'
      case 504:
        return 'Gateway timeout. The request took too long to process.'
      default:
        return error.message || 'An unexpected error occurred.'
    }
  }

  // HTTP methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get(url, config)
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post(url, data, config)
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put(url, data, config)
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch(url, data, config)
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete(url, config)
  }

  // File upload helper
  async uploadFile(url: string, file: File, onProgress?: (progress: number) => void): Promise<AxiosResponse> {
    const formData = new FormData()
    formData.append('file', file)

    return this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    })
  }
}

export const apiClient = new ApiClient()
