import axios, { AxiosError } from 'axios';
import { SignupData, LoginData } from '../types/auth';
import { toast } from 'react-hot-toast';

// Define a type for KYC response
type KYCResponse = {
  success: boolean;
  message?: string;
  data?: any;
};

const API_URL = 'https://kyc-back-rmgs.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handler
const handleApiError = (error: AxiosError): KYCResponse => {
  if (error.response) {
    console.error('API Error Response:', error.response.data);
    
    // Specific error handling for KYC submission
    if (error.config?.url?.includes('/kyc/kyc/')) {
      // Type-safe error data extraction
      const errorData = error.response.data as Record<string, any>;
      const errorMessage = errorData.message || 'KYC verification failed';
      
      toast.error(errorMessage);
      return { 
        success: false, 
        message: errorMessage 
      };
    }

    switch (error.response.status) {
      case 400:
        throw new Error(JSON.stringify(error.response.data));
      case 401:
        localStorage.removeItem('token');
        window.location.href = '/login';
        break;
      default:
        throw new Error('An error occurred. Please try again.');
    }
  }
  
  // Fallback error response
  return { 
    success: false, 
    message: 'An unexpected error occurred' 
  };
};

// Interceptor to add Authorization header only for authenticated requests
api.interceptors.request.use((config) => {
  // Check if the request is for a signup or login
  if (!config.url?.includes('auth/signup') && !config.url?.includes('auth/login')) {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const signup = async (data: SignupData) => {
  try {
    const response = await api.post('/auth/signup/', data);
    return response.data;
  } catch (error) {
    handleApiError(error as AxiosError);
  }
};

export const login = async (data: LoginData) => {
  try {
    const response = await api.post('/auth/login/', data);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  } catch (error) {
    handleApiError(error as AxiosError);
  }
};

// Updated submitKYC function with comprehensive error handling
export const submitKYC = async (formData: FormData): Promise<KYCResponse> => {
  try {
    const response = await api.post('/kyc/kyc/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // Handle successful response
    return {
      success: true,
      data: response.data,
      message: response.data.message || 'KYC verification successful'
    };
  } catch (error) {
    // Use the error handler, which will return a specific error response for KYC
    return handleApiError(error as AxiosError);
  }
};

export default api;
