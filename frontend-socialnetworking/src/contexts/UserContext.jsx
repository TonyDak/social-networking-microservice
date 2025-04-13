import { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser } from '../services/userService';
import { getCookie } from '../services/apiClient';
import { updateUserProfile } from '../services/userService';

// Tạo context
const UserContext = createContext(null);

// Hook để sử dụng context
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser phải được sử dụng trong UserProvider');
  }
  return context;
};

// Provider component
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = getCookie('access_token');
        if (!token) {
          setLoading(false);
          return;
        }
        
        const userData = await getCurrentUser(token);
        setUser(userData);
      } catch (err) {
        setError('Không thể tải thông tin người dùng');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);
  const updateUser = async (userData) => {
    try {
      setLoading(true);
      const token = getCookie('access_token');
      if (!token) {
        throw new Error('Không có token xác thực');
      }
      const updatedUser = await updateUserProfile(token, userData);
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      console.error('Lỗi cập nhật thông tin:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      setLoading(true);
      const token = getCookie('access_token');
      if (!token) {
        throw new Error('Không có token xác thực');
      }
      const userData = await getCurrentUser(token);
      setUser(userData);
    } catch (err) {
      console.error('Lỗi làm mới thông tin người dùng:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <UserContext.Provider value={{ user, loading, error, updateUser, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
};