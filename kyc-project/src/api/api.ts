import axios, { AxiosError } from 'axios';
import { SignupData, LoginData } from '../types/auth';

const API_URL = 'https://kyc-back-rmgs.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handler
const handleApiError = (error: AxiosError) => {
  if (error.response) {
    console.error('API Error Response:', error.response.data);
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
  throw error;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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

// Updated submitKYC function for video file upload
export const submitKYC = async (formData: FormData) => {
  try {
    const response = await api.post('/kyc/kyc/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    handleApiError(error as AxiosError);
  }
};

export default api;
