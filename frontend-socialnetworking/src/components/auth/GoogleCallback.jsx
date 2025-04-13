import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { processGoogleLogin } from '../../services/authService';

function GoogleCallback() {
    const [status, setStatus] = useState('Đang chuẩn bị xử lý đăng nhập...');
    const [countdown, setCountdown] = useState(null);
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const codeFoundRef = useRef(false);

    useEffect(() => {
        // Đợi một chút để đảm bảo URL parameters đã được tải đầy đủ
        const timer = setTimeout(() => {
            if (!codeFoundRef.current) { // Chỉ gọi nếu chưa tìm thấy code
                handleCallback();
            }
        }, 1000);

        async function handleCallback() {
            try {
                // Nếu đã tìm thấy code hoặc đang xử lý, dừng lại
                if (codeFoundRef.current || isProcessing) {
                    return;
                }

                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');
                
                
                if (code) {
                    // Đánh dấu đã tìm thấy code để ngăn kiểm tra thêm
                    codeFoundRef.current = true;
                    
                    try {
                        setIsProcessing(true);
                        setStatus('Đang xác thực với máy chủ...');
                        
                        // Xóa parameters khỏi URL để tránh refresh trang sẽ gọi lại API
                        window.history.replaceState({}, document.title, window.location.pathname);
                        
                        // Gọi API để đổi code lấy token
                        const userData = await processGoogleLogin(code);
                        // Kiểm tra xem hồ sơ đã hoàn thiện chưa
                        if (userData) {
                            setStatus('Đăng nhập thành công! Đang chuyển hướng...');
                            startCountdown(2, '/'); // Chuyển đến trang cập nhật bắt buộc
                        }
                    } catch (error) {
                        console.error('Lỗi xử lý callback:', error.message);
                        setStatus('Đăng nhập thất bại. Vui lòng thử lại.');
                        startCountdown(5, '/login');
                    }
                } else {
                    // Nếu không tìm thấy code và chưa vượt quá số lần thử lại
                    if (retryCount < 3) {
                        setStatus(`Đang đợi tham số xác thực... (${retryCount + 1}/3)`);
                        setRetryCount(prevCount => prevCount + 1);
                    } else {
                        setStatus('Không tìm thấy mã xác thực. Vui lòng thử lại.');
                        startCountdown(5, '/login');
                    }
                }
            } catch (error) {
                console.error('Lỗi khi xử lý URL parameters:', error);
                setStatus('Đã xảy ra lỗi. Vui lòng thử lại.');
                startCountdown(5, '/login');
            }
        }

        function startCountdown(seconds, destination) {
            // Clear timer cũ nếu có
            if (window.countdownTimerRef) {
                clearInterval(window.countdownTimerRef);
            }
            
            let count = seconds;
            setCountdown(count);
            
            // Lưu timer vào biến toàn cục để tránh vấn đề về closure
            window.countdownTimerRef = setInterval(() => {
                count--;
                setCountdown(count);
                
                if (count <= 0) {
                    clearInterval(window.countdownTimerRef);
                    // Sử dụng timeout để đảm bảo UI cập nhật trước khi chuyển hướng
                    setTimeout(() => {
                        window.location.href = destination;
                    }, 50);
                }
            }, 1000);
        }

        return () => clearTimeout(timer);
    }, [navigate, isProcessing, retryCount]);

    // UI không thay đổi
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md text-center">
                <div className="mb-4">
                    {isProcessing && (
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    )}
                </div>
                
                <h2 className="text-xl font-semibold mb-2">{status}</h2>
                
                {countdown !== null && (
                    <p className="text-gray-600">
                        Chuyển hướng sau {countdown} giây...
                    </p>
                )}
                
                {status.includes('thất bại') && (
                    <button 
                        onClick={() => navigate('/login')} 
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                        Quay lại ngay
                    </button>
                )}
            </div>
        </div>
    );
}

export default GoogleCallback;