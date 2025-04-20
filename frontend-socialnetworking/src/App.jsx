import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import GoogleCallback from './components/auth/GoogleCallback';
import Sidebar from './components/user/Sidebar';
import ChatPage from './pages/ChatPage';
import { UserProvider, useUser } from './contexts/UserContext';
import FriendsPage from './pages/FriendsPage';
import chatService from './services/chatService';
import { getCookie } from './services/apiClient';
import { useNavigate } from 'react-router-dom';
import { CallProvider } from './contexts/CallContext';
import IncomingCallDialog from './components/call/IncomingCallDialog';
import CallInterface from './components/call/CallInterface';

// Yêu cầu đăng nhập để truy cập
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useUser();
    if (loading) return <div className="flex justify-center items-center h-screen">Đang tải...</div>;
    return user ? children : <Navigate to="/login" />;
};

// Chuyển hướng về trang chủ nếu đã đăng nhập
const PublicRoute = ({ children }) => {
    const { user, loading } = useUser();
    const [redirecting, setRedirecting] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (user && !loading) {
            setRedirecting(true);
            
            // Thêm độ trễ 1 giây trước khi chuyển hướng
            const timer = setTimeout(() => {
                navigate('/');
            }, 2000);
            
            return () => clearTimeout(timer);
        }
    }, [user, loading, navigate]);

    if (loading) return <div className="flex justify-center items-center h-screen">Đang tải...</div>;
    if (redirecting) return <div className="flex justify-center items-center h-screen">Đang chuyển hướng...</div>;
    
    return children;
};

function App() {
    const [activeView, setActiveView] = useState('messages'); // 'messages' hoặc 'contacts'
    const [selectedChatUser, setSelectedChatUser] = useState(null);
    const [websocketConnected, setWebsocketConnected] = useState(false); // Thêm state cho trạng thái kết nối
    const [websocketError, setWebsocketError] = useState(null); // Thêm state cho lỗi kết nối
    const { user } = useUser(); // Lấy thông tin user
    useEffect(() => {
        if (user) {
            const token = getCookie('access_token');
            
            // Kết nối đến WebSocket server
            chatService.connect(
                token,
                user.keycloakId,
                () => {
                    console.log('Đã kết nối đến dịch vụ chat');
                    setWebsocketConnected(true);
                },
                (error) => {
                    console.error('Lỗi kết nối đến dịch vụ chat:', error);
                    setWebsocketError(error);
                }
            );
        }
        
        // Cleanup khi unmount component
        return () => {
            chatService.disconnect();
        };
    }, [user]);
    const ChatLayout = () => {
        return (
            <div className="flex h-screen">
                <Sidebar activeTab={activeView} setActiveTab={setActiveView} />
                <main className="flex-1 overflow-auto">
                    {activeView === 'messages' ? (
                        <ChatPage 
                            selectedUser={selectedChatUser} 
                            connected={websocketConnected} 
                            websocketError={websocketError}
                        />
                    ) : (
                        <FriendsPage 
                            setActiveTab={setActiveView} 
                            setSelectedChatUser={setSelectedChatUser}
                            connected={websocketConnected}
                        />
                    )}
                </main>
            </div>
            
        );
    };
    
    return (
        <Routes>
            {/* Public routes - chuyển hướng nếu đã đăng nhập */}
            <Route path="/login" element={
                <PublicRoute>
                    <Login />
                </PublicRoute>
            } />
            <Route path="/register" element={
                <PublicRoute>
                    <Register />
                </PublicRoute>
            } />
            <Route path="/forgot-password" element={
                <PublicRoute>
                    <ForgotPassword />
                </PublicRoute>
            } />
            <Route path="/auth/callback" element={<GoogleCallback />} />
            
            {/* Main app route */}
            <Route path="/" element={
                <ProtectedRoute>
                    <CallProvider>
                        <ChatLayout />
                        <IncomingCallDialog />
                        <CallInterface /> 
                    </CallProvider>                  
                </ProtectedRoute>
            } />
            {/* Add more routes as needed */}
        </Routes>
    );
}

// Wrapper component để cung cấp các providers cần thiết
function AppWithProviders() {
    return (
        <UserProvider>
            <Router>
                <div className="min-h-screen bg-gray-50">
                    <App />
                    <ToastContainer position="top-right" autoClose={3000} />
                </div>
            </Router>
        </UserProvider>
    );
}

export default AppWithProviders;