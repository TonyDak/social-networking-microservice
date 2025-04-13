
import { 
    apiPublicClient,
    apiPrivateClient, 
    setCookie, 
    getCookie, 
    removeCookie,
  } from './apiClient';

const AUTH_URL = import.meta.env.VITE_API_URL + '/auth'; // Replace with your actual API URL

const publicClient = apiPublicClient(AUTH_URL);
const authClient = apiPrivateClient(AUTH_URL);

// Add interceptor for token refresh
export const applyAuthInterceptor = (axiosInstance) => {
    // Trả về interceptor ID nếu cần remove sau này
    return axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const newToken = await refreshToken();
            // Set new token to request headers
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return axiosInstance(originalRequest);
          } catch (refreshError) {
            logout();
            return Promise.reject(refreshError);
          }
        }
  
        return Promise.reject(error);
      }
    );
  };

applyAuthInterceptor(authClient);
// Auth functions
export const login = async (email, password) => {
    try {
        const response = await publicClient.post('/login', { email, password });
        const { access_token } = response.data;
        const { refresh_token } = response.data;
        setCookie('access_token', access_token);
        setCookie('refresh_token', refresh_token, 60 * 24 * 7); // 7 days
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data);
    }
};

export const register = async (formData) => {
    try {
        let formattedDate = null;
        if (formData.dateOfBirth) {
            // Parse chuỗi yyyy-MM-dd
            const parts = formData.dateOfBirth.split('-');
            if (parts.length === 3) {
                // Tạo định dạng dd/MM/yyyy
                formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }
        const response = await publicClient.post('/register', {
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            password: formData.password,
            gender: formData.gender,
            dateOfBirth: formattedDate,
            phoneNumber: formData.phoneNumber,    
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data);
    }
};

export const logout = () => {
    publicClient.get('/logout-user?refreshToken=' + getCookie('refresh_token'));
    removeCookie('access_token');
    removeCookie('refresh_token');
    window.location.href = '/login';
};

export const refreshToken = async () => {
    try {
        const refresh_token = getCookie('refresh_token');
        if (!refresh_token) {
            throw new Error('No refresh token available');
        }
     
        const response = await publicClient.post('/refresh', null, {
            params: {
                refreshToken: refresh_token
            }
        });
        if (response.status !== 200) {
            throw new Error('Failed to refresh token');
        }

        const { access_token, refresh_token: new_refresh_token } = response.data;
        setCookie('access_token', access_token);
        setCookie('refresh_token', new_refresh_token, 60 * 24 * 7); // 7 days
        
        return access_token;
    } catch (error) {
        // Xóa tokens khi refresh thất bại
        removeCookie('access_token');
        removeCookie('refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
    }
};


export const forgotPassword = async (email) => {
    try {
        const response = await publicClient.post('/forgot-password', { email });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data);
    }
};

export const loginWithGoogle = async () => {
    try {
        // Lấy URL redirect từ backend
        const response = await publicClient.get('/google-login-url');
        
        // Chuyển hướng đến URL Keycloak
        window.location.href = response.data.authUrl;
    } catch (error) {
        console.error('Google login error:', error);
        throw error;
    }
};

// Sửa lại hàm processGoogleLogin trong authService.js
export const processGoogleLogin = async (code) => {
    try {
        // Gửi code đến backend để đổi lấy token
        const response = await publicClient.get(
            `/google-redirect?code=${code}&redirect_uri=${encodeURIComponent(window.location.origin + '/auth/callback')}`
        );

        // Xử lý response từ backend
        const { access_token, refresh_token } = response.data;

        // Lưu tokens vào cookies với các thiết lập bảo mật
        setCookie('access_token', access_token, {
            path: '/',
            secure: true,
            sameSite: 'strict'
        });

        setCookie('refresh_token', refresh_token, {
            path: '/',
            secure: true,
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7 // 7 ngày
        });

        return response.data;
    } catch (error) {
        removeCookie('access_token');
        removeCookie('refresh_token');
        throw new Error(error.response.data);
    }
};

