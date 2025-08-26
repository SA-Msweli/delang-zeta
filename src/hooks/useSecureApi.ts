import { useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../config/api'
import { toast } from 'react-hot-toast'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'

export function useSecureApi() {
  const { isAuthenticated, logout } = useAuth()

  const makeRequest = useCallback(async <T = any>(
    requestFn: () => Promise<AxiosResponse<T>>,
    requireAuth = true
  ): Promise<T | null> => {
    if (requireAuth && !isAuthenticated) {
      toast.error('Please authenticate first')
      return null
    }

    try {
      const response = await requestFn()
      return response.data
    } catch (error: any) {
      // Handle specific error cases
      if (error.response?.status === 401) {
        logout()
        return null
      }

      throw error
    }
  }, [isAuthenticated, logout])

  // API client methods
  const get = useCallback(async <T = any>(
    url: string,
    config?: AxiosRequestConfig,
    requireAuth = true
  ): Promise<T | null> => {
    return makeRequest(() => apiClient.get<T>(url, config), requireAuth)
  }, [makeRequest])

  const post = useCallback(async <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
    requireAuth = true
  ): Promise<T | null> => {
    return makeRequest(() => apiClient.post<T>(url, data, config), requireAuth)
  }, [makeRequest])

  const put = useCallback(async <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
    requireAuth = true
  ): Promise<T | null> => {
    return makeRequest(() => apiClient.put<T>(url, data, config), requireAuth)
  }, [makeRequest])

  const patch = useCallback(async <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
    requireAuth = true
  ): Promise<T | null> => {
    return makeRequest(() => apiClient.patch<T>(url, data, config), requireAuth)
  }, [makeRequest])

  const del = useCallback(async <T = any>(
    url: string,
    config?: AxiosRequestConfig,
    requireAuth = true
  ): Promise<T | null> => {
    return makeRequest(() => apiClient.delete<T>(url, config), requireAuth)
  }, [makeRequest])

  return {
    // API methods (all pointing to Cloud Functions)
    get,
    post,
    put,
    patch,
    delete: del,

    // Utility
    isAuthenticated
  }
}