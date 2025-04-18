import { useState, useEffect, useRef } from 'react';
import ConversationList from '../components/chat/ConversationList';
import ChatWindow from '../components/chat/ChatWindow';
import { useUser } from '../contexts/UserContext';
import chatService from '../services/chatService';

function ChatPage({selectedUser, connected, websocketError}) {
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [error, setError] = useState(websocketError);
    const { user } = useUser();
    // Theo dõi subscription hiện tại để hủy khi cần
    const currentGroupSubscription = useRef(null);
    const processedUserRef = useRef(null);

    // Xử lý khi selectedUser thay đổi (từ tab FriendsList)
    useEffect(() => {
        const handleSelectedUser = async () => {
            if (selectedUser && user && connected && selectedUser.id !== processedUserRef.current) {
                try {
                    processedUserRef.current = selectedUser.id; // Đánh dấu đã xử lý
                    setLoadingMessages(true);
                    
                    console.log(`Mở cuộc trò chuyện với người dùng: ${selectedUser.name} (${selectedUser.id})`);
                    
                    // Tìm cuộc trò chuyện hiện có với người dùng này
                    const existingConv = conversations.find(conv => 
                        conv.type === 'ONE_TO_ONE' && 
                        conv.participants.some(id => id === selectedUser.id)
                    );
                    
                    if (existingConv) {
                        // Nếu đã có cuộc trò chuyện, chọn nó
                        console.log("Tìm thấy cuộc trò chuyện hiện có:", existingConv.id);
                        handleSelectConversation(existingConv);
                    } else {
                        // Nếu chưa có, tạo cuộc trò chuyện mới
                        console.log("Tạo cuộc trò chuyện mới với:", selectedUser.id);
                        await handleCreateConversation('ONE_TO_ONE', [selectedUser.id]);
                    }
                    
                    setLoadingMessages(false);
                } catch (error) {
                    console.error("Lỗi khi mở cuộc trò chuyện với người dùng:", error);
                    setError("Không thể mở cuộc trò chuyện với người dùng đã chọn.");
                    setLoadingMessages(false);
                }
            }
        };
        
        if (conversations.length > 0) { // Chỉ xử lý khi danh sách cuộc trò chuyện đã được tải
            handleSelectedUser();
        }
    }, [selectedUser, user, connected, conversations]);

    useEffect(() => {
        if (websocketError) {
            setError(websocketError);
        }
    }, [websocketError]);

    useEffect(() => {
        if (user && connected) {
            // Chỉ fetch conversations khi đã kết nối
            fetchConversations();

            // Đăng ký nhận tin nhắn cá nhân
            chatService.onMessage('private', (message) => {
                console.log('ChatPage nhận tin nhắn mới:', message);
                
                // Cập nhật danh sách tin nhắn nếu thuộc về cuộc trò chuyện hiện tại
                if (selectedConversation) {
                    const isCurrentConversation = 
                        (selectedConversation.type === 'ONE_TO_ONE' && 
                        (message.senderId === selectedConversation.participants[0] || 
                         message.receiverId === selectedConversation.participants[0])) || 
                        (selectedConversation.type === 'GROUP' && 
                         message.conversationId === selectedConversation.id);
                    
                    if (isCurrentConversation) {
                        setMessages(prev => [...prev, message]);
                        // Đánh dấu là đã đọc
                        chatService.markMessageAsRead(message.id);
                    }
                }
                
                // Cập nhật danh sách cuộc trò chuyện
                updateConversationWithNewMessage(message);
            });
        }

        // Ngắt kết nối khi component unmount
        return () => {
            if (currentGroupSubscription.current) {
                currentGroupSubscription.current.unsubscribe();
                currentGroupSubscription.current = null;
            }
            // KHÔNG disconnect ở đây vì kết nối được quản lý ở cấp App
        };
    }, [user, connected]); // Thêm connected vào dependencies

    // Tải danh sách cuộc trò chuyện
    const fetchConversations = async () => {
        try {
            setLoading(true);
            const data = await chatService.getUserConversations();
            setConversations(data);
            setLoading(false);
            
            // Nếu có selectedUser, xử lý sau khi đã tải conversations
            if (selectedUser && user && selectedUser.id !== processedUserRef.current) {
                const existingConv = data.find(conv => 
                    conv.type === 'ONE_TO_ONE' && 
                    conv.participants.some(id => id === selectedUser.id)
                );
                
                if (existingConv) {
                    handleSelectConversation(existingConv);
                } else {
                    handleCreateConversation('ONE_TO_ONE', [selectedUser.id]);
                }
                
                processedUserRef.current = selectedUser.id;
            }
        } catch (error) {
            console.error("Không thể tải danh sách trò chuyện", error);
            setError("Không thể tải danh sách trò chuyện. Vui lòng thử lại sau.");
            setLoading(false);
        }
    };

    // Cập nhật cuộc trò chuyện với tin nhắn mới
    const updateConversationWithNewMessage = (message) => {
        setConversations(prevConversations => {
            return prevConversations.map(conv => {
                // Xác định cuộc trò chuyện cần cập nhật
                const isTargetConversation = 
                    (conv.type === 'ONE_TO_ONE' && 
                    (conv.participants.includes(message.senderId) || 
                     conv.participants.includes(message.receiverId))) ||
                    (conv.type === 'GROUP' && conv.id === message.conversationId);
                
                if (isTargetConversation) {
                    // Kiểm tra xem đây có phải là cuộc trò chuyện đang hiển thị không
                    const isSelected = selectedConversation && conv.id === selectedConversation.id;
                    
                    return {
                        ...conv,
                        lastMessage: message.content,
                        lastActivity: new Date(),
                        // Tăng số tin nhắn chưa đọc nếu không phải cuộc trò chuyện hiện tại
                        unreadCount: isSelected ? 0 : (conv.unreadCount || 0) + 1
                    };
                }
                return conv;
            });
        });
    };

    // Xử lý khi người dùng chọn một cuộc trò chuyện
    const handleSelectConversation = async (conversation) => {
        try {
            setSelectedConversation(conversation);
            setLoadingMessages(true);
            
            // Hủy đăng ký nhóm trước đó nếu có
            if (currentGroupSubscription.current) {
                currentGroupSubscription.current.unsubscribe();
                currentGroupSubscription.current = null;
            }
            
            // Tải tin nhắn cho cuộc trò chuyện được chọn
            let messagesData;
            if (conversation.type === 'GROUP') {
                messagesData = await chatService.getConversationMessages(conversation.id);
                
                // Đăng ký nhận tin nhắn nhóm
                if (connected) {
                    currentGroupSubscription.current = chatService.subscribeToGroupMessages(
                        conversation.id, 
                        (groupMessage) => {
                            setMessages(prev => [...prev, groupMessage]);
                        }
                    );
                }
            } else {
                // Cuộc trò chuyện một-một
                // XỬ LÝ TRƯỜNG HỢP PARTICIPANTS BỊ THIẾU
                let otherUserId;
                
                if (!conversation.participants || conversation.participants.length === 0) {
                    // Nếu không có participants, sử dụng selectedUser nếu có
                    if (selectedUser) {
                        otherUserId = selectedUser.id;
                        // Cập nhật lại conversation để có participants
                        conversation.participants = [otherUserId];
                        setSelectedConversation({...conversation, participants: [otherUserId]});
                    } else {
                        throw new Error("Không thể xác định người nhận tin nhắn");
                    }
                } else {
                    otherUserId = conversation.participants[0];
                }
                
                // Bây giờ otherUserId đã được đảm bảo
                messagesData = await chatService.getPrivateConversation(user.id, otherUserId);
                
                // Đánh dấu tất cả tin nhắn là đã đọc
                await chatService.markAllAsRead(otherUserId, user.id);
            }
            
            setMessages(messagesData);
            
            // Cập nhật cuộc trò chuyện để đặt unreadCount về 0
            setConversations(prevConversations => 
                prevConversations.map(conv => 
                    conv.id === conversation.id 
                        ? { ...conv, unreadCount: 0 } 
                        : conv
                )
            );
            
            setLoadingMessages(false);
        } catch (error) {
            console.error("Lỗi khi tải tin nhắn:", error);
            setError("Không thể tải tin nhắn. Vui lòng thử lại sau.");
            setLoadingMessages(false);
        }
    };

    // Xử lý gửi tin nhắn mới
    const handleSendMessage = async (content) => {
        if (!content.trim() || !selectedConversation || !connected) return;
        
        try {
            // Tạo đối tượng tin nhắn tạm thời để hiển thị ngay
            const tempMessage = {
                id: 'temp-' + Date.now(),
                content,
                senderId: user.id,
                timestamp: new Date(),
                status: 'sending',
                type: 'TEXT'
            };
            
            // Thêm tin nhắn tạm thời vào danh sách
            setMessages(prev => [...prev, tempMessage]);
            
            // Gửi tin nhắn dựa trên loại cuộc trò chuyện
            if (selectedConversation.type === 'GROUP') {
                await chatService.sendGroupMessage(
                    selectedConversation.id,
                    content
                );
            } else {
                // Cuộc trò chuyện một-một
                const receiverId = selectedConversation.participants[0];
                await chatService.sendPrivateMessage(receiverId, content);
            }
            
            // Cập nhật trạng thái tin nhắn tạm thời thành 'sent'
            setMessages(prev => 
                prev.map(msg => 
                    msg.id === tempMessage.id 
                        ? { ...msg, status: 'sent' } 
                        : msg
                )
            );
            
            // Cập nhật lastMessage trong conversations
            setConversations(prev => 
                prev.map(conv => 
                    conv.id === selectedConversation.id
                        ? { ...conv, lastMessage: content, lastActivity: new Date() }
                        : conv
                )
            );
        } catch (error) {
            console.error("Lỗi khi gửi tin nhắn:", error);
            
            // Cập nhật trạng thái tin nhắn tạm thời thành 'failed'
            setMessages(prev => 
                prev.map(msg => 
                    msg.id === tempMessage.id 
                        ? { ...msg, status: 'failed' } 
                        : msg
                )
            );
            
            setError("Không thể gửi tin nhắn. Vui lòng thử lại sau.");
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
                newConversation = await chatService.getPrivateConversation(user.id, participants[0]);
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
    return (
        <div className="flex h-full">
            {/* Danh sách cuộc trò chuyện - chiếm 1/3 màn hình */}
            <div className="w-1/3 border-r border-gray-200">
                <ConversationList 
                    conversations={conversations}
                    loading={loading}
                    selectedId={selectedConversation?.id}
                    onSelectConversation={handleSelectConversation}
                    onCreateConversation={handleCreateConversation}
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
                        currentUserId={user?.id}
                        connected={connected}
                        selectedUser={selectedUser}
                     />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Chọn một cuộc trò chuyện để bắt đầu
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChatPage;