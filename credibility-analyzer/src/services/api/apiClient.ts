import axios from 'axios';
import type { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { config } from '@/constants';
import type { APIError } from '@/types';
import { ERROR_MESSAGES } from '@/types/api.types';

/**
 * Creates a configured Axios instance with error handling interceptors
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: config.apiBaseUrl,
    timeout: config.apiTimeout,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Response interceptor for centralized error handling
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError<APIError>) => {
      // Handle request cancellation
      if (axios.isCancel(error)) {
        return Promise.reject({
          code: 'CANCELLED',
          message: ERROR_MESSAGES.ANALYSIS_ABORTED,
        });
      }

      // Handle server error responses
      if (error.response) {
        const apiError = error.response.data;
        return Promise.reject({
          code: apiError?.code || `HTTP_${error.response.status}`,
          message: apiError?.message || error.message,
          suggestedAction: apiError?.suggestedAction,
        });
      }

      // Handle timeout errors
      if (error.code === 'ECONNABORTED') {
        return Promise.reject({
          code: 'TIMEOUT',
          message: ERROR_MESSAGES.NETWORK_TIMEOUT,
          suggestedAction: 'Check your internet connection and try again.',
        });
      }

      // Handle network errors (no response received)
      return Promise.reject({
        code: 'NETWORK',
        message: ERROR_MESSAGES.CONNECTION_ERROR,
        suggestedAction: 'Please check your internet connection.',
      });
    }
  );

  return client;
};

export const apiClient = createApiClient();

/**
 * Creates an AbortController for request cancellation
 * @returns AbortController instance
 */
export const createAbortController = (): AbortController => {
  return new AbortController();
};

/**
 * Makes a GET request with optional abort signal
 */
export const get = async <T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  const response = await apiClient.get<T>(url, config);
  return response.data;
};

/**
 * Makes a POST request with optional abort signal
 */
export const post = async <T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<T> => {
  const response = await apiClient.post<T>(url, data, config);
  return response.data;
};
