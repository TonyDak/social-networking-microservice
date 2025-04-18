import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate} from 'react-router-dom';
import { logout } from '../../services/authService';
import Profile from './Profile';
import ProfileUpdate from './ProfileUpdate';
import { useUser } from '../../contexts/UserContext';
import { toast } from 'react-toastify';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user, refreshUser } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileView, setProfileView] = useState('view'); 
  const [isRequiredUpdate, setIsRequiredUpdate] = useState(false);
  const userMenuRef = useRef(null);
  const navigate = useNavigate();
  
  // Close user menu when clicking outside
  useEffect(() => {
    if(user.profileComplete === false) {
      localStorage.setItem('requireProfileUpdate', 'true');
    }else{
      localStorage.removeItem('requireProfileUpdate');
    }
    const requireUpdate = localStorage.getItem('requireProfileUpdate') === 'true';
    if (requireUpdate) {
      setShowProfileModal(true);
      setProfileView('edit');
      setIsRequiredUpdate(true);
    }
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleEditProfile = () => {
    setProfileView('edit');
  };

  const handleViewProfile = () => {
    if (!isRequiredUpdate) {
      setProfileView('view');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleProfileUpdateSuccess = async () => {
    await refreshUser(); // Refresh user data after update
    localStorage.removeItem('requireProfileUpdate');
    setIsRequiredUpdate(false);
    setShowProfileModal(false);
    setProfileView('view');
    
    setTimeout(() => {
      toast.success('Cập nhật thông tin thành công!',
        { position: "top-right", autoClose: 2000 });
    }, 1000);
  };

  return (
    <div className="flex flex-col h-screen bg-white border-r border-gray-200 shadow-sm w-20">
      {/* Header with user profile */}
      <div className="flex justify-center p-3 border-b border-gray-200">
        <div className="relative" ref={userMenuRef}>
          <button 
            className="flex items-center focus:outline-none focus:ring-2 focus:ring-indigo-100 rounded-full p-0.5"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm flex-shrink-0">
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
          </button>

          {showUserMenu && (
            <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-100 border border-gray-100">
              
              <p className="flex items-center px-4 py-2 text-l text-gray-700 border-b border-gray-200">{user.lastName +' '+ user.firstName}</p>
              <button 
                onClick={() => {
                  setShowProfileModal(true);
                  setShowUserMenu(false);
                }}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                Hồ sơ cá nhân
              </button>
              <Link 
                to="/settings" 
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                Cài đặt
              </Link>
              <div className="border-t border-gray-100 my-1"></div>
              <button 
                onClick={handleLogout}
                className="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
              >
                <svg className="w-4 h-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
              
      {/* Navigation buttons */}
      <div className="flex flex-col items-center gap-6 py-6 bg-gray-50 flex-1">
        <button 
          className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 relative ${
            activeTab === 'messages' 
              ? 'bg-indigo-100 text-indigo-700 shadow-sm' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('messages')}
          title="Tin nhắn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
            <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
          </svg>
          {activeTab === 'messages' && (
            <span className="absolute left-0 w-1 h-8 bg-indigo-500 rounded-r-full"></span>
          )}
        </button>
        <button 
          className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 relative ${
            activeTab === 'contacts' 
              ? 'bg-indigo-100 text-indigo-700 shadow-sm' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('contacts')}
          title="Danh bạ"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
          {activeTab === 'contacts' && (
            <span className="absolute left-0 w-1 h-8 bg-indigo-500 rounded-r-full"></span>
          )}
        </button>
      </div>
      {/* Profile Modal */}
      {showProfileModal && (
        <>
          {/* Overlay để làm mờ toàn bộ nội dung phía sau */}
          <div 
            className="fixed inset-0 backdrop-brightness-20 transition-opacity z-40"
            onClick={() => {
              if (!isRequiredUpdate) {
                setShowProfileModal(false);
                setProfileView('view');
              }
            }}
          ></div>
          
          {/* Modal container nổi lên trên lớp overlay */}
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl relative">
                <div className="absolute top-0 right-0 pt-4 pr-4">
                  {!isRequiredUpdate && (
                    <button
                    type="button"
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={() => {
                      setShowProfileModal(false);
                      setProfileView('view'); // Reset view khi đóng modal
                    }}
                  >
                    <span className="sr-only">Đóng</span>
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  )}
                </div>
                
                <div className="max-h-[80vh] overflow-y-auto p-6"
                style={{ '-ms-overflow-style': 'none', 'scrollbarWidth': 'none', }} 
                >
                  {profileView === 'view' ? (
                    <Profile user={user}
                    onEditClick={handleEditProfile}
                    showEditButton={true}
                    isFriend={false}
                    />
                  ) : (
                    <ProfileUpdate onCancelClick={handleViewProfile} 
                    isRequiredUpdate={isRequiredUpdate} 
                    onUpdateSuccess={handleProfileUpdateSuccess} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Sidebar;