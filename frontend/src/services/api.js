import axios from 'axios';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 30000, // 30 seconds timeout for file uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post('/api/auth/refresh', { refreshToken });

          const { token, refreshToken: newRefreshToken } = response.data.data;

          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', newRefreshToken);

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API service functions
export const authAPI = {
  // Authentication endpoints
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (userData) => api.post('/api/auth/register', userData),
  refreshToken: (refreshToken) => api.post('/api/auth/refresh', { refreshToken }),
  logout: () => api.post('/api/auth/logout'),
  getMe: () => api.get('/api/auth/me'),
  updateProfile: (updates) => api.put('/api/auth/profile', updates),
  changePassword: (passwords) => api.put('/api/auth/change-password', passwords),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (data) => api.put('/api/auth/reset-password', data),
};

export const imageAPI = {
  // Image processing endpoints
  uploadImage: (formData) => {
    return api.post('/api/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // Longer timeout for uploads
    });
  },
  resizeImage: (data) => api.post('/api/images/resize', data),
  compressImage: (data) => api.post('/api/images/compress', data),
  enhanceImage: (data) => api.post('/api/images/enhance', data),
  removeBackground: (data) => api.post('/api/images/remove-background', data),
  getImage: (id) => api.get(`/api/images/${id}`),
  deleteImage: (id) => api.delete(`/api/images/${id}`),
};

export const documentAPI = {
  // Document conversion endpoints
  uploadDocument: (formData) => {
    return api.post('/api/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },
  textToDoc: (data) => api.post('/api/documents/convert/text-to-doc', data),
  textToPdf: (data) => api.post('/api/documents/convert/text-to-pdf', data),
  textToExcel: (data) => api.post('/api/documents/convert/text-to-excel', data),
  excelToCsv: (data) => api.post('/api/documents/convert/excel-to-csv', data),
  getDocument: (id) => api.get(`/api/documents/${id}`),
  downloadDocument: (id) => api.get(`/api/documents/${id}/download`, { responseType: 'blob' }),
  deleteDocument: (id) => api.delete(`/api/documents/${id}`),
};

export const aiAPI = {
  // AI-powered endpoints
  imageToText: (data) => api.post('/api/ai/image-to-text', data),
  textToImage: (data) => api.post('/api/ai/text-to-image', data),
  analyzeImage: (data) => api.post('/api/ai/image-analysis', data),
  enhanceText: (data) => api.post('/api/ai/text-enhancement', data),
  summarizeContent: (data) => api.post('/api/ai/content-summarization', data),
  getAIModels: () => api.get('/api/ai/models'),
};

export const videoAPI = {
  // Video download endpoints
  downloadYouTube: (data) => api.post('/api/videos/download/youtube', data),
  downloadInstagram: (data) => api.post('/api/videos/download/instagram', data),
  downloadFacebook: (data) => api.post('/api/videos/download/facebook', data),
  getVideoInfo: (data) => api.post('/api/videos/info', data),
  downloadVideo: (platform, id) => api.get(`/api/videos/download/${platform}/${id}`, { responseType: 'blob' }),
  batchDownload: (data) => api.post('/api/videos/batch-download', data),
};

export const toolsAPI = {
  // Creative tools endpoints
  generateSignature: (data) => api.post('/api/tools/signature-maker', data),
  generatePassportPhoto: (data) => api.post('/api/tools/passport-photo-maker', data),
  generateIDPhoto: (data) => api.post('/api/tools/id-photo-maker', data),
  resizePhoto: (data) => api.post('/api/tools/photo-resizer', data),
  generateQRCode: (data) => api.post('/api/tools/qr-generator', data),
  generateMeme: (data) => api.post('/api/tools/meme-generator', data),
  getTemplates: (category) => api.get(`/api/tools/templates${category ? `?category=${category}` : ''}`),
};

export const adminAPI = {
  // Admin endpoints
  getDashboard: () => api.get('/api/admin/dashboard'),
  getUsers: (params) => api.get('/api/admin/users', { params }),
  updateUser: (id, data) => api.put(`/api/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/api/admin/users/${id}`),
  getFiles: (params) => api.get('/api/admin/files', { params }),
  deleteFile: (id) => api.delete(`/api/admin/files/${id}`),
  getPayments: (params) => api.get('/api/admin/payments', { params }),
  getAnalytics: (params) => api.get('/api/admin/analytics', { params }),
};

// File upload helper
export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('document', file);

  return documentAPI.uploadDocument(formData);
};

// Image upload helper
export const uploadImageFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('image', file);

  return imageAPI.uploadImage(formData);
};

export default api;