import { useUser } from '../../contexts/UserContext';


const Profile = ({onEditClick}) => {
  const { user, loading, error } = useUser();
  // Kiểm tra xem component có được mở trong modal không
  const isInModal = !location.pathname.includes('/profile');


  if (loading) return <div className="flex justify-center items-center h-screen">Đang tải...</div>;
  if (error) return <div className="text-red-500 text-center py-4">{error}</div>;
  if (!user) return <div className="text-center py-4">Không tìm thấy thông tin người dùng</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Thông tin tài khoản</h1>
          {isInModal && (
            <button 
              onClick={onEditClick}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Chỉnh sửa
            </button>
          )}
        </div>

        
        <div>
          <div className="flex items-center mb-6">
            <div className="h-20 w-20 rounded-full overflow-hidden bg-gray-200 mr-4">
              {user.image ? (
                <img 
                  src={user.image} 
                  alt="Ảnh đại diện" 
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gray-300 text-gray-600">
                  {user.firstName.charAt(0)+user.lastName?.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user.firstName +' '+user.lastName || 'Chưa cập nhật'}</h2>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <div className="mb-4">
              <h3 className="text-gray-600 font-medium mb-2">Thông tin cá nhân</h3>
            </div>
              {/* Giới thiệu */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Giới thiệu</p>
                <p className="text-gray-800">{user.bio || 'Chưa cập nhật'}</p>
              </div>
              
              {/* Giới tính */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Giới tính</p>
                <p className="text-gray-800">
                  {user.gender ? 
                    (user.gender === 'MALE' ? 'Nam' : 
                    user.gender === 'FEMALE' ? 'Nữ' : 'Chưa cập nhật') : 
                    'Chưa cập nhật'}
                </p>
              </div>
              
              {/* Ngày sinh */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Ngày sinh</p>
                <p className="text-gray-800">
                  {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  }) : 'Chưa cập nhật'}
                </p>
              </div>
              
              {/* Số điện thoại */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Số điện thoại</p>
                <p className="text-gray-800">{user.phoneNumber || 'Chưa cập nhật'}</p>
              </div>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default Profile;