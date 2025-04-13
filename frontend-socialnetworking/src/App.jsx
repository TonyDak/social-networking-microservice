import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import GoogleCallback from './components/auth/GoogleCallback';
import Sidebar from './components/user/Sidebar';
import ChatPage from './pages/ChatPage';
import { UserProvider, useUser } from './contexts/UserContext';
// Import other components like Home, Profile, etc.

// Yêu cầu đăng nhập để truy cập
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useUser();
    if (loading) return <div className="flex justify-center items-center h-screen">Đang tải...</div>;
    return user ? children : <Navigate to="/login" />;
};

// Chuyển hướng về trang chủ nếu đã đăng nhập
const PublicRoute = ({ children }) => {
    const { user, loading } = useUser();
    if (loading) return <div className="flex justify-center items-center h-screen">Đang tải...</div>;
    return user ? <Navigate to="/" /> : children;
};

function App() {
    const ChatLayout = ({ children }) => {
        return (
            <div className="flex h-screen">
                <Sidebar/>
                <main className="flex-1 overflow-auto">
                    {children}
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
            
            {/* Protected routes - yêu cầu đăng nhập */}
            {/* Add Chat route */}
            <Route path="/" element={
                <ProtectedRoute>
                    <ChatLayout>
                        <ChatPage />
                    </ChatLayout>
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