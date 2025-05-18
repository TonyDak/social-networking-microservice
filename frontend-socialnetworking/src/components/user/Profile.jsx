function Profile({ 
  user, 
  showEditButton = true, 
  isFriend = false, 
  onEditClick, 
  onSendMessage
}) {
  if (!user) {
    return <div className="flex justify-center p-8">Đang tải thông tin...</div>;
  }
  // Format ngày sinh nếu có
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="p-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Thông tin cá nhân</h2>
      </div>
      
      <div className="flex flex-col items-center mb-6">
        <div className="w-24 h-24 relative mb-4">
          <div className="w-full h-full rounded-full overflow-hidden border-4 border-gray-200">
            {user.image ? (
              <img src={user.image} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-600 text-2xl font-medium">
                {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
              </div>
            )}
          </div>
        </div>
        <h3 className="text-xl font-semibold">{user.firstName} {user.lastName}</h3>
        {user.username && <p className="text-gray-500">@{user.username}</p>}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 mb-6">
        <div>
          <h4 className="text-sm text-gray-500 mb-1">Email</h4>
          <p className="font-medium">{user.email || '(Chưa cung cấp)'}</p>
        </div>
        <div>
          <h4 className="text-sm text-gray-500 mb-1">Số điện thoại</h4>
          <p className="font-medium">{user.phoneNumber || '(Chưa cung cấp)'}</p>
        </div>
        <div>
          <h4 className="text-sm text-gray-500 mb-1">Ngày sinh</h4>
          <p className="font-medium">{formatDate(user.dateOfBirth) || '(Chưa cung cấp)'}</p>
        </div>
        <div>
          <h4 className="text-sm text-gray-500 mb-1">Giới tính</h4>
          <p className="font-medium">
            {user.gender === 'MALE' ? 'Nam' : 
             user.gender === 'FEMALE' ? 'Nữ' : 
             user.gender === 'OTHER' ? 'Khác' : '(Chưa cung cấp)'}
          </p>
        </div>
        {user.bio && (
          <div className="col-span-1 md:col-span-2">
            <h4 className="text-sm text-gray-500 mb-1">Giới thiệu</h4>
            <p className="font-medium">{user.bio}</p>
          </div>
        )}
      </div>

      <div className="flex justify-center mt-6 space-x-4">
        {showEditButton && (
          <button
            onClick={onEditClick}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Chỉnh sửa hồ sơ
          </button>
        )}
        
        {isFriend && (
          <>
            <button
              onClick={onSendMessage}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
              </svg>
              Nhắn tin
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default Profile;