import { useState, useEffect } from 'react';
import ConversationList from '../components/chat/ConversationList';
import ChatWindow from '../components/chat/ChatWindow';
import { useUser } from '../contexts/UserContext';

function ChatPage() {
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useUser();

    useEffect(() => {
        // Fetch user's conversations when component mounts
        const fetchConversations = async () => {
            try {
                //Replace with actual API call
                setLoading(true);
                // const response = await fetchUserConversations(user.id);
                // setConversations(response.data);
                
                // Mocked data for now
                setConversations([
                    { id: '1', name: 'Nhóm chat gia đình', type: 'GROUP', lastMessage: 'Ai về ăn cơm không?', lastActivity: new Date(), unreadCount: 3 },
                    { id: '2', type: 'ONE_TO_ONE', participants: ['user2'], lastMessage: 'Hẹn gặp lúc 3h nhé', lastActivity: new Date(), unreadCount: 0 }
                ]);
                setLoading(false);
            } catch (error) {
                console.error("Không thể tải danh sách trò chuyện", error);
                setLoading(false);
            }
        };

        if (user) {
            fetchConversations();
        }
    }, [user]);

    const handleSelectConversation = (conversation) => {
        setSelectedConversation(conversation);
    };

    return (
        <div className="flex h-full">
            {/* Conversation list - 1/3 of the screen */}
            <div className="w-1/3 border-r border-gray-200">
                <ConversationList 
                    conversations={conversations}
                    loading={loading}
                    selectedId={selectedConversation?.id}
                    onSelectConversation={handleSelectConversation}
                />
            </div>
            
            {/* Chat window - 2/3 of the screen */}
            <div className="w-2/3">
                {selectedConversation ? (
                    <ChatWindow conversation={selectedConversation} />
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