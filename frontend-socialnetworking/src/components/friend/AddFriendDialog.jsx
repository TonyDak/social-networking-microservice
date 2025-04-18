import { useState } from 'react';
import { sendFriendRequest } from '../../services/friendService';
import { findUserByPhone } from '../../services/userService';
import { useUser } from '../../contexts/UserContext';
import { toast } from 'react-toastify';
import { getCookie } from '../../services/apiClient';

function AddFriendDialog({ isOpen, onClose }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const { user } = useUser();
  const token = getCookie('access_token');
  
  // Reset form khi đóng dialog
  const handleClose = () => {
    setPhoneNumber('');
    setFoundUser(null);
    onClose();
  };
  
  // Tìm kiếm người dùng theo số điện thoại
  const handleSearch = async () => {
    if (!phoneNumber.trim()) {
      toast.warning('Vui lòng nhập số điện thoại');
      return;
    }
    
    try {
      setIsSearching(true);
      const result = await findUserByPhone(token, phoneNumber);
      
      if (result.statusCodeValue !== 404) {
        // Kiểm tra nếu người dùng tự tìm chính mình
        if (result.body.phoneNumber === user.phoneNumber) {
          toast.warning('Bạn không thể tự kết bạn với chính mình');
          setFoundUser(null);
          return;
        }
        
        setFoundUser(result);
      } else if(result.statusCodeValue === 404) {
        toast.error('Không tìm thấy người dùng với số điện thoại này');
        setFoundUser(null);
      }
    } catch (error) {
      console.error('Lỗi tìm kiếm:', error);
      toast.error('Đã xảy ra lỗi khi tìm kiếm người dùng');
    } finally {
      setIsSearching(false);
    }
  };
  
  // Gửi yêu cầu kết bạn
  const handleSendRequest = async () => {
    if (!foundUser) return;
    
    try {
      setIsSendingRequest(true);
      await sendFriendRequest(user.keycloakId, foundUser.body.keycloakId);
      toast.success(`Đã gửi lời mời kết bạn đến ${foundUser.body.firstName} ${foundUser.body.lastName}`);
      handleClose();
    } catch (error) {
      console.error('Lỗi gửi yêu cầu kết bạn:', error);
      
      if (error.response?.status === 409) {
        toast.info('Đã gửi lời mời kết bạn trước đó hoặc người này đã là bạn bè của bạn');
      } else {
        toast.error('Đã xảy ra lỗi khi gửi lời mời kết bạn');
      }
    } finally {
      setIsSendingRequest(false);
    }
  };

  // Nếu dialog không mở, không hiển thị gì
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-brightness-20 transition-opacity flex items-start justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 m-4 animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Thêm bạn bè</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tìm kiếm theo số điện thoại
          </label>
          <div className="flex space-x-2">
            <input
              type="tel"
              className="w-full py-2 pl-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent text-sm"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Nhập số điện thoại"
              disabled={isSearching}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !phoneNumber.trim()}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors disabled:bg-indigo-300"
            >
              {isSearching ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              ) : (
                <span>Tìm</span>
              )}
            </button>
          </div>
        </div>
        
        {foundUser && (
          <div className="border rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 mr-4">
                {foundUser.body.image ? (
                  <img src={foundUser.body.image} alt={foundUser.body.firstName} className="w-full h-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-medium">
                    {foundUser.body.firstName?.charAt(0)}{foundUser.body.lastName?.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{foundUser.body.firstName} {foundUser.body.lastName}</h3>
                <p className="text-sm text-gray-500">
                  {foundUser.body.phone && (
                    <>
                      <span>{foundUser.body.phone}</span>
                      {foundUser.body.email && <span className="mx-2">•</span>}
                    </>
                  )}
                  {foundUser.body.email && <span>{foundUser.body.email}</span>}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          {foundUser && (
            <button
              onClick={handleSendRequest}
              disabled={isSendingRequest}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg disabled:bg-indigo-300 transition-colors flex items-center"
            >
              {isSendingRequest ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                </svg>
              )}
              Gửi lời mời kết bạn
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddFriendDialog;