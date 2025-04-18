import { useState, useEffect } from 'react';
import { getFriendsList } from '../../services/friendService';
import { useUser } from '../../contexts/UserContext';
import { toast } from 'react-toastify';
import chatService from '../../services/chatService';


function CreateGroupDialog({ isOpen, onClose }) {
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const { user } = useUser();

  // Tải danh sách bạn bè khi dialog mở
  useEffect(() => {
    if (isOpen && user?.id) {
      loadFriends();
    }
  }, [isOpen, user?.id]);

  // Tải danh sách bạn bè
  const loadFriends = async () => {
    try {
      setLoading(true);
      const data = await getFriendsList(user.id);
      setFriends(data);
    } catch (error) {
      console.error('Lỗi tải danh sách bạn bè:', error);
      toast.error('Không thể tải danh sách bạn bè');
    } finally {
      setLoading(false);
    }
  };

  // Lọc bạn bè theo từ khóa tìm kiếm
  const filteredFriends = friends.filter(friend => 
    friend.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Chọn/bỏ chọn bạn bè
  const toggleSelectFriend = (friend) => {
    if (selectedFriends.some(f => f.id === friend.id)) {
      setSelectedFriends(selectedFriends.filter(f => f.id !== friend.id));
    } else {
      setSelectedFriends([...selectedFriends, friend]);
    }
  };

  // Tạo nhóm
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.warning('Vui lòng nhập tên nhóm');
      return;
    }

    if (selectedFriends.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một thành viên');
      return;
    }

    try {
      setCreatingGroup(true);
      
      const groupData = {
        name: groupName.trim(),
        creatorId: user.id,
        participantIds: [user.id, ...selectedFriends.map(f => f.id)]
      };
      
      await chatService.createGroupConversation(groupData);
      toast.success('Đã tạo nhóm thành công');
      handleClose();
    } catch (error) {
      console.error('Lỗi tạo nhóm:', error);
      toast.error('Không thể tạo nhóm');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Đóng dialog và reset form
  const handleClose = () => {
    setGroupName('');
    setSelectedFriends([]);
    setSearchTerm('');
    onClose();
  };

  // Nếu dialog không mở, không hiển thị gì
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-brightness-20 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6 m-4 h-5/6 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Tạo nhóm chat mới</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tên nhóm
          </label>
          <input
            type="text"
            className="w-full py-2 pl-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent text-sm"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Nhập tên nhóm..."
            maxLength={50}
          />
        </div>
        
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Thêm thành viên
            </label>
            <span className="text-xs text-gray-500">
              Đã chọn: {selectedFriends.length}
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              className="w-full py-2 pl-9 pr-4 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm bạn bè..."
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* Danh sách bạn đã chọn */}
        {selectedFriends.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {selectedFriends.map(friend => (
                <div 
                  key={friend.id} 
                  className="bg-indigo-100 text-indigo-800 text-sm px-3 py-1 rounded-full flex items-center"
                >
                  <span className="mr-1">{friend.firstName} {friend.lastName}</span>
                  <button 
                    onClick={() => toggleSelectFriend(friend)}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Danh sách bạn bè */}
        <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-500"></div>
            </div>
          ) : filteredFriends.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {filteredFriends.map(friend => (
                <li 
                  key={friend.id} 
                  className="px-4 py-3 hover:bg-gray-100 cursor-pointer"
                  onClick={() => toggleSelectFriend(friend)}
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 mr-3">
                      {friend.image ? (
                        <img src={friend.image} alt={friend.firstName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-medium">
                          {friend.firstName?.charAt(0)}{friend.lastName?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {friend.firstName} {friend.lastName}
                      </p>
                      {friend.username && (
                        <p className="text-xs text-gray-500 truncate">
                          @{friend.username}
                        </p>
                      )}
                    </div>
                    <div className="ml-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        selectedFriends.some(f => f.id === friend.id)
                          ? 'bg-indigo-500 text-white'
                          : 'border-2 border-gray-300'
                      }`}>
                        {selectedFriends.some(f => f.id === friend.id) && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="mt-2 text-gray-500">
                {searchTerm ? `Không tìm thấy bạn bè nào phù hợp với "${searchTerm}"` : 'Bạn chưa có bạn bè nào'}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-2 mt-6">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={creatingGroup || !groupName.trim() || selectedFriends.length === 0}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg disabled:bg-indigo-300 transition-colors flex items-center"
          >
            {creatingGroup ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
            )}
            Tạo nhóm
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateGroupDialog;