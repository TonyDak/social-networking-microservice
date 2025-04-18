import React from 'react';
import { useState } from 'react';
import AddFriendDialog from './friend/AddFriendDialog';
import CreateGroupDialog from './friend/CreateGroupDialog';

function SearchHeader({ 
  searchTerm, 
  setSearchTerm, 
  placeholder = "Tìm kiếm...",
  onAddFriend,
  onCreateGroup
}) {
  const [isAddFriendDialogOpen, setIsAddFriendDialogOpen] = useState(false);
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);

  // Mở dialog thêm bạn bè
  const handleOpenAddFriendDialog = () => {
    setIsAddFriendDialogOpen(true);
  };

  // Đóng dialog thêm bạn bè
  const handleCloseAddFriendDialog = () => {
    setIsAddFriendDialogOpen(false);
    // Gọi callback nếu có
    if (typeof onAddFriend === 'function') {
      onAddFriend();
    }
  };

  // Mở dialog tạo nhóm
  const handleOpenCreateGroupDialog = () => {
    setIsCreateGroupDialogOpen(true);
  };

  // Đóng dialog tạo nhóm
  const handleCloseCreateGroupDialog = () => {
    setIsCreateGroupDialogOpen(false);
    // Gọi callback nếu có
    if (typeof onCreateGroup === 'function') {
      onCreateGroup();
    }
  };
  return (
    <>
      <div className="p-4">
      <div className="flex items-center space-x-2">
        {/* Thanh tìm kiếm */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={placeholder}
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
        
        {/* Nút thêm bạn bè */}
        {onAddFriend !== undefined && (
            <button
              onClick={handleOpenAddFriendDialog}
              className="flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 p-2 h-10 w-10 rounded-lg transition-colors"
              title="Thêm bạn bè"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
              </svg>
            </button>
          )}
          
          {/* Nút tạo nhóm */}
          {onCreateGroup !== undefined && (
            <button
              onClick={handleOpenCreateGroupDialog}
              className="flex items-center justify-center bg-green-50 hover:bg-green-100 text-green-700 p-2 h-10 w-10 rounded-lg transition-colors"
              title="Tạo nhóm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
            </button>
          )}
      </div>
    </div>
    {/* Dialog Thêm bạn bè */}
    {onAddFriend !== undefined && (
        <AddFriendDialog 
          isOpen={isAddFriendDialogOpen} 
          onClose={handleCloseAddFriendDialog} 
        />
      )}

      {/* Dialog Tạo nhóm */}
      {onCreateGroup !== undefined && (
        <CreateGroupDialog 
          isOpen={isCreateGroupDialogOpen} 
          onClose={handleCloseCreateGroupDialog} 
        />
      )}
    </>
    
  );
}

export default SearchHeader;