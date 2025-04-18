import React from 'react';
import { useEffect, useState } from 'react';
import chatService from '../../services/chatService';


function ChatHeader({ 
  conversation,
  selectedUser,
  onlineUsers = {}
}) {
  // State để lưu trạng thái online từ API
  const [recipientStatus, setRecipientStatus] = useState({
    isOnline: false,
    lastActive: null
  });
  const [loading, setLoading] = useState(false);

  // Xác định ID người nhận để gọi API
  let recipientId = null;
  
  if (!conversation?.type === 'GROUP' && selectedUser) {
    recipientId = selectedUser.id || selectedUser.keycloakId;
  } else if (conversation?.participants && conversation.participants.length > 0) {
    recipientId = conversation.participants[0];
  }

  // Gọi API để lấy trạng thái online
  useEffect(() => {
    const fetchUserStatus = async () => {
      if (!recipientId) return;
      
      try {
        setLoading(true);
        const response = await chatService.getUserStatus(recipientId);
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
    const intervalId = setInterval(fetchUserStatus, 30000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [recipientId]);

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
    name = selectedUser.name || selectedUser.username;
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
    image = selectedUser.profileImage || selectedUser.avatar;
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
    onlineCount = conversation.participants?.filter(participantId => 
      onlineUsers[participantId]?.isOnline).length || 0;
    
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
    
  // ---------- PHẦN HIỂN THỊ UI ----------
  return (
    <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-white">
      {/* Avatar với indicator trạng thái */}
      <div className="relative">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
          {image ? (
            <img src={image} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-gray-500 font-medium text-sm">
              {name ? name.charAt(0).toUpperCase() : '?'}
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
      
      {/* Menu options (nếu cần) */}
      <div className="ml-auto">
        <button className="text-gray-500 hover:text-gray-700 focus:outline-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ChatHeader;