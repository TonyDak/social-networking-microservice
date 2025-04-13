import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { logout } from '../../services/authService';

const ProfileUpdate = ({ onCancelClick, isRequiredUpdate = false, onUpdateSuccess  }) => {
  const { user, updateUser, loading: userLoading, error: userError } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    bio: '',
    gender: '',
    dateOfBirth: '',
    phoneNumber: '',
    image: null
  });
  const [formErrors, setFormErrors] = useState({});
  const isInModal = onCancelClick !== undefined;
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);
  // Cập nhật form data khi user data thay đổi
  useEffect(() => {
    if (user) {
      let formattedDate = '';
    
      // Format date if it exists and is valid
      if (user.dateOfBirth) {
        try {
          // Try to parse the date
          const date = new Date(user.dateOfBirth);
          
          // Check if the date is valid
          if (!isNaN(date.getTime())) {
            // Format to YYYY-MM-DD for input type="date"
            formattedDate = date.toISOString().split('T')[0];
          }
        } catch (error) {
          console.error('Error formatting date:', error);
        }
      }
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        bio: user.bio || '',
        gender: user.gender || '',
        dateOfBirth: formattedDate,
        phoneNumber: user.phoneNumber || '',
        image: null // Keep as null until user selects a new image
      });
      if (user.image) {
        setPreviewImage(user.image);
      }
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        image: file
      }));
      
      // Hiển thị preview ảnh
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validate firstName
    if (!formData.firstName.trim()) {
        newErrors.firstName = 'Họ không được để trống';
    }
    
    // Validate lastName
    if (!formData.lastName.trim()) {
        newErrors.lastName = 'Tên không được để trống';
    }
    
    // Validate gender
    if (!formData.gender || formData.gender.trim() === '') {
      newErrors.gender = 'Vui lòng chọn giới tính';
  }
    
    // Validate dateOfBirth
    if (!formData.dateOfBirth) {
        newErrors.dateOfBirth = 'Vui lòng chọn ngày sinh';
    } else {
        const birthDate = new Date(formData.dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        
        if (age < 13) {
            newErrors.dateOfBirth = 'Bạn phải đủ 13 tuổi trở lên để đăng ký';
        }
    }

    // Validate phoneNumber
    if (!formData.phoneNumber) {
        newErrors.phoneNumber = 'Số điện thoại không được để trống';
    }
    else if (!/^(0[1-9][0-9]{8,9})$/.test(formData.phoneNumber)) {
        newErrors.phoneNumber = 'Số điện thoại không hợp lệ';
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
};

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      // Tạo đối tượng dữ liệu cập nhật
      const userData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        gender: formData.gender,
        phoneNumber: formData.phoneNumber.trim(),
        bio: formData.bio ? formData.bio.trim() : ''
      };
      
      // Xử lý ngày sinh - chuyển từ định dạng yyyy-MM-dd sang định dạng phù hợp cho API
      if (formData.dateOfBirth) {
        const parts = formData.dateOfBirth.split('-');
        if (parts.length === 3) {
          // Format thành yyyy/MM/dd hoặc định dạng mà API yêu cầu
          userData.dateOfBirth = `${parts[2]}/${parts[1]}/${parts[0]}`
        }
      }
  
      // Tạo FormData để gửi lên server
      const submitData = new FormData();
      
      // Thêm tất cả các trường dữ liệu vào FormData
      Object.entries(userData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          submitData.append(key, value);
        }
      });
      
      // Thêm file ảnh nếu có
      if (formData.image) {
        submitData.append('image', formData.image);
      }
      
      // Gọi API cập nhật người dùng
      await updateUser(submitData);
      
      if (onUpdateSuccess) {
        onUpdateSuccess();
      } else if (isInModal) {
        onCancelClick();
      } else {
        navigate('/');
      }
  
    } catch (err) {
      setError('Không thể cập nhật thông tin người dùng');
      console.error(err);
      setLoading(false);
    } 
  };

  if (userLoading) return <div className="flex justify-center items-center h-screen">Đang tải...</div>;
  if (userError) return <div className="text-red-500 text-center py-4">{userError}</div>;
  if (!user) return <div className="text-center py-4">Không tìm thấy thông tin người dùng</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          {isRequiredUpdate 
            ? "Cập nhật thông tin cá nhân (Bắt buộc)" 
            : "Cập nhật thông tin cá nhân"}
        </h1>

        {isRequiredUpdate && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-yellow-700">
                Vui lòng cập nhật thông tin hồ sơ cá nhân của bạn để tiếp tục sử dụng dịch vụ.
              </p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          {/* Ảnh đại diện */}
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Ảnh đại diện</label>
            <div className="flex items-center">
              {/* Ẩn input file và điều khiển thông qua ref */}
              <input 
                type="file" 
                name="image"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                ref={fileInputRef}
              />
              
              {/* Ảnh đại diện có thể click để mở file selector */}
              <div 
                className="relative h-20 w-20 rounded-full overflow-hidden bg-gray-200 mr-4 cursor-pointer group"
                onClick={() => fileInputRef.current.click()}
              >
                {previewImage ? (
                  <>
                    <img 
                      src={previewImage} 
                      alt="Ảnh đại diện" 
                      className="h-full w-full object-cover transition-opacity group-hover:opacity-70"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black bg-opacity-20 transition-opacity">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-full w-full flex items-center justify-center bg-gray-300 text-gray-600 transition-opacity group-hover:opacity-70">
                      {formData.firstName.charAt(0) + formData.lastName.charAt(0)}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black bg-opacity-20 transition-opacity">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </>
                )}
              </div>
              
              <div className="text-sm">
                <button 
                  type="button" 
                  className="text-blue-600 hover:text-blue-700 focus:outline-none"
                  onClick={() => fileInputRef.current.click()}
                >
                  Chọn ảnh đại diện
                </button>
                <p className="text-gray-500 mt-1">Hỗ trợ JPG, GIF hoặc PNG. Kích thước tối đa 1MB.</p>
              </div>
            </div>
          </div>
          
          
          {/* Họ */}
          <div className='mb-4 flex flex-wrap gap-4'>
                <div className="flex-1 min-w-[200px]">
                <label className="block text-gray-700 mb-2">
                  Họ <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  name="firstName"
                  value={formData.firstName} 
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.firstName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {formErrors.firstName && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.firstName}</p>
                )}
              </div>
              
              {/* Tên */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-gray-700 mb-2">
                  Tên <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  name="lastName"
                  value={formData.lastName} 
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.lastName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {formErrors.lastName && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.lastName}</p>
                )}
              </div>
          </div>
          
          <div className="mb-4 flex flex-wrap gap-4">
           {/* Giới tính */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-gray-700 mb-2">
                Giới tính <span className="text-red-500">*</span>
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="gender"
                    value="MALE"
                    checked={formData.gender === 'MALE'}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  Nam
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="gender"
                    value="FEMALE"
                    checked={formData.gender === 'FEMALE'}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  Nữ
                </label>
              </div>
              {formErrors.gender && (
                <p className="text-red-500 text-sm mt-1">{formErrors.gender}</p>
              )}
            </div>

            {/* Ngày sinh */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-gray-700 mb-2">
                Ngày sinh <span className="text-red-500">*</span>
              </label>
              <input 
                type="date" 
                name="dateOfBirth"
                value={formData.dateOfBirth} 
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formErrors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {formErrors.dateOfBirth && (
                <p className="text-red-500 text-sm mt-1">{formErrors.dateOfBirth}</p>
              )}
            </div>
          </div>
          
          
          
          {/* Số điện thoại */}
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">
              Số điện thoại <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              name="phoneNumber"
              value={formData.phoneNumber} 
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.phoneNumber ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {formErrors.phoneNumber && (
              <p className="text-red-500 text-sm mt-1">{formErrors.phoneNumber}</p>
            )}
          </div>

          {/* Giới thiệu */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Giới thiệu bản thân</label>
            <textarea 
              name="bio"
              value={formData.bio} 
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
            />
          </div>
          
          {/* Buttons */}
          <div className="flex justify-between">
          {isRequiredUpdate ? (
              <button 
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 border border-red-300"
              >
                Đăng xuất
              </button>
            ) : (
              isInModal && (
                <button 
                  type="button"
                  onClick={onCancelClick}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Hủy
                </button>
              )
            )}
            <button 
              type="submit" 
              className={`px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium`}
              disabled={loading}
            >
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileUpdate;