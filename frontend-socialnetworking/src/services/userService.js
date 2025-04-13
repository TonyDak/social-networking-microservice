
import { apiPrivateClient } from './apiClient';
import { applyAuthInterceptor } from './authService';

const USER_URL = import.meta.env.VITE_API_URL + '/users'; // Replace with your actual API URL
const userClient = apiPrivateClient(USER_URL);
applyAuthInterceptor(userClient);
export const getCurrentUser = async (token) => {
    // eslint-disable-next-line no-useless-catch
    try {
        const response = await userClient.get('/me',
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data);
    }
};

export const updateUserProfile = async (token, profileData) => {
    try {
        const response = await userClient.put('/me/update', profileData, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    }
    catch (error) {
        throw new Error(error.response?.data);
    }
  };