import { useState, useEffect, useMemo } from 'react';
import { getUserbyKeycloakId } from '../../services/userService';
import { getCookie } from '../../services/apiClient';
import Profile from '../user/Profile';
import { toast } from 'react-toastify';
import { fi } from 'date-fns/locale';

function FriendsList({ friends = [], searchTerm = '', loading = false, hasMore = false, onLoadMore, onRemoveFriend,setActiveTab,
  setSelectedChatUser }) {
  const [userDetails, setUserDetails] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const token = getCookie('access_token');
  
  // Tải thông tin người dùng khi component mount hoặc khi danh sách bạn bè thay đổi
  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!friends.length) return;
      
      setLoadingUsers(true);
      const details = {};
      
      try {
        // Tạo mảng các promises để tải song song
        const promises = friends.map(async (friend) => {
          try {
            const response = await getUserbyKeycloakId(token, friend.friendId);
            details[friend.friendId] = response.body;
          } catch (error) {
            console.error(`Error fetching user data for ${friend.friendId}:`, error);
          }
        });
        
        await Promise.all(promises);
        setUserDetails(details);
      } catch (error) {
        console.error('Error fetching user details:', error);
      } finally {
        setLoadingUsers(false);
      }
    };
    
    fetchUserDetails();
  }, [friends, token]);

  // Xử lý khi người dùng muốn xóa bạn
  const handleRemoveFriend = (friendId, e) => {
    // Ngăn chặn sự kiện click lan truyền đến thẻ cha
    e.stopPropagation();
    
    // Lấy tên người dùng để hiển thị trong thông báo
    const friend = userDetails[friendId];
    const friendName = friend 
      ? `${friend.firstName || ''} ${friend.lastName || ''}`.trim() || 'Người dùng này'
      : 'Người dùng này';
    
    // Hiển thị toast xác nhận thay vì window.confirm
    toast.info(
      <div className="flex flex-col">
        <div className="font-medium">Xóa khỏi danh sách bạn bè?</div>
        <div className="text-sm mt-1">Bạn có chắc chắn muốn xóa {friendName} khỏi danh sách bạn bè?</div>
        <div className="flex justify-end mt-3 space-x-2">
          <button
            onClick={() => toast.dismiss()}
            className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
          >
            Hủy
          </button>
          <button
            onClick={() => {
              onRemoveFriend && onRemoveFriend(friendId);
              toast.dismiss();
              toast.success(`Đã xóa ${friendName} khỏi danh sách bạn bè`);
            }}
            className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-400"
          >
            Xác nhận
          </button>
        </div>
      </div>,
      {
        position: "top-center",
        autoClose: false,
        hideProgressBar: true,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: false,
        closeButton: false,
        icon: (
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
          </svg>
        )
      }
    );
  };
  
  // Xử lý khi click vào thẻ user để chuyển đến trang message
  const handleUserCardClick = (friendId) => {
    const friend = userDetails[friendId];
    if (!friend) return;
    
    // Đặt người dùng được chọn để chat
    setSelectedChatUser({
      id: friendId,
      keycloakId: friend.keycloakId,
      firstName: friend.firstName || null,
      lastName: friend.lastName || null,
      image: friend.image || null,
    });
    // Chuyển đổi tab sang messages
    setActiveTab('messages');
  };
  
  // Xử lý khi click vào nút xem thông tin
  const handleViewProfile = (friendId, e) => {
    // Ngăn chặn sự kiện click lan truyền đến thẻ cha
    e.stopPropagation();
    
    // Mở modal profile với friendId được chọn
    setSelectedFriendId(friendId);
    setShowProfileModal(true);
  };
  
  // Đóng modal profile
  const handleCloseProfileModal = () => {
    setShowProfileModal(false);
    setSelectedFriendId(null);
  };
  
  // Lọc danh sách bạn bè theo từ khóa tìm kiếm
  const filteredFriends = useMemo(() => {
    if (!searchTerm) return friends;
    
    return friends.filter(friend => {
      const user = userDetails[friend.friendId];
      
      // Nếu chưa tải được thông tin, chỉ lọc theo ID
      if (!user) {
        return friend.friendId.toLowerCase().includes(searchTerm.toLowerCase());
      }
      
      // Lọc theo các trường thông tin
      return (
        user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [friends, userDetails, searchTerm]);
  
  // Hàm hiển thị thông tin người dùng
  const renderUserInfo = (friendId) => {
    const user = userDetails[friendId];
    
    // Nếu chưa tải được thông tin người dùng, hiển thị skeleton
    if (!user) {
      return (
        <div className="flex items-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-gray-200 mr-3"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      );
    }
    
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Người dùng';
    const initials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || 'U'}`;
    
    return (
      <div className="flex items-center">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 mr-3">
          {user.image ? (
            <img src={user.image} alt={fullName} className="w-full h-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-blue-100 text-blue-600 font-medium">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-medium">{fullName}</h3>
          {user.username && (
            <p className="text-sm text-gray-500">@{user.username}</p>
          )}
          {user.email && !user.username && (
            <p className="text-sm text-gray-500">{user.email}</p>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center p-4 bg-white border-b border-gray-200">
        <div className="w-8 h-8 mr-3 rounded-full bg-blue-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
        </div>
        <span className={`font-medium text-gray-700 text-xl`}>
          Danh sách bạn bè <span className="text-sm text-blue-500">({friends.length})</span>
        </span>
      </div>
      
      <div className="px-4 pb-4">
        {loading && friends.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-indigo-500"></div>
          </div>
        ) : filteredFriends.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {filteredFriends.map(friend => (
              <div 
                key={friend.friendId} 
                className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleUserCardClick(friend.friendId)}
              >
                {renderUserInfo(friend.friendId)}
                
                <div className="flex mt-4 space-x-2">
                  <button
                    onClick={(e) => handleViewProfile(friend.friendId, e)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded flex items-center justify-center transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    Xem thông tin
                  </button>
                  <button
                    onClick={(e) => handleRemoveFriend(friend.friendId, e)}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded flex items-center justify-center transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M11 6a3 3 0 11-6 0 3 3 0 016 0zM14 17a6 6 0 00-12 0h12zM13 8a1 1 0 100 2h4a1 1 0 100-2h-4z" />
                    </svg>
                    Xóa bạn
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-8 text-center mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="mt-3 text-lg font-medium text-gray-900">Chưa có bạn bè</h3>
            <p className="mt-2 text-gray-500">
              {searchTerm ? 'Không tìm thấy bạn bè nào khớp với tìm kiếm' : 'Bạn chưa có bạn bè nào. Hãy kết bạn để mở rộng mạng lưới của mình!'}
            </p>
          </div>
        )}
        
        {/* Nút tải thêm */}
        {!loading && !loadingUsers && hasMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={onLoadMore}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Tải thêm
            </button>
          </div>
        )}
        
        {/* Spinner khi tải thêm */}
        {loading && friends.length > 0 && (
          <div className="flex justify-center my-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-500"></div>
          </div>
        )}
      </div>
      
      {/* Modal hiển thị Profile */}
      {showProfileModal && selectedFriendId && (
        <>
          {/* Overlay để làm mờ toàn bộ nội dung phía sau */}
          <div 
            className="fixed inset-0 backdrop-brightness-20 transition-opacity z-40"
            onClick={handleCloseProfileModal}
          ></div>
          
          {/* Modal container nổi lên trên lớp overlay */}
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl relative">
                <div className="absolute top-0 right-0 pt-4 pr-4">
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={handleCloseProfileModal}
                  >
                    <span className="sr-only">Đóng</span>
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="max-h-[80vh] overflow-y-auto p-6"
                  style={{ '-ms-overflow-style': 'none', 'scrollbarWidth': 'none' }} 
                >
                  <Profile 
                    user={userDetails[selectedFriendId]} 
                    showEditButton={false} 
                    isFriend={true}
                    onSendMessage={() => {
                      handleCloseProfileModal();
                      handleUserCardClick(selectedFriendId);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default FriendsList;