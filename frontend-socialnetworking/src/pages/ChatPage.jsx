import { useState, useEffect, useRef } from 'react';
import ConversationList from '../components/chat/ConversationList';
import ChatWindow from '../components/chat/ChatWindow';
import { useUser } from '../contexts/UserContext';
import chatService from '../services/chatService';
import { getUserbyKeycloakId } from '../services/userService';
import { getCookie } from '../services/apiClient';

function ChatPage({selectedUser, connected, websocketError}) {
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [error, setError] = useState(websocketError);
    const [chatWindowUser, setChatWindowUser] = useState(null);
    const { user } = useUser();
    
    const currentGroupSubscription = useRef(null);
    const processedUserRef = useRef(null);
    const selectedConversationRef = useRef(selectedConversation);
    const messageHandlerRef = useRef(null);
    const chatWindowUserRef = useRef(null);

    // Xử lý WebSocket và nhận tin nhắn
    useEffect(() => {
        if (user && connected) {
            // Chỉ fetch conversations khi đã kết nối
            fetchConversations();
    
            // Đăng ký nhận tin nhắn cá nhân
            chatService.onMessage('private', (message) => {
                if (messageHandlerRef.current) {
                    messageHandlerRef.current(message);
                }
            });
        }
    
        return () => {
            // Cleanup khi component unmount
            chatService.messageCallbacks.delete('private');
            if (currentGroupSubscription.current) {
                currentGroupSubscription.current.unsubscribe();
                currentGroupSubscription.current = null;
            }
        };
    }, [user, connected]);

    useEffect(() => {
        selectedConversationRef.current = selectedConversation;
    }, [selectedConversation]);

    useEffect(() => {
        messageHandlerRef.current = (message) => {
            const currentConv = selectedConversationRef.current;
            // Xử lý tin nhắn với tham chiếu mới nhất
            if (currentConv && message) {
                let isCurrentConversation = false;
                console.log("Nhận tin nhắn:", message);
                if (currentConv.type === 'ONE_TO_ONE') {
                    let otherUserId = null;
                    if(selectedUser){
                        otherUserId = selectedUser.id;
                    }
                    // Nếu không có selectedUser, lấy từ conversation
                    if (!otherUserId) {
                        otherUserId = currentConv.users.body.keycloakId;
                    }
                    // Kiểm tra xem tin nhắn có thuộc cuộc trò chuyện hiện tại không
                    isCurrentConversation = (
                        // Tôi nhận tin từ người kia
                        (message.senderId === otherUserId && message.receiverId === user.keycloakId) ||
                        // Tôi gửi tin cho người kia
                        (message.senderId === user.keycloakId && message.receiverId === otherUserId)
                    );
                } else if (currentConv.type === 'GROUP') {
                    isCurrentConversation = message.conversationId === currentConv.id;
                }
                
                // Nếu tin nhắn thuộc cuộc trò chuyện hiện tại, thêm vào UI
                if (isCurrentConversation) {
                    const messageWithTimestamp = {
                        ...message,
                        _receivedAt: new Date().getTime() // Thêm timestamp nhận để đảm bảo tin nhắn là object mới
                    };
                    setMessages(prev => {
                        const exists = prev.some(m => m.id === messageWithTimestamp.id);
                        if (exists) return prev;
                        
                        return [...prev, messageWithTimestamp];
                    });
                    
                    // Đánh dấu tin nhắn đã đọc nếu là tin nhắn đến
                    if (message.senderId !== user.keycloakId && message.id) {
                        chatService.markMessageAsRead(message.id)
                            .catch(err => console.error('Lỗi khi đánh dấu tin nhắn đã đọc:', err));
                    }
                }
            }
            // Luôn cập nhật danh sách cuộc trò chuyện
            updateConversationWithNewMessage(message);
        };
    }, [selectedConversation, user, messages]);


    useEffect(() => {
        const handleSelectedUser = async () => {
            if (selectedUser && user && connected && selectedUser.id !== processedUserRef.current) {
                try {
                    const conversations = await chatService.getUserConversations();
                    processedUserRef.current = selectedUser.id; // Đánh dấu đã xử lý
                    setLoadingMessages(true);
                    
                    // Tìm cuộc trò chuyện hiện có với người dùng này
                    const existingConv = findExistingConversation(conversations, selectedUser?.id);
                    console.log("Cuộc trò chuyện hiện có:", existingConv);

                    if (existingConv) {
                        // Nếu đã có cuộc trò chuyện, chọn nó
                        console.log("Tìm thấy cuộc trò chuyện hiện có:", existingConv.id);
                        handleSelectConversation(existingConv);
                    } else {
                        // QUAN TRỌNG: Đối với người dùng mới, tạo cuộc trò chuyện tạm thời
                        // nhưng KHÔNG lưu vào danh sách conversations vì chưa có tin nhắn
                        console.log("Tạo cuộc trò chuyện tạm thời với:", selectedUser.id);
                        
                        const tempConversation = {
                            id: `temp_${Date.now()}`,
                            type: 'ONE_TO_ONE',
                            participants: [selectedUser.id],
                            participantDetails: selectedUser,
                            lastActivity: new Date().toISOString(),
                            isTemporary: true // Đánh dấu là tạm thời
                        };
                        
                        // Chỉ thiết lập selectedConversation, KHÔNG thêm vào conversations
                        setSelectedConversation(tempConversation);
                        setMessages([]); // Reset messages
                    }
                    
                    setLoadingMessages(false);
                } catch (error) {
                    console.error("Lỗi khi mở cuộc trò chuyện với người dùng:", error);
                    setError("Không thể mở cuộc trò chuyện với người dùng đã chọn.");
                    setLoadingMessages(false);
                }
            }
        };
        
        if (conversations.length > 0 || selectedUser) { // Chỉ xử lý khi danh sách cuộc trò chuyện đã được tải hoặc có selectedUser
            handleSelectedUser();
        }
    }, [selectedUser, user, connected, conversations]);

    useEffect(() => {
        if (websocketError) {
            setError(websocketError);
        }
    }, [websocketError]);

    

    // Tải danh sách cuộc trò chuyện
    const fetchConversations = async () => {
        try {
            setLoading(true);
            const data = await chatService.getUserConversations();
            console.log("Danh sách cuộc trò chuyện:", data);
            setConversations(data);
            setLoading(false);
            
            // Nếu có selectedUser, xử lý sau khi đã tải conversations
            if (selectedUser && user && selectedUser.id !== processedUserRef.current) {
                const existingConv = findExistingConversation(data, selectedUser?.id);
                
                if (existingConv) {
                    handleSelectConversation(existingConv);
                } else {
                    // Không gọi handleCreateConversation nữa, chờ tin nhắn đầu tiên
                    processedUserRef.current = selectedUser.id;
                }
            }
        } catch (error) {
            console.error("Không thể tải danh sách trò chuyện", error);
            setError("Không thể tải danh sách trò chuyện. Vui lòng thử lại sau.");
            setLoading(false);
        }
    };
    const findExistingConversation = (conversations, userId) => {
        if (!userId || !conversations || !Array.isArray(conversations)) return null;
        
        const userIdStr = String(userId);
        
        return conversations.find(conv => 
            conv.type === 'ONE_TO_ONE' && 
            Array.isArray(conv.participants) &&
            conv.participants.some(id => String(id) === userIdStr)
        );
    };
    const enrichConversationWithUsers = async (conversation) => {
        try {
            if (!conversation) return conversation;
            
            // Nếu đã có thông tin users, không cần làm gì thêm
            if (conversation.users) return conversation;
            
            const token = getCookie("access_token");
            
            if (conversation.type === 'GROUP') {
                // Xử lý nhóm
                try {
                    const participantsInfo = await Promise.all(
                        conversation.participants.map(async (participantId) => {
                            try {
                                const info = await getUserbyKeycloakId(token, participantId);
                                return info && info.body ? info : { 
                                    body: { firstName: 'User', lastName: `(${participantId.substring(0, 8)})` } 
                                };
                            } catch (err) {
                                console.error(`Error fetching participant ${participantId}:`, err);
                                return { 
                                    body: { firstName: 'User', lastName: `(${participantId.substring(0, 8)})` } 
                                };
                            }
                        })
                    );
                    
                    return {
                        ...conversation,
                        users: {
                            isGroup: true,
                            groupName: conversation.name || 'Nhóm không tên',
                            participants: participantsInfo
                        }
                    };
                } catch (error) {
                    console.error("Error fetching group participants:", error);
                    return { 
                        ...conversation,
                        users: { groupName: 'Nhóm không xác định' } 
                    };
                }
            } else if (conversation.type === 'ONE_TO_ONE') {
                // Trong cuộc trò chuyện 1-1, lấy ID người kia
                const otherParticipantId = conversation.participants.find(id => id !== user.keycloakId);
                
                if (!otherParticipantId) {
                    return { 
                        ...conversation,
                        users: { body: { firstName: 'Người dùng', lastName: 'không xác định' } }
                    };
                }
                
                try {
                    const otherParticipant = await getUserbyKeycloakId(token, otherParticipantId);
                    if (otherParticipant && otherParticipant.body) {
                        return {
                            ...conversation,
                            users: otherParticipant
                        };
                    }
                } catch (error) {
                    console.error("Error fetching user:", error);
                }
                
                // Fallback
                return { 
                    ...conversation,
                    users: { body: { firstName: 'Người dùng', lastName: `(${otherParticipantId.substring(0, 8)})` } }
                };
            }
            
            // Mặc định nếu không có thông tin
            return { 
                ...conversation,
                users: { body: { firstName: 'Cuộc trò chuyện', lastName: 'không xác định' } }
            };
        } catch (error) {
            console.error("Error enriching conversation:", error);
            return conversation;
        }
    };
    // Cập nhật cuộc trò chuyện với tin nhắn mới
    const updateConversationWithNewMessage = (message) => {
        console.log("Cập nhật danh sách cuộc trò chuyện với tin nhắn:", message);
        
        setConversations(prevConversations => {
            // Chuyển đổi ID sang dạng chuỗi để so sánh chính xác
            const senderId = String(message.senderId);
            const receiverId = String(message.receiverId);
            
            // Tìm cuộc trò chuyện hiện có cần cập nhật
            const existingConversationIndex = prevConversations.findIndex(conv => {
                if (conv.type === 'ONE_TO_ONE') {
                    // Chuyển đổi sang string để so sánh chính xác
                    const participants = conv.participants.map(id => String(id));
                    return (
                        participants.includes(senderId) && 
                        participants.includes(receiverId)
                    );
                } else if (conv.type === 'GROUP') {
                    return String(conv.id) === String(message.conversationId);
                }
                return false;
            });
            
            // Kiểm tra xem đây có phải là cuộc trò chuyện đang hiển thị không
            const isSelected = selectedConversationRef.current && (
                (selectedConversationRef.current.type === 'ONE_TO_ONE' && 
                  selectedConversationRef.current.participants.some(id => 
                    String(id) === senderId || String(id) === receiverId
                  )
                ) ||
                (selectedConversationRef.current.type === 'GROUP' && 
                  String(selectedConversationRef.current.id) === String(message.conversationId)
                )
            );
            
            // Nếu cuộc trò chuyện đã tồn tại, cập nhật nó
            if (existingConversationIndex !== -1) {
                console.log("Cập nhật cuộc trò chuyện hiện có:", prevConversations[existingConversationIndex].id);
                
                const updatedConversations = [...prevConversations];
                updatedConversations[existingConversationIndex] = {
                    ...updatedConversations[existingConversationIndex],
                    lastMessage: message.content,
                    lastMessageContent: message.content, // Thêm trường mới để hỗ trợ tìm kiếm
                    lastActivity: new Date().toISOString(),
                    unreadCount: isSelected ? 0 : (updatedConversations[existingConversationIndex].unreadCount || 0) + 1
                };
                
                // Di chuyển cuộc trò chuyện lên đầu
                const conversationToMove = updatedConversations.splice(existingConversationIndex, 1)[0];
                return [conversationToMove, ...updatedConversations];
            } 
            // Nếu là cuộc trò chuyện mới (chưa có trong danh sách)
            else if (senderId === String(user.keycloakId) || receiverId === String(user.keycloakId)) {
                console.log("Tạo cuộc trò chuyện mới từ tin nhắn");
                
                // Xác định là cuộc trò chuyện 1-1
                const otherUserId = senderId === String(user.keycloakId) ? receiverId : senderId;
                
                // Lấy thông tin người dùng
                let userInfo = { body: { firstName: 'Người dùng', lastName: `(${otherUserId.substring(0, 8)})` } };
                try {
                    const token = getCookie("access_token");
                    const fetchedUser = getUserbyKeycloakId(token, otherUserId);
                    if (fetchedUser && fetchedUser.body) {
                        userInfo = fetchedUser;
                    }
                } catch (error) {
                    console.error("Không thể lấy thông tin người dùng:", error);
                }
                
                // Tạo cuộc trò chuyện mới từ tin nhắn
                const newConversation = {
                    id: message.conversationId || `conv_${Date.now()}`,
                    type: 'ONE_TO_ONE',
                    participants: [otherUserId],
                    lastMessage: message.content,
                    lastMessageContent: message.content,
                    lastActivity: new Date().toISOString(),
                    unreadCount: isSelected ? 0 : 1,
                    users: userInfo  // Thêm thông tin users
                };
                
                // Thêm cuộc trò chuyện mới vào đầu danh sách
                return [newConversation, ...prevConversations];
            }
            
            return prevConversations;
        });
    };

    // Xử lý khi người dùng chọn một cuộc trò chuyện
    const handleSelectConversation = async (conversation) => {
        try {
            if (!conversation.users) {
                conversation = await enrichConversationWithUsers(conversation);
            }
          setSelectedConversation(conversation);
          setLoadingMessages(true);
          
          // Hủy subscription cũ nếu có
          if (currentGroupSubscription.current) {
            currentGroupSubscription.current.unsubscribe();
            currentGroupSubscription.current = null;
          }
          
          let messagesData = [];
          
          // Nếu là cuộc trò chuyện có sẵn (không phải tạm thời)
          if (conversation.id && !conversation.isTemporary) {
            // Lấy tin nhắn dựa vào conversationId
            messagesData = await chatService.getConversationMessages(conversation.id);
            
            // Đánh dấu tất cả tin nhắn đã đọc
            if (conversation.type === 'ONE_TO_ONE') {
              const otherUserId = conversation.participants[0];
              await chatService.markAllAsRead(otherUserId, user.keycloakId);
            }
          } 
          // Nếu là cuộc trò chuyện tạm (mới bắt đầu với người dùng)
          else if (conversation.type === 'ONE_TO_ONE') {
            // Kiểm tra xem có tin nhắn cũ với người này không
            const otherUserId = conversation.participants[0];
            try {
              messagesData = await chatService.getPrivateConversation(
                user.keycloakId, 
                otherUserId
              );
            } catch (error) {
                console.error("Lỗi khi lấy tin nhắn cũ:", error);
                messagesData = [];
            }
          }
          
          // Cập nhật messages state và scroll xuống
          setMessages(messagesData);
          
          // Đăng ký nhận tin nhắn mới nếu là group chat
          if (conversation.type === 'GROUP' && connected) {
            currentGroupSubscription.current = chatService.subscribeToGroupMessages(
              conversation.id, 
              (groupMessage) => {
                setMessages(prev => [...prev, groupMessage]);
              }
            );
          }
          
          // Lấy thông tin người dùng cho ChatWindow
          let chatUser = selectedUser;
          if (conversation.type === 'ONE_TO_ONE' && conversation.users?.body) {
            chatUser = {
              id: conversation.participants[0],
              keycloakId: conversation.users.body.keycloakId,
              firstName: conversation.users.body.firstName,
              lastName: conversation.users.body.lastName,
              image: conversation.users.body.image
            };
          } else if (conversation.type === 'GROUP') {
            chatUser = {
              id: conversation.id,
              name: conversation.name || conversation.users?.groupName || 'Nhóm không tên',
              isGroup: true,
              participants: conversation.users?.participants || []
            };
          }
          chatWindowUserRef.current = chatUser;
          setChatWindowUser(chatUser);
          setLoadingMessages(false);
        } catch (error) {
          console.error("Lỗi khi tải tin nhắn:", error);
          setError("Không thể tải tin nhắn. Vui lòng thử lại sau.");
          setLoadingMessages(false);
        }
      };

    // Xử lý gửi tin nhắn mới
    const handleSendMessage = async (messageData) => {
        try {
            const msgData = typeof messageData === 'string' 
                ? { content: messageData } 
                : messageData;
            
            console.log("Gửi tin nhắn:", selectedConversation);

            if (!msgData.content || !selectedConversation) {
                console.error("Missing message content or selected conversation");
                return;
            }

            let tempId = null;
            let receiverId = null;
            if(selectedUser){
                tempId = `temp-${Date.now()}`;
                receiverId = selectedUser.id;
            }
            if(chatWindowUser){
                tempId = `temp-${Date.now()}`;
                receiverId = selectedConversation.users.body.keycloakId;
            }

            // Optimistic update - Hiển thị tin nhắn ngay lập tức trong UI
            const tempMessage = {
                tempId: tempId,
                senderId: user.keycloakId,
                receiverId: receiverId,
                content: msgData.content,
                timestamp: new Date().toISOString(),
                status: 'SENDING' // Trạng thái SENDING cho đến khi có phản hồi từ server
            };
            
            // Cập nhật UI ngay lập tức (không đợi phản hồi server)
            setMessages(prev => [...prev, tempMessage]);
            
            let sentMessage;
            
            // Gửi tin nhắn đến server
            if (selectedConversation.type === 'GROUP') {
                sentMessage = await chatService.sendGroupMessage(
                    selectedConversation.id,
                    msgData.content
                );
            } else {
                // Gửi tin nhắn private
                sentMessage = await chatService.sendPrivateMessage(
                    receiverId,
                    msgData.content
                );
            }
            
            console.log('Tin nhắn đã gửi thành công:', sentMessage);
            
            // Cập nhật UI với trạng thái đã gửi
            setMessages(prev => 
                prev.map(m => 
                    m.tempId === tempId 
                        ? { ...m, id: sentMessage.id, status: 'SENT', timestamp: sentMessage.timestamp } 
                        : m
                )
            );
            
            // Xử lý cuộc trò chuyện tạm thời
            if (selectedConversation.isTemporary) {
                try {
                    // Tải lại danh sách hoặc tạo mới conversation nếu cần
                    const updatedConversations = await chatService.getUserConversations();
                    
                    const newCreatedConv = updatedConversations.find(conv => 
                        conv.type === 'ONE_TO_ONE' && 
                        conv.participants.some(id => id === receiverId)
                    );
                    
                    if (newCreatedConv) {
                        // Nếu server đã tạo conversation, cập nhật UI
                        setConversations(updatedConversations);
                        setSelectedConversation(newCreatedConv);
                    } else {
                        // Tạo mới nếu server không tự tạo
                        const newConv = {
                            id: sentMessage.conversationId || `conv_${Date.now()}`,
                            type: 'ONE_TO_ONE',
                            participants: [receiverId],
                            participantDetails: selectedConversation.users,
                            lastMessage: msgData.content,
                            lastActivity: new Date().toISOString(),
                            unreadCount: 0
                        };
                        
                        setConversations(prev => [newConv, ...prev]);
                        setSelectedConversation(newConv);
                    }
                } catch (error) {
                    console.error("Lỗi khi cập nhật cuộc trò chuyện mới:", error);
                }
            }
            
            // Cập nhật danh sách cuộc trò chuyện
            updateConversationWithNewMessage({
                ...sentMessage,
                tempId: tempId
            });
            
        } catch (error) {
            console.error('Lỗi khi gửi tin nhắn:', error);
            
            // Đánh dấu tin nhắn lỗi trong UI
            setMessages(prev => 
                prev.map(m => 
                    m.tempId === tempId 
                        ? { ...m, status: 'ERROR' } 
                        : m
                )
            );
            
            setError('Không thể gửi tin nhắn. Vui lòng thử lại sau.');
        }
    };
    
    // Xử lý tạo cuộc trò chuyện mới
    const handleCreateConversation = async (type, participants, name = '') => {
        try {
            // Kiểm tra participants
            if (!participants || participants.length === 0) {
                throw new Error("Không thể tạo cuộc trò chuyện: Thiếu thông tin người tham gia");
            }
            
            let newConversation;
            
            if (type === 'GROUP') {
                // Tạo nhóm mới
                newConversation = await chatService.createGroupConversation(name, participants);
            } else {
                // Lấy hoặc tạo cuộc trò chuyện một-một
                newConversation = await chatService.getPrivateConversation(user.keycloakId, participants[0]);
            }
            if (!newConversation.participants || newConversation.participants.length === 0) {
                console.log("API trả về cuộc trò chuyện không có participants, bổ sung...");
                newConversation = {
                    ...newConversation,
                    participants: [...participants]
                };
            }
            // Đảm bảo cuộc trò chuyện mới có trường participants
            if (!newConversation.participants || newConversation.participants.length === 0) {
                console.log("API trả về cuộc trò chuyện không có participants, bổ sung...");
                newConversation = {
                    ...newConversation,
                    participants: [...participants]
                };
            }
            
            // Thêm cuộc trò chuyện mới vào danh sách
            setConversations(prev => [newConversation, ...prev]);
            
            // Chọn cuộc trò chuyện mới
            handleSelectConversation(newConversation);
            
            return newConversation;
        } catch (error) {
            console.error("Lỗi khi tạo cuộc trò chuyện:", error);
            setError("Không thể tạo cuộc trò chuyện. Vui lòng thử lại sau.");
            return null;
        }
    };
    const getEffectiveUser = () => {
        // Kiểm tra chatWindowUser từ state
        if (chatWindowUser) return chatWindowUser;
        
        // Kiểm tra chatWindowUserRef từ ref
        if (chatWindowUserRef.current) return chatWindowUserRef.current;
        
        // Kiểm tra selectedUser từ props
        if (selectedUser) return selectedUser;
        
        // Trích xuất thông tin từ selectedConversation
        if (selectedConversation) {
          if (selectedConversation.type === 'ONE_TO_ONE' && selectedConversation.users?.body) {
            return {
              id: selectedConversation.participants?.[0] || 'unknown',
              keycloakId: selectedConversation.users.body.keycloakId || 'unknown',
              firstName: selectedConversation.users.body.firstName || 'Người dùng',
              lastName: selectedConversation.users.body.lastName || '',
              image: selectedConversation.users.body.image
            };
          } else if (selectedConversation.type === 'GROUP') {
            return {
              id: selectedConversation.id || 'unknown-group',
              name: selectedConversation.name || selectedConversation.users?.groupName || 'Nhóm không tên',
              isGroup: true,
              participants: selectedConversation.users?.participants || []
            };
          }
        }
        
        // Fallback cuối cùng
        return {
          id: 'unknown',
          firstName: 'Người dùng',
          lastName: 'Không xác định'
        };
      };
    return (
        <div className="flex h-full">
            {/* Danh sách cuộc trò chuyện - chiếm 1/3 màn hình */}
            <div className="w-1/3 border-r border-gray-200">
                <ConversationList 
                    conversations={conversations}
                    loading={loading}
                    selectedId={selectedConversation?.id}
                    onSelectConversation={handleSelectConversation}
                    onCreateConversation={async (type, participants, name) => {
                        // Khi tạo cuộc trò chuyện mới từ ConversationList
                        if (type === 'ONE_TO_ONE' && participants.length > 0) {
                            const tempConv = {
                                id: `temp_${Date.now()}`,
                                type: 'ONE_TO_ONE',
                                participants: [participants[0]],
                                isTemporary: true
                            };
                            
                            // Làm giàu conversation với thông tin users
                            const enrichedTempConv = await enrichConversationWithUsers(tempConv);
                            
                            setSelectedConversation(enrichedTempConv);
                            setMessages([]);
                            return enrichedTempConv;
                        } else {
                            // Xử lý tạo nhóm như bình thường
                            return handleCreateConversation(type, participants, name);
                        }
                    }}
                    connected={connected}
                />
            </div>
            
            {/* Cửa sổ trò chuyện - chiếm 2/3 màn hình */}
            <div className="w-2/3">
                {error && (
                    <div className="p-3 bg-red-100 text-red-700 rounded mb-2">
                        {error}
                    </div>
                )}
                {loadingMessages && (
                    <div className="flex justify-center items-center h-16 bg-gray-50">
                        <span className="animate-pulse">Đang tải tin nhắn...</span>
                    </div>
                )}
                {selectedConversation ? (
                    <ChatWindow 
                        conversation={selectedConversation}
                        messages={messages}
                        loading={loadingMessages}
                        onSendMessage={handleSendMessage}
                        currentUserId={user?.keycloakId}
                        selectedUser={getEffectiveUser()}
                     />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                    
                        <div className="relative text-xl font-medium text-gray-600 animate-typing">
                            Chọn một cuộc trò chuyện để bắt đầu
                        </div>

                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-20 w-20 text-indigo-400 icon-soft-pulse" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChatPage;