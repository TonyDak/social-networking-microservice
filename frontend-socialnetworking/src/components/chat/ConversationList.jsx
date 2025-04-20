import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import SearchHeader from "../SearchHeader";
import { useUser } from "../../contexts/UserContext";
import { getUserbyKeycloakId } from "../../services/userService";
import { getCookie } from "../../services/apiClient";

function ConversationList({
  conversations,
  loading,
  selectedId,
  onSelectConversation,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [conversationsWithNames, setConversationsWithNames] = useState([]);
  const { user } = useUser(); 
  const token = getCookie("access_token"); // Lấy token từ cookie

  useEffect(() => {
    async function loadDisplayNames() {
      const updatedConversations = await Promise.all(
        conversations.map(async (conversation) => {
          const users = await getConversation(conversation);
          return {
            ...conversation,
            users,
          };
        })
      );
      setConversationsWithNames(updatedConversations);
    }
    
    if (conversations.length > 0 && user) {
      loadDisplayNames();
    } else {
      setConversationsWithNames([]);
    }
  }, [conversations, user, token]);

  const getConversation = async (conversation) => {
    if (conversation.type === 'GROUP') {
        // Fix empty block statement
        if (conversation.name) {
            return { groupName: conversation.name };
        }
        
        // If no group name, fetch all participants
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
                isGroup: true,
                groupName: conversation.name || 'Nhóm không tên',
                participants: participantsInfo
            };
        } catch (error) {
            console.error("Error fetching group participants:", error);
            return { groupName: 'Nhóm không xác định' };
        }
    } else if (conversation.type === 'ONE_TO_ONE') {
        // Trong cuộc trò chuyện 1-1, lấy ID người kia (không phải người dùng hiện tại)
        const otherParticipantId = conversation.participants.find(id => id !== user.keycloakId);
        
        if (!otherParticipantId) {
            return { body: { firstName: 'Người dùng', lastName: 'không xác định' } };
        }
        try {
            //dùng hàm getUserByKeycloak để lấy thông tin cần thiết
            const otherParticipant = await getUserbyKeycloakId(token, otherParticipantId);
            if (otherParticipant && otherParticipant.body) {
                return otherParticipant;
            }
        } catch (error) {
            console.error("Error fetching user:", error);
        }
        
        // Fallback nếu không lấy được thông tin
        return { body: { firstName: 'Người dùng', lastName: `(${otherParticipantId.substring(0, 8)})` } };
    }
    
    return { body: { firstName: 'Cuộc trò chuyện', lastName: 'không xác định' } };
  };

  // Cải tiến filteredConversations
  const filteredConversations = conversationsWithNames
    .filter((conv) => {
      // Xử lý tìm kiếm
      let matchesSearch = true;

      if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        
        // Tìm trong tên hiển thị
        let nameMatches = false;
        
        if (conv.type === 'GROUP') {
          // Tìm trong tên nhóm hoặc tên của tất cả thành viên
          if (conv.users.groupName) {
            nameMatches = conv.users.groupName.toLowerCase().includes(term);
          } 
          
          if (!nameMatches && conv.users.participants) {
            nameMatches = conv.users.participants.some(p => 
              (p.body?.firstName + ' ' + p.body?.lastName).toLowerCase().includes(term)
            );
          }
        } else {
          // Tìm trong tên người dùng 1-1
          const firstName = conv.users?.body?.firstName || '';
          const lastName = conv.users?.body?.lastName || '';
          nameMatches = (firstName + ' ' + lastName).toLowerCase().includes(term);
        }

        // Tìm trong tin nhắn cuối cùng
        const messageMatches =
          (conv.lastMessageContent || "").toLowerCase().includes(term) || false;

        // Kết hợp các điều kiện tìm kiếm
        matchesSearch = nameMatches || messageMatches;
      }

      // Lọc theo tin chưa đọc
      const matchesUnread =
        activeFilter === "unread" ? conv.unreadCount > 0 : true;

      return matchesSearch && matchesUnread;
    })
    // Sắp xếp theo thời gian hoạt động gần nhất
    .sort((a, b) => {
      // Ưu tiên tin nhắn chưa đọc lên đầu
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;

      // Sau đó sắp xếp theo thời gian gần nhất
      return new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0);
    }
  );

  const formatTime = (date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: vi });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <SearchHeader
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        placeholder="Tìm kiếm"
        onAddFriend={() => {}}
        onCreateGroup={() => {}}
      />

      {/* Filter options */}
      <div className="flex px-4 py-2 border-b border-gray-200 bg-gray-50">
        <button
          className={`mr-4 px-3 py-1 text-sm rounded-full transition-colors ${
            activeFilter === "all"
              ? "bg-indigo-100 text-indigo-800 font-medium"
              : "text-gray-600 hover:bg-gray-200"
          }`}
          onClick={() => setActiveFilter("all")}
        >
          Tất cả
        </button>
        <button
          className={`px-3 py-1 text-sm rounded-full transition-colors ${
            activeFilter === "unread"
              ? "bg-indigo-100 text-indigo-800 font-medium"
              : "text-gray-600 hover:bg-gray-200"
          }`}
          onClick={() => setActiveFilter("unread")}
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
            {filteredConversations.map((conversation) => (
              <li
                key={conversation.id}
                onClick={() => onSelectConversation(conversation)}
                className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                  selectedId === conversation.id ? "bg-indigo-50" : ""
                }`}
              >
                <div className="flex items-center">
                  <div className="w-12 h-12 mr-3 rounded-full bg-indigo-100 flex items-center justify-center">
                    {conversation.type === "GROUP" ? (
                      <span className="text-lg font-medium text-indigo-600">
                        {conversation.users?.groupName?.charAt(0) || "G"}
                      </span>
                    ) : (
                      <span className="text-lg font-medium text-indigo-600">
                        {(conversation.users?.body?.firstName?.charAt(0) || "") + 
                         (conversation.users?.body?.lastName?.charAt(0) || "U")}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-medium">
                        {conversation.type === "GROUP" 
                          ? conversation.users?.groupName || "Nhóm không tên"
                          : (conversation.users?.body?.firstName || "") + " " + 
                            (conversation.users?.body?.lastName || "")}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {conversation.lastActivity &&
                          formatTime(conversation.lastActivity)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {conversation.lastMessageContent || "Chưa có tin nhắn"}
                    </p>
                  </div>
                  {conversation.unreadCount > 0 && (
                    <div className="relative ml-2">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span>
                      </span>
                    </div>
                  )}
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