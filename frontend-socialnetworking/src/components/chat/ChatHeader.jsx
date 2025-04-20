import React from 'react';
import { useEffect, useState } from 'react';
import chatService from '../../services/chatService';
import { getUserbyKeycloakId } from '../../services/userService';
import Profile from '../user/Profile';
import { getCookie } from '../../services/apiClient';
import CallButton from '../call/CallButton';


function ChatHeader({ 
  conversation,
  selectedUser,
  isFriend = false,
  onSendFriendRequest
}) {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const token = getCookie('access_token');
  // State để lưu trạng thái online từ API
  const [recipientStatus, setRecipientStatus] = useState({
    isOnline: false,
    lastActive: null
  });
  const [loading, setLoading] = useState(false);
  // Xác định ID người nhận để gọi API
  let recipientId = null;
  
  if (!conversation?.type === 'GROUP' && selectedUser) {
    recipientId = selectedUser.keycloakId;
  } else if (conversation?.participants && conversation.participants.length > 0) {
    recipientId = conversation.participants[0];
  }
  const [userProfile, setUserProfile] = useState(null);

  // Load user profile when modal opens
  useEffect(() => {
    const loadUserProfile = async () => {
      if (showProfileModal && selectedUser?.keycloakId) {
        try {
          const userData = await getUserbyKeycloakId(token, selectedUser.keycloakId);
          setUserProfile(userData.body);
        } catch (error) {
          console.error("Failed to load user profile:", error);
        }
      }
    };
    
    loadUserProfile();
  }, [showProfileModal, selectedUser, token]);
  // Gọi API để lấy trạng thái online
  useEffect(() => {
    const fetchUserStatus = async () => {
      if (!recipientId) return;
      
      try {
        setLoading(true);
        const response = await chatService.getUserStatus(selectedUser.keycloakId);
        const isOnline = response === "ONLINE";
        setRecipientStatus({
          isOnline: isOnline,
          lastActive: isOnline ? new Date().toISOString() : (response?.lastActiveTime || null)
        });
      } catch (error) {
        console.error('Lỗi khi lấy trạng thái người dùng:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Gọi API khi recipientId thay đổi
    fetchUserStatus();
    
    // Cập nhật trạng thái mỗi 30 giây
    const intervalId = setInterval(fetchUserStatus, 10000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [recipientId, selectedUser?.keycloakId]);

  // Kiểm tra xem conversation và type có tồn tại
  const isGroup = conversation?.type === 'GROUP';
  
  // --------- XỬ LÝ THÔNG TIN HIỂN THỊ ---------
  // 1. Ưu tiên dùng selectedUser (khi chat 1-1)
  // 2. Nếu không có, dùng participantDetails từ conversation
  // 3. Nếu không có cả hai, dùng thông tin cơ bản từ conversation
  
  // Xử lý tên hiển thị
  let name;
  if (!isGroup && selectedUser) {
    // Ưu tiên 1: Dùng thông tin từ selectedUser (từ FriendsList)
    name = selectedUser.firstName +' '+ selectedUser.lastName || selectedUser.username;
  } else if (isGroup) {
    // Nhóm: Dùng tên nhóm
    name = conversation?.name || 'Nhóm chat';
  } else {
    // Chat 1-1: Dùng tên từ participantDetails nếu có
    name = conversation?.participantDetails && 
           conversation?.participants?.[0] && 
           conversation.participantDetails[conversation.participants[0]]?.name;
    
    // Backup nếu không có tên
    if (!name) {
      name = 'Người dùng';
    }
  }
  
  // Xử lý ảnh đại diện tương tự
  let image;
  if (!isGroup && selectedUser) {
    // Ưu tiên 1: Ảnh từ selectedUser
    image = selectedUser.image || selectedUser.avatar;
  } else if (isGroup) {
    // Nhóm: Ảnh nhóm
    image = conversation?.image;
  } else {
    // Chat 1-1: Ảnh từ participantDetails
    image = conversation?.participantDetails && 
            conversation?.participants?.[0] && 
            conversation.participantDetails[conversation.participants[0]]?.image;
  }
  
  // Số lượng thành viên (chỉ với nhóm)
  const participantCount = isGroup && conversation?.participants 
    ? conversation.participants.length 
    : null;

  // ---------- XỬ LÝ TRẠNG THÁI ONLINE ----------
  let isRecipientOnline = recipientStatus.isOnline;
  let lastActive = recipientStatus.lastActive;
  let onlineCount = 0;
  
  if (isGroup && conversation) {
    // Với nhóm, vẫn dùng onlineUsers từ props (hoặc có thể gọi API riêng cho nhóm)
    
    isRecipientOnline = onlineCount > 0;
  }
  
  // Format thời gian hoạt động gần nhất - giữ nguyên code hiện tại
  const formatLastActive = () => {
    if (!lastActive) return 'Không hoạt động';
    
    const lastActiveDate = new Date(lastActive);
    const now = new Date();
    const diffMinutes = Math.floor((now - lastActiveDate) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Vừa mới hoạt động';
    if (diffMinutes < 60) return `Hoạt động ${diffMinutes} phút trước`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`;
    
    if (now.getDate() - lastActiveDate.getDate() === 1) return 'Hoạt động hôm qua';
    
    return `Hoạt động ${lastActiveDate.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  };
  const handleSendFriendRequest = () => {
    if (onSendFriendRequest && recipientId) {
      onSendFriendRequest(recipientId);
    }
  }; 
  // Xử lý khi click vào nút xem thông tin
  const handleViewProfile = (friendId, e) => {
    // Ngăn chặn sự kiện click lan truyền đến thẻ cha
    e.stopPropagation();
    setShowProfileModal(true);
  };
  
  // Đóng modal profile
  const handleCloseProfileModal = () => {
    setShowProfileModal(false);
  };
  // ---------- PHẦN HIỂN THỊ UI ----------
  return (
    <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-white">
      {/* Avatar với indicator trạng thái */}
      <div className="relative">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center"
        onClick={(e) => handleViewProfile(selectedUser.keycloakId, e)}
        >
          {image ? (
            <img src={image} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-gray-500 font-medium text-sm">
              {name ? selectedUser.firstName.charAt(0).toUpperCase() + selectedUser.lastName.charAt(0).toUpperCase() : '?'}
            </span>
          )}
        </div>
        
        {/* Chỉ báo trạng thái online/offline */}
        <span 
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
            isRecipientOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}>
        </span>
      </div>
      
      {/* Thông tin người dùng/nhóm */}
      <div className="ml-3 flex-1">
        <h3 className="font-medium">{name || 'User'}</h3>
        
        {/* Thông tin trạng thái */}
        {isGroup ? (
          <p className="text-xs text-gray-500">
            {participantCount} thành viên
            {onlineCount > 0 && ` • ${onlineCount} người đang hoạt động`}
          </p>
        ) : (
          <p className="text-xs">
            {loading ? (
              <span className="text-gray-500">Đang kiểm tra...</span>
            ) : isRecipientOnline ? (
              <span className="text-green-500 font-medium">Đang hoạt động</span>
            ) : (
              <span className="text-gray-500">{lastActive ? formatLastActive() : 'Không hoạt động'}</span>
            )}
          </p>
        )}
      </div>
      
      {/* Menu options và nút kết bạn */}
      <div className="ml-auto flex items-center space-x-2">
        {/* Nút kết bạn - chỉ hiển thị khi không phải nhóm và chưa kết bạn */}
        {!isGroup && !isFriend && recipientId && (
          <button 
            onClick={handleSendFriendRequest}
            className="text-indigo-500 hover:text-indigo-600 focus:outline-none p-1 rounded-full hover:bg-indigo-50"
            title="Kết bạn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
          </button>
        )}
        
        {/* Menu options - luôn hiển thị */}
        <CallButton 
          recipientId={selectedUser.keycloakId} 
          recipientName={name}
        />

        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>
      {/* Modal hiển thị Profile */}
      {showProfileModal && selectedUser && (
        <>
          {/* Overlay để làm mờ toàn bộ nội dung phía sau */}
          <div 
            className="fixed inset-0 backdrop-brightness-20 transition-opacity z-40"
            onClick={handleCloseProfileModal}
          ></div>
          
          {/* Modal container nổi lên trên lớp overlay */}
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl relative">
                <div className="absolute top-0 right-0 pt-4 pr-4">
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={handleCloseProfileModal}
                  >
                    <span className="sr-only">Đóng</span>
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="max-h-[80vh] overflow-y-auto p-6"
                  style={{ '-ms-overflow-style': 'none', 'scrollbarWidth': 'none' }} 
                >
                  <Profile 
                    user={userProfile} 
                    showEditButton={false} 
                    isFriend={false}
                    onSendMessage={() => {
                      handleCloseProfileModal();
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ChatHeader;