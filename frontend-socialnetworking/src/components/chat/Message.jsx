import React from 'react';

function MessageItem({ message, isOwnMessage, showAvatar, participantDetails }) {
    // Format ngày giờ
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };
    
    // Lấy thông tin người gửi
    const getSenderInfo = () => {
        // Nếu là tin nhắn của chính mình
        if (isOwnMessage) {
            return { name: 'Bạn', avatar: null };
        }
        
        // Kiểm tra cấu trúc của participantDetails
        if (participantDetails) {
            // Trường hợp participantDetails là object với cấu trúc {body: {...}}
            if (participantDetails.body) {
                return {
                    name: `${participantDetails.body.firstName || ''} ${participantDetails.body.lastName || ''}`.trim() || 'Người dùng',
                    avatar: participantDetails.body.image
                };
            }
            
            // Trường hợp participantDetails là map với key là senderId
            if (message.senderId && participantDetails[message.senderId]) {
                const senderDetail = participantDetails[message.senderId];
                if (senderDetail.body) {
                    return {
                        name: `${senderDetail.body.firstName || ''} ${senderDetail.body.lastName || ''}`.trim(),
                        avatar: senderDetail.body.image
                    };
                } else {
                    return {
                        name: senderDetail.name || `Người dùng`,
                        avatar: senderDetail.avatar
                    };
                }
            }
            
            // Trường hợp có name trực tiếp
            if (participantDetails.name) {
                return {
                    name: participantDetails.name,
                    avatar: participantDetails.avatar
                };
            }
        }
        
        // Fallback: Nếu không thể xác định thông tin người gửi
        const senderId = message.senderId || 'unknown';
        return {
            name: `Người dùng (${senderId.substring(0, 6)})`,
            avatar: null
        };
    };

    // Xác định trạng thái tin nhắn
    const getStatusIcon = () => {
        if (!isOwnMessage) return null;
        
        switch(message.status) {
            case 'SENDING':
                return (
                    <svg className="w-3 h-3 text-gray-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
            case 'SENT':
                return (
                    <svg className="w-3 h-3 text-indigo-200" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                );
            case 'DELIVERED':
                return (
                    <svg className="w-3 h-3 text-indigo-200" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                );
            case 'READ':
                return (
                    <div className="flex">
                        <svg className="w-3 h-3 text-indigo-200" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <svg className="w-3 h-3 -ml-1 text-indigo-200" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                );
            case 'ERROR':
                return (
                    <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                );
            default:
                return null;
        }
    };
    
    const { name, avatar } = getSenderInfo();
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    const randomColors = [
        'bg-blue-100 text-blue-600', 
        'bg-green-100 text-green-600', 
        'bg-purple-100 text-purple-600',
        'bg-pink-100 text-pink-600', 
        'bg-yellow-100 text-yellow-600'
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
                        ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-none' 
                        : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                }`}>
                    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {message.content}
                    </div>
                    
                    <div className="flex items-center justify-end mt-1 space-x-1">
                        <span className={`text-xs ${isOwnMessage ? 'text-indigo-200' : 'text-gray-400'}`}>
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