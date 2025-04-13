// src/components/auth/ForgotPassword.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../services/authService';

function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [success, setSuccess] = useState(false);

    // Kiểm tra định dạng email
    const validateEmail = (email) => {
        const regex = /\S+@\S+\.\S+/;
        return regex.test(email);
    };

    const handleEmailChange = (e) => {
        const newEmail = e.target.value;
        setEmail(newEmail);
        
        // Xóa thông báo lỗi khi người dùng bắt đầu sửa
        if (emailError) setEmailError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setEmailError('');
        
        // Kiểm tra email trước khi gửi request
        if (!email.trim()) {
            setEmailError('Email không được để trống');
            return;
        }
        
        if (!validateEmail(email)) {
            setEmailError('Email không đúng định dạng');
            return;
        }
        
        setIsLoading(true);

        try {
            await forgotPassword(email);
            setSuccess(true);
        } catch (err) {
            setError(err.response?.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-center text-gray-800">Quên mật khẩu</h2>

                {error && (
                    <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md">
                        {error}
                    </div>
                )}

                {success ? (
                    <div className="space-y-6">
                        <div className="p-3 text-sm text-green-700 bg-green-100 rounded-md">
                            Chúng tôi đã gửi email hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư của bạn.
                        </div>
                        <div className="text-center">
                            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                                Quay lại đăng nhập
                            </Link>
                        </div>
                    </div>
                ) : (
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
                                value={email}
                                onChange={handleEmailChange}
                                className={`block w-full px-3 py-2 mt-1 border ${emailError ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                            />
                            {emailError ? (
                                <p className="mt-1 text-sm text-red-600">{emailError}</p>
                            ) : (
                                <p className="mt-2 text-xs text-gray-500">
                                    Nhập email liên kết với tài khoản của bạn và chúng tôi sẽ gửi cho bạn một liên kết để đặt lại mật khẩu.
                                </p>
                            )}
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                {isLoading ? 'Đang gửi...' : 'Gửi liên kết đặt lại mật khẩu'}
                            </button>
                        </div>

                        <div className="text-center">
                            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                                Quay lại đăng nhập
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default ForgotPassword;