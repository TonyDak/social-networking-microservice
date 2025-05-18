import React, { useState, useEffect } from 'react';
import { getUserbyKeycloakId } from '../../services/userService';
import { getFriendsList } from '../../services/friendService';
import { getCookie } from '../../services/apiClient';
import { useUser } from '../../contexts/UserContext';

function UserSearchModal({ onSelectUsers, onCancel, title, excludeIds = [], multiSelect = false, actionType = "add" }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const token = getCookie('access_token');
  const { user } = useUser();

  // Tải danh sách bạn bè khi component mount
  useEffect(() => {
    if (user?.keycloakId) {
      loadFriends();
    }
  }, [user?.keycloakId]);

  // Tải danh sách bạn bè
  const loadFriends = async () => {
    try {
      setLoading(true);
      const data = await getFriendsList(user.keycloakId);
      const details = {};
            
      try {
        // Tạo mảng các promises để tải song song
        const promises = data.map(async (friend) => {
          try {
            // Bỏ qua những người dùng đã được loại trừ
            if (excludeIds.includes(friend.friendId)) {
              return;
            }

            const response = await getUserbyKeycloakId(token, friend.friendId);
            if (response && response.body) {
              details[friend.friendId] = {
                ...response.body,
                id: response.body.id || response.body.keycloakId
              };
            }
          } catch (error) {
            console.error(`Error fetching user data for ${friend.friendId}:`, error);
          }
        });
        
        await Promise.all(promises);
        
        // Lọc ra các bạn bè không nằm trong excludeIds
        const filteredFriends = Object.values(details).filter(friend => 
          friend && !excludeIds.includes(friend.keycloakId)
        );
        
        setFriends(filteredFriends);
      } catch (error) {
        console.error('Error fetching user details:', error);
      }
    } catch (error) {
      console.error('Lỗi tải danh sách bạn bè:', error);
    } finally {
      setLoading(false);
    }
  };

  // Lọc bạn bè theo từ khóa tìm kiếm (cách làm tương tự như CreateGroupDialog)
  const filteredFriends = searchTerm.length > 0 
    ? friends.filter(friend => 
        (friend.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
         friend.lastName?.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : friends;

  // Xử lý khi chọn/bỏ chọn một người dùng
  const toggleUserSelection = (user) => {
    if (multiSelect) {
      setSelectedUsers(prev => {
        const isSelected = prev.some(u => u.keycloakId === user.keycloakId);
        if (isSelected) {
          return prev.filter(u => u.keycloakId !== user.keycloakId);
        } else {
          return [...prev, user];
        }
      });
    } else {
      // Nếu là single select thì chỉ chọn một user
      setSelectedUsers([user]);
      // Và gọi callback ngay lập tức
      onSelectUsers([user]);
    }
  };

  // Kiểm tra người dùng đã được chọn chưa
  const isUserSelected = (userId) => {
    return selectedUsers.some(user => user.keycloakId === userId);
  };

  // Xử lý khi nhấn nút xác nhận
  const handleConfirm = () => {
    onSelectUsers(selectedUsers);
  };

  // Hiển thị avatar người dùng
  const renderAvatar = (user) => {
    return (
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center mr-3">
        {user.image ? (
          <img src={user.image} alt={user.firstName} className="w-full h-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-medium">
            {user.firstName?.charAt(0)?.toUpperCase() || ''}
            {user.lastName?.charAt(0)?.toUpperCase() || ''}
          </div>
        )}
      </div>
    );
  };

  // Hiển thị item người dùng
  const renderUserItem = (user) => (
    <li 
      key={user.keycloakId || user.id}
      className="px-4 py-3 hover:bg-gray-100 cursor-pointer"
      onClick={() => toggleUserSelection(user)}
    >
      <div className="flex items-center">
        {renderAvatar(user)}
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {user.firstName} {user.lastName}
          </p>
          {user.username && (
            <p className="text-xs text-gray-500 truncate">
              @{user.username}
            </p>
          )}
        </div>
        
        {multiSelect && (
          <div className="ml-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isUserSelected(user.keycloakId)
                ? 'bg-indigo-500 text-white'
                : 'border-2 border-gray-300'
            }`}>
              {isUserSelected(user.keycloakId) && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title || 'Tìm kiếm bạn bè'}</h3>
      
      {/* Search input */}
      <div className="mb-3">
        <div className="relative">
          <input
            type="text"
            className="w-full py-2 pl-9 pr-4 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm bạn bè..."
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Selected users count */}
      {multiSelect && selectedUsers.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map(user => (
              <div 
                key={user.id || user.keycloakId} 
                className="bg-indigo-100 text-indigo-800 text-sm px-3 py-1 rounded-full flex items-center"
              >
                <span className="mr-1">{user.firstName} {user.lastName}</span>
                <button 
                  onClick={() => toggleUserSelection(user)}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Danh sách bạn bè */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg max-h-60">
        {loading ? (
          <div className="flex items-center justify-center h-20 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-500"></div>
          </div>
        ) : filteredFriends.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {filteredFriends.map(friend => renderUserItem(friend))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="mt-2 text-gray-500">
              {searchTerm ? `Không tìm thấy bạn bè nào phù hợp với "${searchTerm}"` : 'Bạn chưa có bạn bè nào hoặc bạn bè đã được thêm vào nhóm'}
            </p>
          </div>
        )}
      </div>
      
      {/* Action buttons */}
      <div className="flex justify-end space-x-2 mt-6">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Hủy
        </button>
        
        {multiSelect && (
          <button
            onClick={handleConfirm}
            disabled={selectedUsers.length === 0}
            className={`px-4 py-2 rounded-lg text-white transition-colors flex items-center ${
              actionType === "remove"
                ? "bg-red-500 hover:bg-red-600 disabled:bg-red-300"
                : "bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
            {actionType === "remove" ? `Xóa (${selectedUsers.length})` : `Thêm (${selectedUsers.length})`}
          </button>
        )}
      </div>
    </div>
  );
}

export default UserSearchModal;