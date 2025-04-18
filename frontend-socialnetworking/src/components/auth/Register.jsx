// src/components/auth/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../services/authService';

function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        confirmPassword: '',
        gender: '',
        dateOfBirth: '',
        phoneNumber: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState('');

    const validateForm = () => {
        const newErrors = {};
        
        // Validate email
        if (!formData.email) {
            newErrors.email = 'Email không được để trống';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email không hợp lệ';
        }
        
        // Validate firstName
        if (!formData.firstName.trim()) {
            newErrors.firstName = 'Họ không được để trống';
        }
        
        // Validate lastName
        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Tên không được để trống';
        }
        
        // Validate password
        if (!formData.password) {
            newErrors.password = 'Mật khẩu không được để trống';
        } else if (formData.password.length < 8 && formData.password.length > 16) {
            newErrors.password = 'Mật khẩu phải có ít nhất 8 ký tự và tối đa 16 ký tự';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(formData.password)) {
            newErrors.password = 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt';
        }
        
        // Validate confirmPassword
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Mật khẩu không khớp';
        }
        
        // Validate gender
        if (!formData.gender) {
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

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        setFormData({
            ...formData,
            [name]: value
        });
        
        // Clear error when field changes
        if (errors[name]) {
            setErrors({
                ...errors,
                [name]: undefined
            });
        }
        
        // Validate on-the-fly for better UX
        if (name === 'email' && value) {
            if (!/\S+@\S+\.\S+/.test(value)) {
                setErrors(prev => ({
                    ...prev,
                    email: 'Email không hợp lệ'
                }));
            }
        }

        // Validate phoneNumber
        if (name === 'phoneNumber' && value) {
            //số điện thoại phải có 10-11 ký tự và bắt đầu bằng 0
            if (!/^(0[1-9][0-9]{8,9})$/.test(value)) {
                setErrors(prev => ({
                    ...prev,
                    phoneNumber: 'Số điện thoại không hợp lệ'
                }));
            }
        }
        
        if (name === 'password' && value) {
            if (value.length < 8 && value.length > 16) {
                setErrors(prev => ({
                    ...prev,
                    password: 'Mật khẩu phải có ít nhất 8 ký tự và tối đa 16 ký tự'
                }));
            } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(value)) {
                setErrors(prev => ({
                    ...prev,
                    password: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt'
                }));
            }
        }
        
        if (name === 'confirmPassword' && value) {
            if (value !== formData.password) {
                setErrors(prev => ({
                    ...prev,
                    confirmPassword: 'Mật khẩu không khớp'
                }));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate form before submission
        if (!validateForm()) {
            return;
        }
        
        setIsLoading(true);

        try {
            // API call
            await register(formData);
            navigate('/login', { state: { registered: true } });
        } catch (err) {
            const errorMessage = err.message;
            setErrors({submit: errorMessage});
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-center text-gray-800">Đăng ký tài khoản</h2>
    
                {errors.submit && (
                    <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md">
                        {errors.submit}
                    </div>
                )}
    
                <form className="space-y-6" onSubmit={handleSubmit}>
                    
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            Email
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            className={`block w-full px-3 py-2 mt-1 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                        />
                        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                    </div>
                    <div>
                        <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                            Số điện thoại
                        </label>
                        <input
                            id="phoneNumber"
                            name="phoneNumber"
                            type="phoneNumber"
                            required
                            value={formData.phoneNumber}
                            onChange={handleChange}
                            className={`block w-full px-3 py-2 mt-1 border ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                        />
                        {errors.phoneNumber && <p className="mt-1 text-sm text-red-600">{errors.phoneNumber}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                                Họ
                            </label>
                            <input
                                id="firstName"
                                name="firstName"
                                type="text"
                                value={formData.firstName}
                                onChange={handleChange}
                                className={`block w-full px-3 py-2 mt-1 border ${errors.firstName ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                            />
                            {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
                        </div>
                        <div>
                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                                Tên
                            </label>
                            <input
                                id="lastName"
                                name="lastName"
                                type="text"
                                value={formData.lastName}
                                onChange={handleChange}
                                className={`block w-full px-3 py-2 mt-1 border ${errors.lastName ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                            />
                            {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Giới tính
                            </label>
                            <div className="flex space-x-6">
                                <div className="flex items-center">
                                    <input
                                        id="gender-male"
                                        name="gender"
                                        type="radio"
                                        value="MALE"
                                        checked={formData.gender === "MALE"}
                                        onChange={handleChange}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                    />
                                    <label htmlFor="gender-male" className="ml-2 block text-sm text-gray-700">
                                        Nam
                                    </label>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        id="gender-female"
                                        name="gender"
                                        type="radio"
                                        value="FEMALE"
                                        checked={formData.gender === "FEMALE"}
                                        onChange={handleChange}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                    />
                                    <label htmlFor="gender-female" className="ml-2 block text-sm text-gray-700">
                                        Nữ
                                    </label>
                                </div>
                            </div>
                            {errors.gender && <p className="mt-1 text-sm text-red-600">{errors.gender}</p>}
                        </div>
                        <div>
                            <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
                                Ngày sinh
                            </label>
                            <input
                                id="dateOfBirth"
                                name="dateOfBirth"
                                type="date"
                                value={formData.dateOfBirth}
                                onChange={handleChange}
                                className={`block w-full px-3 py-2 mt-1 border ${errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                            />
                            {errors.dateOfBirth && <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>}
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                            Mật khẩu
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            className={`block w-full px-3 py-2 mt-1 border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                        />
                        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                    </div>
    
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                            Xác nhận mật khẩu
                        </label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            required
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className={`block w-full px-3 py-2 mt-1 border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                        />
                        {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
                    </div>
    
                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            {isLoading ? 'Đang xử lý...' : 'Đăng ký'}
                        </button>
                    </div>
                </form>
    
                <div className="text-center">
                    <p className="text-sm text-gray-600">
                        Đã có tài khoản?{' '}
                        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                            Đăng nhập
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Register;