import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../contexts/UserContext';
import ChatHeader from './ChatHeader';
import MessageInput from './MessageInput';
import Message from './Message';

function ChatWindow({ conversation }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useUser();
    const messagesEndRef = useRef(null);

    // Scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        // Fetch messages when conversation changes
        const fetchMessages = async () => {
            try {
                setLoading(true);
                // TODO: Replace with actual API call
                // const response = await getMessages(conversation.id);
                // setMessages(response.data);
                
                // Mocked data
                setTimeout(() => {
                    setMessages([
                        { id: '1', senderId: 'other-user', content: 'Xin chào!', timestamp: new Date(Date.now() - 3600000) },
                        { id: '2', senderId: user.id, content: 'Chào bạn, bạn khỏe không?', timestamp: new Date(Date.now() - 3500000) },
                        { id: '3', senderId: 'other-user', content: 'Tôi khỏe, cảm ơn bạn.', timestamp: new Date(Date.now() - 3400000) },
                        { id: '4', senderId: user.id, content: 'Bạn có rảnh lúc 3h chiều không?', timestamp: new Date(Date.now() - 1800000) },
                        { id: '5', senderId: 'other-user', content: 'Có, tôi rảnh!', timestamp: new Date(Date.now() - 1700000) },
                    ]);
                    setLoading(false);
                }, 1000);
            } catch (error) {
                console.error("Không thể tải tin nhắn", error);
                setLoading(false);
            }
        };

        if (conversation) {
            fetchMessages();
        }
    }, [conversation, user.id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (content) => {
        if (!content.trim()) return;
        
        try {
            // TODO: Replace with actual API call
            // await sendMessage({
            //     conversationId: conversation.id,
            //     content,
            //     senderId: user.id,
            //     receiverId: conversation.type === 'ONE_TO_ONE' ? conversation.participants[0] : null
            // });
            
            // Optimistically add message to UI
            const newMessage = {
                id: `temp-${Date.now()}`,
                senderId: user.id,
                content,
                timestamp: new Date(),
                status: 'SENDING'
            };
            
            setMessages(prev => [...prev, newMessage]);
            
            // In real implementation, this would be updated when websocket confirms delivery
            setTimeout(() => {
                setMessages(prev => 
                    prev.map(msg => 
                        msg.id === newMessage.id 
                            ? {...msg, id: `${Date.now()}`, status: 'SENT'} 
                            : msg
                    )
                );
            }, 1000);
            
        } catch (error) {
            console.error("Không thể gửi tin nhắn", error);
            // Update message status to failed
            setMessages(prev => 
                prev.map(msg => 
                    msg.id === newMessage.id 
                        ? {...msg, status: 'FAILED'} 
                        : msg
                )
            );
        }
    };

    return (
        <div className="flex flex-col h-full">
            <ChatHeader conversation={conversation} />
            
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                ) : messages.length > 0 ? (
                    <div className="space-y-4">
                        {messages.map(message => (
                            <Message 
                                key={message.id} 
                                message={message} 
                                isOwnMessage={message.senderId === user.id} 
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!
                    </div>
                )}
            </div>
            
            <MessageInput onSendMessage={handleSendMessage} />
        </div>
    );
}

export default ChatWindow;