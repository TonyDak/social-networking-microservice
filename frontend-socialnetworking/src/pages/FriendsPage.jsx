import { useState, useEffect } from "react";
import { useUser } from "../contexts/UserContext";
import OptionList from "../components/friend/OptionList";
import FriendsList from "../components/friend/FriendsList";
import GroupsList from "../components/friend/GroupsList";
import FriendRequests from "../components/friend/FriendRequests";
import { getFriendsList, getPendingFriendRequests, acceptFriendRequest, rejectFriendRequest, removeFriend } from "../services/friendService";
import chatService from '../services/chatService';
import { toast } from "react-toastify";

function FriendsPage({ setActiveTab, setSelectedChatUser }) {
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useUser();
  const [activeOption, setActiveOption] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const pageSize = 20;

  // Tải danh sách bạn bè khi component mount hoặc khi page thay đổi
  useEffect(() => {
    const loadFriends = async () => {
      if (!user?.keycloakId) return;
      
      try {
        setLoading(true);
        setError(null);
        const data = await getFriendsList(user.keycloakId, page, pageSize);
        
        // Nếu là trang đầu tiên, reset danh sách
        if (page === 0) {
          setFriends(data);
        } else {
          // Nếu không, thêm vào danh sách hiện tại
          setFriends(prev => [...prev, ...data]);
        }
        
        // Kiểm tra xem còn dữ liệu để tải không
        setHasMore(data.length === pageSize);
      } catch (err) {
        console.error("Error loading friends:", err);
        setError("Không thể tải danh sách bạn bè. Vui lòng thử lại sau.");
        toast.error("Không thể tải danh sách bạn bè");
      } finally {
        setLoading(false);
      }
    };

    if (activeOption === 'friends') {
      loadFriends();
    }
  }, [user?.keycloakId, page, activeOption]);

  // Tải yêu cầu kết bạn khi chuyển sang tab "friendRequests"
  useEffect(() => {
    const loadFriendRequests = async () => {
      if (!user?.keycloakId || activeOption !== 'friendRequests') return;
      
      try {
        setLoading(true);
        const data = await getPendingFriendRequests(user.keycloakId);
        setFriendRequests(data);
      } catch (err) {
        console.error("Error loading friend requests:", err);
        toast.error("Không thể tải yêu cầu kết bạn");
      } finally {
        setLoading(false);
      }
    };

    loadFriendRequests();
  }, [user?.keycloakId, activeOption]);


  // Xử lý tải thêm
  const handleLoadMore = () => {
    setPage(prevPage => prevPage + 1);
  };

  useEffect(() => {
    const fetchGroups = async () => {
      if (!user?.keycloakId || activeOption !== 'groups') return;
      
      try {
        setLoadingGroups(true);
        const data = await chatService.getUserConversations(user.keycloakId);
        setGroups(data);
      } catch (err) {
        console.error("Error loading groups:", err);
        toast.error("Không thể tải danh sách nhóm");
      } finally {
        setLoadingGroups(false);
      }
    };

    fetchGroups();
  }, [user?.keycloakId, activeOption]);
  
  // Xử lý rời nhóm
  const handleLeaveGroup = async (groupId) => {
    try {
      await chatService.removeMemberFromGroupChat(groupId, user.keycloakId);
      setGroups(prev => prev.filter(group => group.id !== groupId));
      toast.success("Đã rời khỏi nhóm");
    } catch (err) {
      console.error("Error leaving group:", err);
      toast.error("Không thể rời khỏi nhóm");
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      await removeFriend(user.keycloakId, friendId);
      setFriends(prev => prev.filter(friend => friend.friendId !== friendId));
      toast.success("Đã xóa bạn bè");
    } catch (err) {
      console.error("Error removing friend:", err);
      toast.error("Không thể xóa bạn bè");
    }
  };
  
  // Xử lý mở chat nhóm
  const handleOpenGroupChat = (groupId) => {
    // Thay vì sử dụng window.location, chỉ cần cập nhật state
    setActiveTab('messages');
    // Có thể cập nhật selectedChatGroup nếu cần
  };

  const renderContent = () => {
    switch (activeOption) {
      case "friends":
        return (
          <FriendsList 
            friends={friends} 
            searchTerm={searchTerm}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            onRemoveFriend={handleRemoveFriend}
            setActiveTab={setActiveTab}
            setSelectedChatUser={setSelectedChatUser}
          />
        );
      case "groups":
        return <GroupsList 
        groups={groups}
        searchTerm={searchTerm}
        loading={loadingGroups}
        onOpenChat={handleOpenGroupChat}
        onLeaveGroup={handleLeaveGroup}
      />;
      case "friendRequests":
        return (
          <FriendRequests 
            requests={friendRequests}
            loading={loading}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest} 
          />
        );
      default:
        return <FriendsList friends={friends} />;
    }
  };

  const handleAcceptRequest = async (receiverId ,requestId) => {
    try {
      await acceptFriendRequest(receiverId,requestId);
      setFriendRequests(prevRequests => 
        prevRequests.filter(request => request.id !== requestId)
      );
      toast.success("Đã chấp nhận lời mời kết bạn");
    } catch (error) {
      console.error('Không thể chấp nhận lời mời kết bạn:', error);
      toast.error("Không thể chấp nhận lời mời kết bạn");
    }
  };
  
  const handleRejectRequest = async (receiverId ,requestId) => {
    try {
      await rejectFriendRequest(receiverId ,requestId);
      setFriendRequests(prevRequests => 
        prevRequests.filter(request => request.id !== requestId)
      );
      toast.success("Đã từ chối lời mời kết bạn");
    } catch (error) {
      console.error('Không thể từ chối lời mời kết bạn:', error);
      toast.error("Không thể từ chối lời mời kết bạn");
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-1/3 border-r border-gray-200">
        <OptionList
          activeOption={activeOption}
          setActiveOption={setActiveOption}
          onSearch={(term) => setSearchTerm(term)}
        />
      </div>
      <div className="w-2/3 p-4">
        {renderContent()}
      </div>
    </div>
  );
}

export default FriendsPage;