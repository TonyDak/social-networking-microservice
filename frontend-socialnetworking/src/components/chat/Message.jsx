import React from 'react';
import { getUserbyKeycloakId } from '../../services/userService';
import { getCookie } from '../../services/apiClient';
import { useState, useEffect } from 'react';

function MessageItem({ message, isOwnMessage, showAvatar, participantDetails }) {
    const token = getCookie('access_token');
    const [senderInfo, setSenderInfo] = useState({ name: '', avatar: null });
    const [showImageModal, setShowImageModal] = useState(false);

    // Format ngày giờ
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };
    
    useEffect(() => {
        const fetchSenderInfo = async () => {
            // Nếu là tin nhắn của chính mình
            if (isOwnMessage) {
                setSenderInfo({ name: 'Bạn', avatar: null });
                return;
            }

            // Nếu là tin nhắn hệ thống (ví dụ: thông báo nhóm)
            if (message.isSystem) {
                setSenderInfo({ name: 'Hệ thống', avatar: null });
                return;
            }

            // Kiểm tra participantDetails cho nhóm
            if (participantDetails) {
                if (message.senderId && participantDetails[message.senderId]) {
                    const senderDetail = participantDetails[message.senderId];
                    if (senderDetail.body) {
                        setSenderInfo({
                            name: `${senderDetail.body.firstName || ''} ${senderDetail.body.lastName || ''}`.trim() || `Người dùng`,
                            avatar: senderDetail.body.image
                        });
                        return;
                    } else {
                        setSenderInfo({
                            name: senderDetail.name || `Người dùng`,
                            avatar: senderDetail.avatar
                        });
                        return;
                    }
                }
                if (participantDetails.body) {
                    setSenderInfo({
                        name: `${participantDetails.body.firstName || ''} ${participantDetails.body.lastName || ''}`.trim() || 'Người dùng',
                        avatar: participantDetails.body.image
                    });
                    return;
                }
                if (participantDetails.name) {
                    setSenderInfo({
                        name: participantDetails.name,
                        avatar: participantDetails.avatar
                    });
                    return;
                }
            }

            // Fallback: Nếu không thể xác định thông tin người gửi
            const senderId = message.senderId || 'unknown';
            try {
                let userout = await getUserbyKeycloakId(token, senderId);
                setSenderInfo({
                    name: `${userout.body.firstName} ${userout.body.lastName}`.trim() + ' (Người dùng đã rời khỏi nhóm)',
                    avatar: null
                });
            } catch {
                setSenderInfo({
                    name: 'Chưa xác định (Người dùng đã rời khỏi nhóm)',
                    avatar: null
                });
            }
        };

        fetchSenderInfo();
    }, [isOwnMessage, message, participantDetails, token]);

    // Xác định trạng thái tin nhắn
    const getStatusIcon = () => {
        if (!isOwnMessage) return null;
        
        switch(message.status) {
            case 'SENDING':
                return (
                    <div className="flex items-center text-xs text-gray-400">
                        <span>Đang gửi</span>
                    </div>
                );
                
            case 'SENT':
                return (
                    <div className="flex items-center">
                        <span className="text-xs text-gray-400 ml-0.5">Đã gửi</span>
                    </div>
                );
                
            case 'DELIVERED':
                return (
                    <div className="flex items-center">
                        <span className="text-xs text-gray-400 ml-0.5">Đã nhận</span>
                    </div>
                );
                
            case 'READ':
                return (
                    <div className="flex items-center">
                        <span className="text-xs text-gray-400 ml-0.5">Đã xem</span>
                    </div>
                );
                
            case 'ERROR':
                return (
                    <div className="flex items-center">
                        <span className="text-xs text-red-400 ml-0.5">Lỗi gửi</span>
                    </div>
                );
                
            default:
                // Hiển thị mặc định khi không có trạng thái
                return null;
        }
    };
    
    const name = senderInfo.name || '';
    const avatar = senderInfo.avatar;
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    const randomColors = [
        'bg-blue-100 text-blue-600', 
        'bg-green-100 text-green-600', 
        'bg-purple-100 text-purple-600',
        'bg-pink-100 text-pink-600', 
        'bg-yellow-100 text-yellow-600',
        'bg-red-100 text-red-600',
        'bg-gray-100 text-gray-600',
        'bg-teal-100 text-teal-600',
        'bg-orange-100 text-orange-600',
    ];
    
    // Tạo màu nhất quán cho mỗi người dùng dựa trên tên
    const getConsistentColorIndex = (name) => {
        let sum = 0;
        for (let i = 0; i < name.length; i++) {
            sum += name.charCodeAt(i);
        }
        return sum % randomColors.length;
    };
    
    const avatarColorClass = randomColors[getConsistentColorIndex(name)];
    
    return (
        <div className={`flex mb-4 ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            {!isOwnMessage && showAvatar && (
                <div className="flex-shrink-0 mr-2">
                    <div className={`w-9 h-9 rounded-full overflow-hidden ${!avatar ? avatarColorClass : 'bg-gray-200'} flex items-center justify-center shadow-sm`}>
                        {avatar ? (
                            <img src={avatar} alt={name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="font-medium text-sm">
                                {initials.substring(0, 2)}
                            </span>
                        )}
                    </div>
                </div>
            )}
            
            <div className={`max-w-[75%] ${!isOwnMessage && !showAvatar ? 'ml-11' : ''}`}>
                {!isOwnMessage && showAvatar && (
                    <div className="text-xs font-medium text-gray-600 mb-1 ml-1">{name}</div>
                )}
                
                <div className={`rounded-2xl px-4 py-2.5 inline-block shadow-sm transition-all ${
                    isOwnMessage 
                        ? 'bg-indigo-50 text-gray-900 rounded-br-none' 
                        : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                }`}>
                    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {message.type === "image" ? (
                            <img
                                src={message.content}
                                alt={message.fileName || "image"}
                                className="max-w-xs max-h-64 rounded shadow cursor-pointer"
                                onClick={() => window.open(message.content, "_blank")}
                                loading="lazy"
                            />
                        ) : message.type === "video" ? (
                            <video controls className="max-w-xs max-h-64 rounded shadow">
                                <source src={message.content} type="video/mp4" />
                                Trình duyệt không hỗ trợ video.
                            </video>
                        ) : message.type === "file" ? (
                            <a
                                href={message.content}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline break-all"
                            >
                                {message.fileName || "Tải file"}
                            </a>
                        ) : (
                            message.content
                        )}
                    </div>
                    
                    <div className="flex items-center justify-end mt-1 space-x-1">
                        <span className={`text-xs ${isOwnMessage ? 'text-gray-400' : 'text-gray-400'}`}>
                            {formatTime(message.timestamp)}
                        </span>
                        {getStatusIcon()}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Thêm animation fade-in
const styles = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}
`;

function Message({ message, isOwnMessage, showAvatar, participantDetails }) {
    return (
        <>
            <style>{styles}</style>
            <MessageItem 
                message={message} 
                isOwnMessage={isOwnMessage} 
                showAvatar={showAvatar} 
                participantDetails={participantDetails} 
            />
        </>
    );
}

export default Message;