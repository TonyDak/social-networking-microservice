import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

function ConversationList({ conversations, loading, selectedId, onSelectConversation }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' or 'unread'

    const filteredConversations = conversations.filter(conv => {
        // Apply search filter
        const matchesSearch = conv.name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Apply unread filter if selected
        const matchesUnread = activeFilter === 'unread' ? (conv.unreadCount > 0) : true;
        
        return matchesSearch && matchesUnread;
    });

    const formatTime = (date) => {
        return formatDistanceToNow(new Date(date), { addSuffix: true, locale: vi });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tìm kiếm cuộc trò chuyện..."
                    className="w-full py-2 pl-9 pr-4 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
            </div>
            
            {/* Filter options */}
            <div className="flex px-4 py-2 border-b border-gray-200 bg-gray-50">
                <button
                    className={`mr-4 px-3 py-1 text-sm rounded-full transition-colors ${
                        activeFilter === 'all' 
                            ? 'bg-indigo-100 text-indigo-800 font-medium' 
                            : 'text-gray-600 hover:bg-gray-200'
                    }`}
                    onClick={() => setActiveFilter('all')}
                >
                    Tất cả
                </button>
                <button
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        activeFilter === 'unread' 
                            ? 'bg-indigo-100 text-indigo-800 font-medium' 
                            : 'text-gray-600 hover:bg-gray-200'
                    }`}
                    onClick={() => setActiveFilter('unread')}
                >
                    Chưa đọc
                </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                ) : filteredConversations.length > 0 ? (
                    <ul>
                        {filteredConversations.map(conversation => (
                            <li 
                                key={conversation.id} 
                                onClick={() => onSelectConversation(conversation)}
                                className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                                    selectedId === conversation.id ? 'bg-indigo-50' : ''
                                }`}
                            >
                                <div className="flex items-center">
                                    <div className="w-12 h-12 mr-3 rounded-full bg-indigo-100 flex items-center justify-center">
                                        {conversation.type === 'GROUP' ? (
                                            <span className="text-lg font-medium text-indigo-600">
                                                {conversation.name?.charAt(0) || 'G'}
                                            </span>
                                        ) : (
                                            <span className="text-lg font-medium text-indigo-600">U</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <h3 className="font-medium">
                                                {conversation.type === 'GROUP' 
                                                    ? conversation.name 
                                                    : 'Người dùng'}
                                            </h3>
                                            <span className="text-xs text-gray-500">
                                                {conversation.lastActivity && formatTime(conversation.lastActivity)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 truncate">
                                            {conversation.lastMessage}
                                        </p>
                                        {conversation.unreadCount > 0 && (
                                            <span className="inline-flex items-center justify-center w-5 h-5 ml-2 text-xs font-medium text-white bg-indigo-600 rounded-full">
                                                {conversation.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Không có cuộc trò chuyện nào
                    </div>
                )}
            </div>

        </div>
    );
}

export default ConversationList;