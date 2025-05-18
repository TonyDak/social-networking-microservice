import { useRef, useEffect, useState} from 'react';
import Message from './Message';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';
import { useUser } from '../../contexts/UserContext';
import { checkFriendship, sendFriendRequest } from '../../services/friendService';
import { toast } from 'react-toastify';
import { getUserbyKeycloakId } from '../../services/userService';
import { getCookie } from '../../services/apiClient';
import chatService from '../../services/chatService';

function ChatWindow({ 
  conversation, 
  messages = [], 
  loading = false, 
  onSendMessage, 
  currentUserId,
  selectedUser,
  onLoadMoreMessages,
  loadingMore = false,
  hasMoreMessages = true,
  onAddMember,
  onRemoveMember
}) {
  const { user } = useUser();
  const messagesEndRef = useRef(null);
  const [friendStatus, setFriendStatus] = useState({});
  const messagesContainerRef = useRef(null);
  const [pendingScroll, setPendingScroll] = useState(null);
  const prevMessagesLength = useRef(messages.length);
  const prevMessagesRef = useRef([]);
  const [onlineGroupMembers, setOnlineGroupMembers] = useState({});
  const [hasOnlineMember, setHasOnlineMember] = useState(false);
  const [onlineMembersCount, setOnlineMembersCount] = useState(0);
  const [participantsCache, setParticipantsCache] = useState({});

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (
        container.scrollTop === 0 &&
        typeof onLoadMoreMessages === 'function' &&
        hasMoreMessages // <-- chỉ gọi khi còn tin nhắn
      ) {
        const prevHeight = container.scrollHeight;
        setPendingScroll(prevHeight);
        onLoadMoreMessages().then(() => {
          setTimeout(() => {
            if (messagesContainerRef.current && pendingScroll !== null) {
              const newHeight = messagesContainerRef.current.scrollHeight;
              messagesContainerRef.current.scrollTop = newHeight - prevHeight;
              setPendingScroll(null);
            }
          }, 0);
        });
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onLoadMoreMessages, pendingScroll, hasMoreMessages]);

  useEffect(() => {
    if (pendingScroll !== null && messages.length > prevMessagesLength.current) {
      const container = messagesContainerRef.current;
      if (container) {
        const newHeight = container.scrollHeight;
        container.scrollTop = newHeight - pendingScroll;
      }
      setPendingScroll(null);
    }
    prevMessagesLength.current = messages.length;
  }, [messages, pendingScroll]);

  useEffect(() => {
  const fetchFriendshipStatus = async () => {
    if (selectedUser && user && conversation?.type !== 'GROUP') {
      try {
        const recipientId = selectedUser.keycloakId;
        const response = await checkFriendship(user.keycloakId, recipientId);
        setFriendStatus(prev => ({
          ...prev,
          [recipientId]: response.isFriend
        }));
      } catch (error) {
        console.error('Lỗi khi kiểm tra trạng thái bạn bè:', error);
      }
      setHasOnlineMember(false);
    } else if (conversation?.type === 'GROUP') {
      // Kiểm tra nếu có thành viên nào online
      let online = false;
      if (conversation.users && Array.isArray(conversation.users.participants)) {
        online = conversation.participants.some(
          p => p.body?.isOnline // hoặc trường onlineStatus nếu backend trả về
        );
      }
      setHasOnlineMember(online);
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
  
  useEffect(() => {
    // Khi conversation thay đổi (chọn một cuộc trò chuyện mới), cuộn xuống cuối
    if (conversation && conversation.id) {
      setTimeout(() => {
        scrollToBottom();
      }, 100); // Thêm một chút độ trễ để đảm bảo tin nhắn đã được render
    }
  }, [conversation?.id]);
  // Cuộn xuống dưới khi có tin nhắn mới
  useEffect(() => {
    if (
      messages.length > prevMessagesRef.current.length &&
      (
        prevMessagesRef.current.length === 0 ||
        messages[messages.length - 1]?.id !== prevMessagesRef.current[prevMessagesRef.current.length - 1]?.id
      )
    ) {
      setTimeout(() => {
        scrollToBottom();
      }, 0);
    }
    prevMessagesRef.current = messages;
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
  useEffect(() => {
    const fetchParticipantsInfo = async () => {
      if (conversation?.type === 'GROUP' && Array.isArray(conversation.participants)) {
        try {
          const token = getCookie("access_token");
          const newParticipants = {};
          const onlineStatus = {};
          
          // Fetch thông tin và trạng thái online của từng thành viên
          for (const participantId of conversation.participants) {
            if (!participantsCache[participantId]) {
              try {
                const userInfo = await getUserbyKeycloakId(token, participantId);
                if (userInfo) {
                  newParticipants[participantId] = userInfo;
                }
                
                // Fetch trạng thái online
                try {
                  const status = await chatService.getUserStatus(participantId);
                  onlineStatus[participantId] = status === "ONLINE";
                } catch (err) {
                  console.error(`Error fetching status for user ${participantId}:`, err);
                  onlineStatus[participantId] = false;
                }
              } catch (err) {
                console.error(`Error fetching info for user ${participantId}:`, err);
                // Fallback
                newParticipants[participantId] = {
                  body: {
                    keycloakId: participantId,
                    firstName: 'Người dùng đã rời khỏi nhóm',
                    lastName: `(${participantId})`,
                  }
                };
                onlineStatus[participantId] = false;
              }
            } else {
              // Nếu đã có thông tin trong cache, chỉ fetch trạng thái online
              try {
                const status = await chatService.getUserStatus(participantId);
                onlineStatus[participantId] = status === "ONLINE";
              } catch (err) {
                console.error(`Error fetching status for user ${participantId}:`, err);
                onlineStatus[participantId] = false;
              }
            }
          }
          
          // Cập nhật cache thông tin người dùng
          if (Object.keys(newParticipants).length > 0) {
            setParticipantsCache(prev => ({
              ...prev,
              ...newParticipants
            }));
          }
          
          // Cập nhật trạng thái online của nhóm
          setOnlineGroupMembers(onlineStatus);
          
          // Tính xem có thành viên online không
          const onlineCount = Object.values(onlineStatus).filter(Boolean).length;
          setHasOnlineMember(onlineCount > 0);
          setOnlineMembersCount(onlineCount);
        } catch (error) {
          console.error('Error fetching participants info:', error);
        }
      }
    };
    
    fetchParticipantsInfo();
    
    // Refresh trạng thái online mỗi 30 giây
    const intervalId = setInterval(fetchParticipantsInfo, 30000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [conversation?.id, conversation?.participants]);
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
    console.log('Conversation:', conversation);
    if (conversation.type === 'ONE_TO_ONE') {
      if (conversation.users && conversation.users.body) {
        participantDetails = conversation.users;
      } else if (selectedUser) {
        // fallback: dùng selectedUser nếu có
        participantDetails = { body: selectedUser };
      } else if (conversation.participants) {
        participantDetails = { ids: conversation.participants };
      }
    } else if (conversation.type === 'GROUP') {
      participantDetails = participantsCache;
    }
    console.log('Participant details:', participantDetails);
    return (
      <div className="space-y-4 px-4 py-4">
        {loadingMore && (
          <div className="flex justify-center py-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-indigo-500"></div>
          </div>
        )}
        {messages.map((msg, index) =>
          msg.type === "SYSTEM" ? (
            <div
              key={msg.id || msg.tempId || `msg-${index}`}
              className="flex justify-center my-2"
            >
              <span className="text-xs text-gray-400 px-3 py-1 rounded-full">
                {msg.content}
              </span>
            </div>
          ) : (
            <Message
              key={msg.id || msg.tempId || `msg-${index}`}
              message={msg}
              isOwnMessage={msg.senderId === currentUserId}
              showAvatar={index === 0 || messages[index - 1]?.senderId !== msg.senderId}
              participantDetails={participantDetails}
            />
          )
        )}
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
        hasOnlineMember={hasOnlineMember}
        onlineMembers={onlineMembersCount}
        onAddMember={onAddMember}
        onRemoveMember={onRemoveMember}
      />
      <div
        className="flex-1 overflow-y-auto bg-gray-50"
        ref={messagesContainerRef}
      >
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