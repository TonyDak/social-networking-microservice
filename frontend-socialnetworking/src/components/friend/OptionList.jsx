import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { getPendingFriendRequests } from '../../services/friendService'; // Adjust the import path as necessary
import SearchHeader from '../SearchHeader';

const OptionList = ({ activeOption, setActiveOption, onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
//   const [groupInvitationsCount, setGroupInvitationsCount] = useState(0);
  const { user } = useUser();

  // Fetch counts for notifications
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        if (user && user.id) {
          // Fetch friend requests
          const requests = await getPendingFriendRequests(user.id);
          setFriendRequestsCount(requests.length);

          // Fetch group invitations
        //   const invitations = await getPendingGroupInvitations(user.id);
        //   setGroupInvitationsCount(invitations.length);
        }
      } catch (error) {
        console.error("Không thể tải thông báo:", error);
      }
    };

    fetchCounts();
    
    // Refresh counts every minute
    const intervalId = setInterval(fetchCounts, 60000);
    return () => clearInterval(intervalId);
  }, [user]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  const handleOptionClick = (option) => {
    setActiveOption(option);
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
    {/* Header */}
        <SearchHeader 
            searchTerm={searchTerm}
            setSearchTerm={handleSearchChange}
            placeholder="Tìm kiếm"
            onAddFriend={() => {}}
            onCreateGroup={() => {}}
        />
      {/* Navigation Options */}
      <div className="overflow-y-auto flex-1">
        <ul className="py-2">
          {/* Friends */}
          <li 
            className={`px-4 py-3 flex items-center cursor-pointer hover:bg-gray-50 ${activeOption === 'friends' ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
            onClick={() => handleOptionClick('friends')}
          >
            <div className="w-8 h-8 mr-3 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
            <span className={`font-medium ${activeOption === 'friends' ? 'text-indigo-700' : 'text-gray-700'}`}>
              Danh sách bạn bè
            </span>
          </li>

          {/* Groups */}
          <li 
            className={`px-4 py-3 flex items-center cursor-pointer hover:bg-gray-50 ${activeOption === 'groups' ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
            onClick={() => handleOptionClick('groups')}
          >
            <div className="w-8 h-8 mr-3 rounded-full bg-green-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
            </div>
            <span className={`font-medium ${activeOption === 'groups' ? 'text-indigo-700' : 'text-gray-700'}`}>
              Danh sách nhóm
            </span>
          </li>

          {/* Friend Requests */}
          <li 
            className={`px-4 py-3 flex items-center cursor-pointer hover:bg-gray-50 ${activeOption === 'friendRequests' ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
            onClick={() => handleOptionClick('friendRequests')}
          >
            <div className="w-8 h-8 mr-3 rounded-full bg-orange-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
              </svg>
            </div>
            <div className="flex flex-1 justify-between items-center">
              <span className={`font-medium ${activeOption === 'friendRequests' ? 'text-indigo-700' : 'text-gray-700'}`}>
                Lời mời kết bạn
              </span>
              {friendRequestsCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {friendRequestsCount}
                </span>
              )}
            </div>
          </li>

        </ul>
      </div>

    </div>
  );
};

export default OptionList;