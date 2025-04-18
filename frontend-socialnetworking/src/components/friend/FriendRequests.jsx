import React, { useState, useEffect } from 'react';
import { getUserbyKeycloakId } from '../../services/userService';
import { getCookie } from '../../services/apiClient';

function FriendRequests({ requests = [], loading = false, onAccept, onReject }) {
  const [userDetails, setUserDetails] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const token = getCookie('access_token');
  
  // Tải thông tin người dùng khi component mount hoặc requests thay đổi
  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!requests.length) return;
      
      setLoadingUsers(true);
      const details = {};
      
      try {
        // Tạo mảng các promises để tải song song
        const promises = requests.map(async (request) => {
          try {
            const response = await getUserbyKeycloakId(token, request.senderId);
            details[request.senderId] = response.body;
          } catch (error) {
            console.error(`Error fetching user data for ${request.senderId}:`, error);
          }
        });
        
        await Promise.all(promises);
        setUserDetails(details);
      } catch (error) {
        console.error('Error fetching user details:', error);
      } finally {
        setLoadingUsers(false);
      }
    };
    
    fetchUserDetails();
  }, [requests, token]);

  const handleAcceptRequest = (receiverId, requestId) => {
    if (onAccept) onAccept(receiverId, requestId);
  };
  
  const handleRejectRequest = (receiverId, requestId) => {
    if (onReject) onReject(receiverId, requestId);
  };
  
  // Hàm hiển thị thông tin người dùng (chỉ render, không gọi API)
  const renderUserInfo = (senderId) => {
    const user = userDetails[senderId];
    
    // Nếu chưa tải được thông tin người dùng, hiển thị skeleton
    if (!user) {
      return (
        <div className="flex items-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-gray-200 mr-3"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      );
    }
    
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const initials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`;
    
    return (
      <div className="flex items-center">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 mr-3">
          {user.image ? (
            <img src={user.image} alt={fullName} className="w-full h-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-medium">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-medium">{fullName}</h3>
          {user.username && (
            <p className="text-sm text-gray-500">@{user.username}</p>
          )}
          {user.email && (
            <p className="text-xs text-gray-500">{user.email}</p>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center p-4 bg-white border-b border-gray-200">
        <div className="w-8 h-8 mr-3 rounded-full bg-orange-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-600" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
          </svg>
        </div>
        <span className={`font-medium text-gray-700 text-xl`}>
          Lời mời kết bạn <span className="text-sm text-orange-500">({requests.length})</span>
        </span>
      </div>
      
      <div className="px-4 pb-4">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-indigo-500"></div>
          </div>
        ) : requests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {requests.map(request => (
              <div key={request.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                {renderUserInfo(request.senderId)}
                
                <div className="mt-2">
                  <p className="text-sm text-gray-500">Đã gửi lời mời kết bạn</p>
                  {request.createdAt && (
                    <p className="text-xs text-gray-400">{new Date(request.createdAt).toLocaleDateString('vi-VN')}</p>
                  )}
                </div>
                
                <div className="flex mt-4 space-x-2">
                  <button
                    onClick={() => handleAcceptRequest(request.receiverId, request.id)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded flex items-center justify-center transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Đồng ý
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request.receiverId, request.id)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded flex items-center justify-center transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-8 text-center mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="mt-3 text-lg font-medium text-gray-900">Không có lời mời kết bạn nào</h3>
            <p className="mt-2 text-gray-500">
              Hiện tại bạn không có lời mời kết bạn mới nào
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FriendRequests;