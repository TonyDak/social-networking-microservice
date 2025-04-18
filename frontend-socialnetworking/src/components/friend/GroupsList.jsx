import { useMemo } from 'react';

function GroupsList({ 
  groups = [], 
  searchTerm = '', 
  loading = false, 
  onOpenChat, 
  onLeaveGroup 
}) {
  // Lọc nhóm theo từ khóa tìm kiếm
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups;
    
    return groups.filter(group => 
      group.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [groups, searchTerm]);
  
  const handleLeaveGroup = (groupId) => {
    if (window.confirm('Bạn có chắc chắn muốn rời khỏi nhóm này không?')) {
      if (onLeaveGroup) onLeaveGroup(groupId);
    }
  };
  
  const handleOpenChat = (groupId) => {
    if (onOpenChat) onOpenChat(groupId);
  };
  
  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center p-4 bg-white border-b border-gray-200">
        <div className="w-8 h-8 mr-3 rounded-full bg-green-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
        </div>
        <span className={`font-medium text-gray-700 text-xl`}>
          Danh sách nhóm
        </span>
      </div>
      
      <div className="px-4 pb-4">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-indigo-500"></div>
          </div>
        ) : filteredGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {filteredGroups.map(group => (
              <div key={group.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 mr-3 flex items-center justify-center bg-green-100 text-green-600 font-medium">
                    {group.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{group.name}</h3>
                    <p className="text-sm text-gray-500">
                      {group.memberCount || 0} thành viên
                    </p>
                  </div>
                </div>
                
                <div className="flex mt-4 space-x-2">
                  <button
                    onClick={() => handleOpenChat(group.id)}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded flex items-center justify-center transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                      <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                    </svg>
                    Nhắn tin
                  </button>
                  <button
                    onClick={() => handleLeaveGroup(group.id)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
                    title="Rời khỏi nhóm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V7.414L11.414 3H3zm7 2a1 1 0 00-1 1v5a1 1 0 002 0V6a1 1 0 00-1-1zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-8 text-center mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-3 text-lg font-medium text-gray-900">
              {searchTerm ? 'Không tìm thấy nhóm phù hợp' : 'Bạn chưa tham gia nhóm nào'}
            </h3>
            <p className="mt-2 text-gray-500">
              {searchTerm 
                ? `Không tìm thấy nhóm nào phù hợp với "${searchTerm}"`
                : 'Hãy tạo hoặc tham gia nhóm để bắt đầu trò chuyện nhóm'}
            </p>
            
          </div>
        )}
      </div>
    </div>
  );
}

export default GroupsList;