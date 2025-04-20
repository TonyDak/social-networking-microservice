import { useRef, useEffect, useState} from 'react';
import Message from './Message';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';
import { useUser } from '../../contexts/UserContext';
import { checkFriendship, sendFriendRequest } from '../../services/friendService';
import { toast } from 'react-toastify';

function ChatWindow({ 
  conversation, 
  messages = [], 
  loading = false, 
  onSendMessage, 
  currentUserId,
  selectedUser
}) {
  const { user } = useUser();
  const messagesEndRef = useRef(null);
  const [friendStatus, setFriendStatus] = useState({});

  useEffect(() => {
    const fetchFriendshipStatus = async () => {
      if (selectedUser && user && conversation?.type !== 'GROUP') {
        try {
          const recipientId = selectedUser.keycloakId;
          // Use the imported service function with correct naming
          const response = await checkFriendship(user.keycloakId, recipientId);
          setFriendStatus(prev => ({
            ...prev,
            [recipientId]: response.isFriend
          }));
        } catch (error) {
          console.error('Lỗi khi kiểm tra trạng thái bạn bè:', error);
        }
      }
    };
    
    fetchFriendshipStatus();
  }, [selectedUser, user, conversation]);
  const handleSendFriendRequest = async (recipientId) => {
    try {
      await sendFriendRequest(user.keycloakId, recipientId);
      toast.success('Đã gửi lời mời kết bạn!');
    } catch (error) {
      console.error('Lỗi khi gửi lời mời kết bạn:', error);
      toast.error('Không thể gửi lời mời kết bạn. Vui lòng thử lại sau.');
    }
  };

  // Cuộn xuống dưới khi có tin nhắn mới
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Tự động cuộn xuống khi có tin nhắn mới
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (content) => {
    // Đảm bảo truyền đúng giá trị lên ChatPage
    if (!content) {
        console.error("Invalid message content:", content);
        return;
    }
    
    // Chỉ truyền content string lên ChatPage
    onSendMessage(content);
  };
  // Hiển thị tin nhắn
  const renderMessages = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-500"></div>
          <p className="mt-3 text-gray-500">Đang tải tin nhắn...</p>
        </div>
      );
    }
  
    if (!messages || messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-8 text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p>Hãy bắt đầu cuộc trò chuyện</p>
        </div>
      );
    }
  
    // Xử lý participantDetails từ conversation
    let participantDetails = {};
    
    if (conversation.participantDetails) {
      // Sử dụng participantDetails nếu đã có
      participantDetails = conversation.users;
    }else if (conversation.users) {
      // Nếu có users từ ConversationList
      if (conversation.type === 'ONE_TO_ONE' && conversation.users.body) {
        participantDetails = conversation.users;
      } else if (conversation.type === 'GROUP' && conversation.users.participants) {
        // Extract participants for group chat
        participantDetails = conversation.users.participants.reduce((acc, participant) => {
          if (participant.body) {
            acc[participant.users.body.keycloakId] = participant;
          }
          return acc;
        }, {});
      }
    }
    return (
      <div className="space-y-4 px-4 py-4">
        {messages.map((msg, index) => (
          <Message
            key={msg.id || msg.tempId || `msg-${index}`}
            message={msg}
            isOwnMessage={msg.senderId === currentUserId}
            showAvatar={index === 0 || messages[index - 1]?.senderId !== msg.senderId}
            participantDetails={participantDetails}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  // Kiểm tra xem hội thoại có phải là tạm thời không
  const isTemporaryConversation = conversation.isTemporary || conversation.id?.startsWith('temp_');

  return (
    <div className="flex flex-col h-full">
      <ChatHeader 
        conversation={conversation}
        selectedUser={selectedUser}
        isFriend={selectedUser ? friendStatus[selectedUser.keycloakId] : false}
        onSendFriendRequest={handleSendFriendRequest}
      />
      
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {renderMessages()}
      </div>
      
      <div className="border-t border-gray-200 bg-white">
        <MessageInput 
          onSendMessage={onSendMessage} 
          disabled={loading}
        />
      </div>
    </div>
  );
}

export default ChatWindow;