import { apiClient } from '@/lib/api/client'
import { User } from './AuthContext'

export interface LoginResponse {
  token: string
  user: User
  expires_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

class AuthApi {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post('/frontend-auth/login', { email, password })
    return response.data
  }

  async logout(): Promise<void> {
    await apiClient.post('/frontend-auth/logout')
  }

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get('/frontend-auth/me')
    return response.data.data
  }

  async refreshToken(): Promise<LoginResponse> {
    const response = await apiClient.post('/frontend-auth/refresh')
    return response.data
  }

  async requestPasswordReset(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email })
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password })
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/frontend-auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword
    })
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiClient.patch('/frontend-auth/profile', data)
    return response.data.data
  }

  // OAuth integration endpoints
  async initiateGoogleAuth(agentId: string): Promise<{ auth_url: string }> {
    const response = await apiClient.get(`/auth/google?agentId=${agentId}`)
    return response.data
  }

  async initiateZoomAuth(agentId: string): Promise<{ auth_url: string }> {
    const response = await apiClient.get(`/auth/zoom?agentId=${agentId}`)
    return response.data
  }

  async getOAuthStatus(agentId: string): Promise<{
    google_connected: boolean
    zoom_connected: boolean
    google_email?: string
    zoom_user_id?: string
  }> {
    const response = await apiClient.get(`/auth/oauth-status/${agentId}`)
    return response.data
  }
}

export const authApi = new AuthApi()
