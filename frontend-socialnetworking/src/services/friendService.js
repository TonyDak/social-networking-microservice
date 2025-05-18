import { apiPrivateClient, getCookie } from './apiClient';
import { applyAuthInterceptor } from './authService';

const FRIEND_URL = import.meta.env.VITE_API_URL + '/friends';
const USER_URL = import.meta.env.VITE_API_URL + '/users';

const friendClient = apiPrivateClient(FRIEND_URL);
const userClient = apiPrivateClient(USER_URL);
const token = getCookie('access_token');
applyAuthInterceptor(friendClient);
applyAuthInterceptor(userClient);
/**
 * Get user's friends list with pagination
 * @param {string} userId - User ID
 * @param {number} page - Page number (default: 0)
 * @param {number} size - Page size (default: 20)
 * @returns {Promise} - Promise with paginated friends list
 */
export const getFriendsList = async (userId, page = 0, size = 20) => {
  try {
    const response = await friendClient.get(`/`, {
      params: {
        page,
        size
      },
      headers: {
        'X-User-ID': userId,
        'Authorization': `Bearer ${token}`,
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching friends list:', error);
    throw error;
  }
};

/**
 * Send friend request to user
 * @param {string} senderId - Current user ID
 * @param {string} receiverId - User to send request to
 * 
 */
export const sendFriendRequest = async (senderId, receiverId) => {
  try {
    //form data
    const formData = new FormData();
    formData.append('senderId', senderId);
    formData.append('receiverId', receiverId);
    //send request
    const response = await friendClient.post('/request',
      formData,
      {
        headers: {
          'X-User-ID': senderId,
          'Authorization': `Bearer ${token}`,
        }
      }
  );
    return response.data;
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

/**
 * Get pending friend requests
 * @param {string} userId - User ID
 */
export const getPendingFriendRequests = async (userId) => {
  try {
    const response = await friendClient.get(`/requests/pending`,     
    {
      headers: {
        'X-User-ID': userId,
        'Authorization': `Bearer ${token}`,
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching pending friend requests:', error);
    throw error;
  }
};

/**
 * Accept friend request
 * @param {string} requestId - Friend request ID
 * @param {string} receiverId - Receiver user ID
 */
export const acceptFriendRequest = async (receiverId ,requestId) => {
  try {
    const response = await friendClient.post(`/requests/${requestId}/accept`,{},
      {
        headers: {
          'X-User-ID': receiverId,
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

/**
 * Reject friend request
 * @param {string} requestId - Friend request ID
 * @param {string} receiverId - Receiver user ID
 */
export const rejectFriendRequest = async (receiverId, requestId) => {
  try {
    const response = await friendClient.post(`/requests/${requestId}/reject`,{},
      {
        headers: {
          'X-User-ID': receiverId,
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    throw error;
  }
};

/**
 * Remove friend
 * @param {string} userId - Current user ID
 * @param {string} friendId - Friend user ID to remove
 */
export const removeFriend = async (userId, friendId) => {
  try {
    const response = await friendClient.delete(`/remove/${friendId}`, {
      headers: {
        'X-User-ID': userId,
        'Authorization': `Bearer ${token}`,
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};

/**
 * Search for users
 * @param {string} query - Search query
 */
export const searchUsers = async (query) => {
  try {
    const response = await userClient.get(`/search?q=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

export const checkFriendship = async (userId, targetId) => {
  try {
    const response = await friendClient.get(`/areFriends/${targetId}`, {
      headers: {
        'X-User-ID': userId,
        'Authorization': `Bearer ${token}`,
      }
    });
    return { isFriend: response.data };
  } catch (error) {
    console.error('Error checking friendship status:', error);
    return { isFriend: false };
  }
}; 